// ===========================
// C# Parser - C#コードをScriptCraftProjectに変換
// using文、フィールド宣言、カスタムメソッド、
// 内部クラス/enum、ライフサイクルメソッドを全て保持する
// ===========================

import type { ScriptCraftProject, ScriptType, UIElement, ElementType, ProjectSettings } from '../types/editor';
import { createNewProject, createDefaultSettings } from '../types/editor';

/** パース結果 */
export interface ParseResult {
    project: ScriptCraftProject;
    warnings: string[];
}

// =====================================================================
// メインのパース関数
// =====================================================================

/** 単一C#ファイルをパース */
export function parseCSharpFile(fileName: string, content: string): ParseResult {
    const warnings: string[] = [];

    const project = createNewProject(fileName.replace(/\.cs$/, ''));

    // 1. using文の抽出
    project.usingStatements = extractUsingStatements(content);

    // 2. スクリプトタイプの検出
    project.scriptType = detectScriptType(content);

    // 3. 設定の抽出
    const settings = extractSettings(content, project.scriptType, warnings);
    project.settings = settings;
    project.name = settings.className || project.name;

    // 4. クラス本体を取得
    const classBodyResult = extractMainClassBody(content, settings.className, warnings);
    if (!classBodyResult) {
        warnings.push('⚠ クラス本体が見つかりませんでした');
        return { project, warnings };
    }

    // 5. クラス本体内を分析
    const classBody = classBodyResult.body;

    // 5a. 内部クラス/enum/struct を抽出
    project.innerTypes = extractInnerTypes(classBody, warnings);

    // 5b. フィールド宣言を抽出
    project.fieldDeclarations = extractFieldDeclarations(classBody, warnings);

    // 5c. メソッドの分類と抽出
    const methods = extractMethods(classBody, warnings);

    // OnGUI / OnInspectorGUI をUI要素に変換
    const guiMethodBody = methods.guiMethod;
    if (guiMethodBody) {
        // 生コードは常に保存（復元用）
        project.rawGuiMethodBody = guiMethodBody;

        // UI要素への変換を試みる
        const parsedElements = parseGUIElements(guiMethodBody, warnings);

        // 品質判定: カスタムコード（未認識行）の割合をチェック
        const totalElements = parsedElements.length;
        const customCodeCount = parsedElements.filter(
            el => el.type === 'Button' && el.action === 'customCode' && el.label === 'カスタムコード'
        ).length;

        // カスタムコード率が50%超 or 要素が少なすぎる場合は生コードモードを使用
        if (totalElements > 0 && (customCodeCount / totalElements > 0.5 || totalElements <= 2)) {
            // UI要素ツリーへの変換は失敗とみなし、rawのみ使用
            project.elements = [];
            warnings.push('ℹ️ 複雑なGUIコードのため、生コード保持モードで読み込みました');
        } else {
            project.elements = parsedElements;
        }
    }

    // ライフサイクルメソッド（OnEnable, OnDisable等）
    project.lifecycleMethods = methods.lifecycleMethods;

    // カスタムメソッド（上記以外）
    project.customMethods = methods.customMethods;

    // 6. クラス外のコード（同ファイル内のヘルパークラス等）
    project.outerCode = extractOuterCode(content, classBodyResult.classStartLine, classBodyResult.classEndLine, warnings);

    return { project, warnings };
}

/** フォルダ内の複数C#ファイルをパース */
export function parseCSharpFolder(files: { name: string; content: string }[]): ParseResult {
    const warnings: string[] = [];
    const csFiles = files.filter(f => f.name.endsWith('.cs'));

    if (csFiles.length === 0) {
        warnings.push('⚠ C#ファイルが見つかりませんでした');
        return { project: createNewProject('Empty'), warnings };
    }

    // メインファイルをスコアリングで決定
    let bestFile = csFiles[0];
    let bestScore = -1;

    for (const file of csFiles) {
        const score = scoreFile(file.content);
        if (score > bestScore) {
            bestScore = score;
            bestFile = file;
        }
    }

    warnings.push(`📄 メインファイル: ${bestFile.name}`);

    // メインファイルをパース
    const result = parseCSharpFile(bestFile.name, bestFile.content);

    // 他ファイルの情報を追加
    for (const file of csFiles) {
        if (file === bestFile) continue;
        warnings.push(`📄 サブファイル: ${file.name}`);

        // サブファイルのusing文をマージ
        const subUsings = extractUsingStatements(file.content);
        for (const u of subUsings) {
            if (!result.project.usingStatements.includes(u)) {
                result.project.usingStatements.push(u);
            }
        }

        // サブファイルの全コードをouterCodeに追加
        result.project.outerCode.push(`// ===== ${file.name} =====`);
        result.project.outerCode.push(file.content);
    }

    result.warnings.push(...warnings);
    return result;
}

// =====================================================================
// using文の抽出
// =====================================================================

function extractUsingStatements(content: string): string[] {
    const usings: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^using\s+[^(]+;/.test(trimmed)) {
            usings.push(trimmed);
        }
    }
    return usings;
}

// =====================================================================
// スクリプトタイプの検出
// =====================================================================

function detectScriptType(content: string): ScriptType {
    // 継承と属性からスクリプトタイプを検出
    if (/:\s*EditorWindow\b/.test(content)) return 'EditorWindow';
    if (/\[CustomEditor\s*\(/.test(content) || /:\s*Editor\b/.test(content)) return 'CustomEditor';
    if (/:\s*MonoBehaviour\b/.test(content)) return 'MonoBehaviour';
    if (/:\s*ScriptableObject\b/.test(content)) return 'ScriptableObject';
    if (/\[SettingsProvider\]/.test(content) || /SettingsProvider/.test(content)) return 'SettingsProvider';
    if (/:\s*PropertyDrawer\b/.test(content)) return 'PropertyDrawer';
    if (/:\s*AssetPostprocessor\b/.test(content)) return 'MonoBehaviour'; // 近い
    return 'EditorWindow';
}

// =====================================================================
// 設定の抽出
// =====================================================================

function extractSettings(content: string, _scriptType: ScriptType, _warnings: string[]): ProjectSettings {
    const settings = createDefaultSettings();

    // クラス名
    const classMatch = content.match(/(?:public\s+)?(?:static\s+)?class\s+(\w+)/);
    if (classMatch) {
        settings.className = classMatch[1];
    }

    // namespace
    const nsMatch = content.match(/namespace\s+([\w.]+)/);
    if (nsMatch) {
        settings.namespaceName = nsMatch[1];
    }

    // インターフェース実装
    const interfaceMatch = content.match(/class\s+\w+\s*:\s*[^{]+/);
    if (interfaceMatch) {
        const parts = interfaceMatch[0].split(':')[1];
        if (parts) {
            const tokens = parts.split(',').map(t => t.trim()).filter(t => t.length > 0);
            // 最初のトークンは基底クラスの可能性がある
            const baseClasses = ['EditorWindow', 'Editor', 'MonoBehaviour', 'ScriptableObject', 'PropertyDrawer', 'AssetPostprocessor'];
            const interfaces: string[] = [];
            for (const token of tokens) {
                const cleanToken = token.replace(/\s*{.*$/, '').trim();
                if (!baseClasses.some(bc => cleanToken.includes(bc)) && cleanToken.length > 0) {
                    interfaces.push(cleanToken);
                }
            }
            settings.interfaces = interfaces;
        }
    }

    // クラス属性
    settings.classAttributes = extractClassAttributes(content, settings.className, _warnings);

    // MenuItem
    const menuMatch = content.match(/\[MenuItem\s*\(\s*"([^"]+)"/);
    if (menuMatch) {
        settings.menuPath = menuMatch[1];
    }

    // ウィンドウタイトル
    const titleMatch = content.match(/GetWindow(?:<\w+>)?\s*\(\s*"([^"]+)"/)
        || content.match(/titleContent\s*=\s*new\s+GUIContent\s*\(\s*"([^"]+)"/);
    if (titleMatch) {
        settings.windowTitle = titleMatch[1];
    }

    // CustomEditor対象
    const ceMatch = content.match(/\[CustomEditor\s*\(\s*typeof\s*\(\s*(\w+)\s*\)\s*\)/);
    if (ceMatch) {
        settings.targetTypeName = ceMatch[1];
    }

    // SettingsProvider
    const spMatch = content.match(/new\s+SettingsProvider\s*\(\s*"([^"]+)"\s*,\s*SettingsScope\.(\w+)/);
    if (spMatch) {
        settings.settingsPath = spMatch[1];
        settings.settingsScope = spMatch[2] as 'User' | 'Project';
    }

    // AddComponentMenu
    const acmMatch = content.match(/\[AddComponentMenu\s*\(\s*"([^"]+)"/);
    if (acmMatch) {
        settings.menuPath = acmMatch[1];
    }

    // CreateAssetMenu
    const camMatch = content.match(/\[CreateAssetMenu\s*\([^)]*menuName\s*=\s*"([^"]+)"/);
    if (camMatch) {
        settings.createMenuPath = camMatch[1];
    }

    // HelpURL
    const helpMatch = content.match(/\[HelpURL\s*\(\s*"([^"]+)"/);
    if (helpMatch) {
        settings.addHelpURL = true;
        settings.helpURL = helpMatch[1];
    }

    return settings;
}

/** クラス直前の属性を抽出 */
function extractClassAttributes(content: string, className: string, _warnings: string[]): string[] {
    const attrs: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // クラス定義行を見つけたら、直前の属性行を集める
        if (trimmed.includes(`class ${className}`) && /\bclass\s+/.test(trimmed)) {
            // 上に遡って属性を取得
            let j = i - 1;
            while (j >= 0) {
                const attrLine = lines[j].trim();
                if (/^\[/.test(attrLine) && !attrLine.startsWith('//')) {
                    // MenuItem, CustomEditor はsettingsで別処理するのでスキップ
                    if (!/^\[MenuItem\s*\(/.test(attrLine) && !/^\[CustomEditor\s*\(/.test(attrLine)) {
                        attrs.unshift(attrLine);
                    }
                } else if (/^\/\/\/?\s*/.test(attrLine) || attrLine === '') {
                    j--;
                    continue;
                } else {
                    break;
                }
                j--;
            }
            break;
        }
    }
    return attrs;
}

// =====================================================================
// クラス本体の抽出
// =====================================================================

interface ClassBodyResult {
    body: string;
    classStartLine: number;
    classEndLine: number;
}

function extractMainClassBody(content: string, className: string, _warnings: string[]): ClassBodyResult | null {
    const lines = content.split('\n');

    // クラス定義行を探す
    let classDefLine = -1;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/\bclass\s+/.test(trimmed) && trimmed.includes(className)) {
            classDefLine = i;
            break;
        }
    }

    if (classDefLine === -1) {
        // クラス名がマッチしない場合、最初のclass定義を使う
        for (let i = 0; i < lines.length; i++) {
            if (/\bclass\s+\w+/.test(lines[i].trim())) {
                classDefLine = i;
                break;
            }
        }
    }

    if (classDefLine === -1) return null;

    // クラスの開き波括弧を見つける
    let braceStart = -1;
    for (let i = classDefLine; i < lines.length; i++) {
        const idx = lines[i].indexOf('{');
        if (idx !== -1) {
            braceStart = i;
            break;
        }
    }

    if (braceStart === -1) return null;

    // 対応する閉じ波括弧を見つける
    let depth = 0;
    let braceEnd = -1;
    let inString = false;
    let inChar = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = braceStart; i < lines.length; i++) {
        const line = lines[i];
        inLineComment = false;

        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            const next = c + 1 < line.length ? line[c + 1] : '';

            if (inBlockComment) {
                if (ch === '*' && next === '/') {
                    inBlockComment = false;
                    c++;
                }
                continue;
            }
            if (inLineComment) continue;
            if (inString) {
                if (ch === '\\') { c++; continue; }
                if (ch === '"') inString = false;
                continue;
            }
            if (inChar) {
                if (ch === '\\') { c++; continue; }
                if (ch === '\'') inChar = false;
                continue;
            }

            if (ch === '/' && next === '/') { inLineComment = true; continue; }
            if (ch === '/' && next === '*') { inBlockComment = true; c++; continue; }
            if (ch === '"') { inString = true; continue; }
            if (ch === '\'') { inChar = true; continue; }

            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    braceEnd = i;
                    break;
                }
            }
        }
        if (braceEnd !== -1) break;
    }

    if (braceEnd === -1) return null;

    // クラス本体（最初と最後の波括弧を除く）
    const bodyLines = lines.slice(braceStart + 1, braceEnd);
    return {
        body: bodyLines.join('\n'),
        classStartLine: classDefLine,
        classEndLine: braceEnd,
    };
}

// =====================================================================
// 内部クラス/enum/struct の抽出
// =====================================================================

function extractInnerTypes(classBody: string, _warnings: string[]): string[] {
    const innerTypes: string[] = [];
    const lines = classBody.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // class/enum/struct定義を検出
        const typeMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+)?(?:sealed\s+|abstract\s+)?(class|enum|struct)\s+\w+/);
        if (typeMatch) {
            // enum, struct, class の全体をブレース対応で取得
            const block = extractBraceBlock(lines, i);
            if (block) {
                // 属性行も含める（直前の[Serializable]等）
                let attrStart = i;
                while (attrStart > 0 && /^\s*\[/.test(lines[attrStart - 1])) {
                    attrStart--;
                }
                const attrLines = attrStart < i ? lines.slice(attrStart, i).join('\n') + '\n' : '';
                innerTypes.push(attrLines + block.text);
                i = block.endLine; // ブロック末尾までスキップ
            }
        }
    }
    return innerTypes;
}

// =====================================================================
// フィールド宣言の抽出
// =====================================================================

function extractFieldDeclarations(classBody: string, _warnings: string[]): string[] {
    const fields: string[] = [];
    const lines = classBody.split('\n');

    // 内部型やメソッドの範囲を除外するため、深さ追跡
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // 波括弧の深さを追跡
        for (const ch of trimmed) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }

        // depth > 0 なら内部型/メソッド内なのでスキップ
        if (depth > 0) continue;

        // 空行・コメント行はスキップ
        if (trimmed === '' || trimmed.startsWith('//')) continue;

        // メソッド/クラス/enum/struct定義はスキップ
        if (/\b(class|enum|struct|void|private\s+void|public\s+void|protected\s+void|static\s+void|public\s+override|private\s+static|public\s+static\s+void)\b/.test(trimmed) &&
            /\(/.test(trimmed)) continue;
        if (/^(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+)?(?:sealed\s+|abstract\s+)?(class|enum|struct)\s+/.test(trimmed)) continue;

        // フィールド/プロパティ/定数のパターン
        const fieldPattern = /^(?:\[.+\]\s*)?(?:public|private|protected|internal|static|readonly|const|volatile|new)\s+/;
        const simpleFieldPattern = /^\w[\w<>\[\],\s]+\s+\w+\s*[=;{]/;
        const attributeLine = /^\[.*\]\s*$/;

        if (fieldPattern.test(trimmed) && !trimmed.includes('(') && (trimmed.includes(';') || trimmed.includes('='))) {
            // 直前の属性行があれば含める
            let attrPrefix = '';
            let j = i - 1;
            while (j >= 0 && /^\s*\[/.test(lines[j]) && lines[j].trim().endsWith(']')) {
                attrPrefix = lines[j].trim() + '\n' + attrPrefix;
                j--;
            }
            fields.push(attrPrefix + trimmed);
        } else if (attributeLine.test(trimmed) && i + 1 < lines.length) {
            // 属性行の次のフィールド行をまとめてキャプチャ
            // → 次のイテレーション時にフィールドとして属性ごとキャプチャされるので、今はスキップ
            continue;
        } else if (simpleFieldPattern.test(trimmed) && !trimmed.includes('(') && trimmed.endsWith(';')) {
            fields.push(trimmed);
        } else if (/^(?:public|private|protected|internal|static)\s+/.test(trimmed) && /=>\s*/.test(trimmed)) {
            // プロパティのアロー構文 (e.g., public static bool Enabled { get => ... })
            // 複数行の可能性があるのでブレースブロックで取得
            if (trimmed.includes('{')) {
                const block = extractBraceBlock(lines, i);
                if (block) {
                    fields.push(block.text);
                    i = block.endLine;
                }
            } else {
                fields.push(trimmed);
            }
        } else if (/^(?:public|private|protected|internal|static)\s+/.test(trimmed) && trimmed.includes('{')) {
            // プロパティ定義 (e.g., public int X { get; set; })
            if (/\bget\b|\bset\b/.test(trimmed) || /=>\s*/.test(trimmed)) {
                const block = extractBraceBlock(lines, i);
                if (block) {
                    fields.push(block.text);
                    i = block.endLine;
                }
            }
        } else if (/^const\s+/.test(trimmed)) {
            fields.push(trimmed);
        }
    }
    return fields;
}

// =====================================================================
// メソッドの分類と抽出
// =====================================================================

interface MethodsResult {
    guiMethod: string | null;
    lifecycleMethods: string[];
    customMethods: string[];
}

const GUI_METHOD_NAMES = ['OnGUI', 'OnInspectorGUI'];
const LIFECYCLE_METHOD_NAMES = [
    'OnEnable', 'OnDisable', 'OnDestroy', 'OnFocus', 'OnLostFocus',
    'Awake', 'Start', 'Update', 'LateUpdate', 'FixedUpdate',
    'OnValidate', 'Reset', 'OnDrawGizmos', 'OnDrawGizmosSelected',
];

function extractMethods(classBody: string, _warnings: string[]): MethodsResult {
    const result: MethodsResult = {
        guiMethod: null,
        lifecycleMethods: [],
        customMethods: [],
    };

    const lines = classBody.split('\n');
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // 波括弧の深さを追跡（内部型スキップ用）
        // ただし内部型の中にあるメソッドはスキップ
        // ここでは depth==0 でメソッド定義を探す

        // 内部型のスキップ
        if (/^(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+)?(?:sealed\s+|abstract\s+)?(class|enum|struct)\s+/.test(trimmed)) {
            const block = extractBraceBlock(lines, i);
            if (block) {
                i = block.endLine;
                continue;
            }
        }

        // 深さ0でメソッド定義を検出
        const methodMatch = trimmed.match(
            /^(?:(?:public|private|protected|internal)\s+)?(?:(?:static|override|virtual|abstract|sealed|new|async)\s+)*(?:[\w<>\[\],.\s]+?)\s+(\w+)\s*\(/
        );

        if (methodMatch && depth === 0) {
            const methodName = methodMatch[1];

            // メソッド全体をブロック取得
            const block = extractBraceBlock(lines, i);
            if (!block) continue;

            // XML doc コメント + 属性も含める
            let fullMethod = '';
            let j = i - 1;
            const prependLines: string[] = [];
            while (j >= 0) {
                const prevTrimmed = lines[j].trim();
                if (prevTrimmed.startsWith('///') || prevTrimmed.startsWith('//') || /^\[/.test(prevTrimmed) || prevTrimmed === '') {
                    prependLines.unshift(lines[j]);
                    j--;
                } else {
                    break;
                }
            }
            // 末尾の空行は除去
            while (prependLines.length > 0 && prependLines[0].trim() === '') {
                prependLines.shift();
            }
            if (prependLines.length > 0) {
                fullMethod = prependLines.join('\n') + '\n';
            }
            fullMethod += block.text;

            if (GUI_METHOD_NAMES.includes(methodName)) {
                // GUIメソッドの中身だけ取得（本体のみ）
                result.guiMethod = extractMethodBody(block.text);
            } else if (LIFECYCLE_METHOD_NAMES.includes(methodName)) {
                result.lifecycleMethods.push(fullMethod);
            } else if (methodName === 'ShowWindow' || methodName === 'Open') {
                // ShowWindow等はMenuItemとセットなのでカスタムメソッドとして保持
                result.customMethods.push(fullMethod);
            } else {
                result.customMethods.push(fullMethod);
            }

            i = block.endLine;
        } else {
            // 波括弧深さ追跡
            for (const ch of trimmed) {
                if (ch === '{') depth++;
                if (ch === '}') depth--;
            }
            if (depth < 0) depth = 0;
        }
    }

    return result;
}

/** メソッドの本体（最初の{〜最後の}の中身）を取得 */
function extractMethodBody(methodText: string): string {
    const lines = methodText.split('\n');
    let firstBrace = -1;
    let lastBrace = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('{') && firstBrace === -1) {
            firstBrace = i;
        }
        if (lines[i].includes('}')) {
            lastBrace = i;
        }
    }

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return '';

    return lines.slice(firstBrace + 1, lastBrace).join('\n');
}

// =====================================================================
// クラス外のコード取得
// =====================================================================

function extractOuterCode(content: string, _classStartLine: number, classEndLine: number, _warnings: string[]): string[] {
    const lines = content.split('\n');
    const outerParts: string[] = [];

    // using文の後、クラス定義の前にあるコード
    // クラス定義の後にあるコード（namespace閉じの前）

    // クラス終了行の後にある追加クラスを取得
    const afterClass = lines.slice(classEndLine + 1);
    const afterContent = afterClass.join('\n').trim();

    // namespace閉じの波括弧を除去
    if (afterContent.length > 0) {
        // using文以外で実質コードがあればouterCodeに追加
        const cleaned = afterContent.replace(/^\s*}\s*$/, '').trim();
        if (cleaned.length > 0 && !/^}\s*$/.test(cleaned)) {
            // 追加のクラス等がある
            // 各classブロックをチャンクとして抽出
            const chunks = cleaned.split(/\n(?=\s*(?:public|internal|static|sealed|abstract)?\s*(?:class|enum|struct)\s+)/);
            for (const chunk of chunks) {
                const tc = chunk.trim();
                if (tc.length > 0 && tc !== '}') {
                    outerParts.push(tc);
                }
            }
        }
    }

    return outerParts;
}

// =====================================================================
// OnGUI/OnInspectorGUI のUI要素パース
// =====================================================================

function parseGUIElements(guiBody: string, warnings: string[]): UIElement[] {
    const elements: UIElement[] = [];
    const lines = guiBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // コメント行はスキップ
        if (line.startsWith('//')) { i++; continue; }

        // ボイラープレートのスキップ
        if (isBoilerplateLine(line)) { i++; continue; }

        // レイアウトブロック
        const layoutResult = tryParseLayoutBlock(lines, i, warnings);
        if (layoutResult) {
            elements.push(layoutResult.element);
            i = layoutResult.nextLine;
            continue;
        }

        // ボタン + if ブロック
        const buttonResult = tryParseButtonBlock(lines, i, warnings);
        if (buttonResult) {
            elements.push(buttonResult.element);
            i = buttonResult.nextLine;
            continue;
        }

        // 個別UI要素
        const singleElement = tryParseSingleElement(line);
        if (singleElement) {
            elements.push(singleElement);
            i++;
            continue;
        }

        // メソッド呼び出し（DrawXxx等）はCustomCodeとして保持
        if (/^\w+\s*\(/.test(line) || /^(var|if|else|for|foreach|while|switch|return|break|continue)\b/.test(line)) {
            // 複雑な制御構造はCustomCodeとして保持
            const block = tryExtractStatementBlock(lines, i);
            if (block) {
                const customEl = makeCustomCodeElement(block.text);
                elements.push(customEl);
                i = block.nextLine;
                continue;
            }
        }

        // 認識できない行もCustomCodeとして保持
        if (line.length > 0 && line !== '{' && line !== '}') {
            const customEl = makeCustomCodeElement(line);
            elements.push(customEl);
        }
        i++;
    }

    return elements;
}

// =====================================================================
// ボイラープレート判定
// =====================================================================

function isBoilerplateLine(line: string): boolean {
    const patterns = [
        // serializedObject操作
        /^serializedObject\.(Update|ApplyModifiedProperties)\(\)/,
        // ターゲットキャスト
        /^var\s+\w+\s*=\s*\(?\w+\)?\s*target\s*;/,
        // base呼び出し
        /^base\.\w+\(\)/,
        /^Repaint\(\)\s*;?$/,
        // スペース系 (SpaceはUI要素としてパースするためボイラープレートから除外)
        // /^(?:Editor)?GUILayout\.Space\s*\(\s*\d*\s*\)\s*;?$/,
        // /^EditorGUILayout\.Space\s*;?$/,
        /^GUILayout\.FlexibleSpace\s*\(\s*\)\s*;?$/,
        // BeginChangeCheck / EndChangeCheck
        /^EditorGUI\.BeginChangeCheck\s*\(\s*\)\s*;?$/,
        /^EditorGUI\.EndChangeCheck\s*\(\s*\)/,
        // Undo
        /^Undo\.RecordObject\s*\(/,
        // SetDirty
        /^EditorUtility\.SetDirty\s*\(/,
        // GUIUtility
        /^GUIUtility\.\w+\s*\(/,
        // GUIStyle変数宣言（new GUIStyle(...)）
        /^var\s+\w+Style\s*=\s*new\s+GUIStyle\s*\(/,
        // GUIContent
        /^var\s+\w+\s*=\s*new\s+GUIContent\s*\(/,
        // スタイル設定行
        /^\w+Style\.\w+\s*=/,
        // 波括弧のみ
        /^[{}]$/,
        // EditorGUI.DrawRect
        /^EditorGUI\.DrawRect\s*\(/,
        // Event.current
        /^if\s*\(\s*Event\.current\.(type|rawType)/,
        // ExitGUI
        /^GUIUtility\.ExitGUI\s*\(\s*\)\s*;?$/,
        // EditorGUI.indentLevel
        /^EditorGUI\.indentLevel\s*(\+\+|--|\+=|-=)/,
        // Draw系メソッド呼び出し（ユーザー定義のDraw関数）
        /^Draw\w+\s*\(/,
        // 単純なメソッド呼び出し（引数なしまたは引数付き）
        /^\w+\s*\(\s*[\w,.\s]*\)\s*;$/,
    ];
    return patterns.some(p => p.test(line));
}

// =====================================================================
// レイアウトブロックのパース
// =====================================================================

interface ParseBlockResult {
    element: UIElement;
    nextLine: number;
}

function tryParseLayoutBlock(lines: string[], startIndex: number, warnings: string[]): ParseBlockResult | null {
    const line = lines[startIndex];

    // BeginHorizontal / EndHorizontal
    if (/(?:Editor)?GUILayout\.BeginHorizontal\s*\(/.test(line)) {
        return parseLayoutGroup(lines, startIndex, 'Horizontal', /(?:Editor)?GUILayout\.EndHorizontal/, '水平グループ', warnings);
    }

    // BeginVertical / EndVertical
    // BeginVertical("box") - Boxとして
    if (/(?:Editor)?GUILayout\.BeginVertical\s*\(\s*"box"/.test(line)) {
        return parseLayoutGroup(lines, startIndex, 'Box', /(?:Editor)?GUILayout\.EndVertical/, 'ボックス', warnings);
    }
    // 通常のBeginVertical
    if (/(?:Editor)?GUILayout\.BeginVertical\s*\(/.test(line)) {
        return parseLayoutGroup(lines, startIndex, 'Vertical', /(?:Editor)?GUILayout\.EndVertical/, '垂直グループ', warnings);
    }

    // BeginScrollView / EndScrollView
    if (/(?:Editor)?GUILayout\.BeginScrollView\s*\(/.test(line)) {
        return parseLayoutGroup(lines, startIndex, 'ScrollView', /(?:Editor)?GUILayout\.EndScrollView/, 'スクロールビュー', warnings);
    }

    // Foldout (ifブロックとして出現することが多い)
    const foldoutMatch = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.Foldout\s*\(\s*\1\s*,\s*"([^"]+)"/);
    if (foldoutMatch) {
        // Foldoutの中身を取得 (次の行からifブロックを探す)
        // 簡易実装: インデントレベルで判断するか、ブロック抽出を使う
        return parseLayoutGroup(lines, startIndex, 'Foldout', null, foldoutMatch[2], warnings);
    }

    // BeginDisabledGroup
    if (/EditorGUI\.BeginDisabledGroup\s*\(/.test(line)) {
        // DisabledGroupは特殊: UI要素としてはコンテナだが、見た目上の枠はない
        // ここではVerticalとして扱い、無効化フラグをつけるなどの対応ができるとベスト
        // 一旦はコンテナとしてパース
        return parseLayoutGroup(lines, startIndex, 'Vertical', /EditorGUI\.EndDisabledGroup/, '無効化グループ', warnings);
    }

    return null;
}

/** レイアウトグループの中身を再帰的にパース */
function parseLayoutGroup(lines: string[], startIndex: number, type: ElementType, endPattern: RegExp | null, label: string, warnings: string[]): ParseBlockResult {
    // 終了行を探す
    let endIndex = -1;

    if (endPattern) {
        endIndex = findMatchingEnd(lines, startIndex, endPattern);
    } else {
        // パターンがない場合（Foldoutなど）、次のifブロックを探す
        // Foldoutの場合: lines[startIndex] は bool = Foldout(...)
        // 次の行が if (bool) { ... } であることを期待
        if (startIndex + 1 < lines.length && lines[startIndex + 1].trim().startsWith('if')) {
            const ifBlock = extractBraceBlock(lines, startIndex + 1);
            if (ifBlock) {
                // ifブロックの中身だけをパース対象にする
                // 開始行と終了行はifブロックの波括弧
                // 再帰パースのために行リストを渡すが、インデックス管理が複雑になるため
                // ここでは単純にブロック内テキストをパースしてchildrenにする
                const innerElements = parseGUIElements(ifBlock.text.split('\n').slice(1, -1).join('\n'), warnings);

                const element = makeElement(type, label, '');
                element.children = innerElements;

                return {
                    element,
                    nextLine: ifBlock.endLine + 1,
                };
            }
        }
    }

    if (endIndex === -1 && endPattern) {
        warnings.push(`⚠ レイアウトブロックの閉じるメソッドが見つかりません: ${lines[startIndex]}`);
        return {
            element: makeElement(type, label, ''),
            nextLine: startIndex + 1,
        };
    }

    // ブロック内の中身を取り出す
    // 開始行と終了行を除く
    const innerLines = lines.slice(startIndex + 1, endIndex);
    const innerText = innerLines.join('\n');
    const innerElements = parseGUIElements(innerText, warnings);

    const element = makeElement(type, label, '');
    element.children = innerElements;

    return {
        element,
        nextLine: endIndex + 1,
    };
}

// =====================================================================
// ボタンブロックのパース
// =====================================================================

function tryParseButtonBlock(lines: string[], startIndex: number, warnings: string[]): ParseBlockResult | null {
    const line = lines[startIndex];

    // if (GUILayout.Button("Label")) { ... }
    const match = line.match(/if\s*\(\s*(?:Editor)?GUILayout\.Button\s*\(\s*"([^"]+)"/);
    if (match) {
        const label = match[1];
        const block = extractBraceBlock(lines, startIndex);

        const el = makeElement('Button', label, '');
        el.action = 'customCode';

        if (block) {
            // ブロックの中身をactionParamにする（中括弧除く）
            const innerCode = block.text.split('\n').slice(1, -1).join('\n').trim();
            el.actionParam = innerCode;
            return { element: el, nextLine: block.endLine + 1 };
        } else {
            // 単一行if
            el.actionParam = '// 行内アクション';
            return { element: el, nextLine: startIndex + 1 };
        }
    }
    return null;
}

// =====================================================================
// 個別UI要素のパース
// =====================================================================

function tryParseSingleElement(line: string): UIElement | null {
    // EditorGUILayout.TextField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.TextField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('TextField', m[2], m[1]);
    }
    // EditorGUILayout.TextArea
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.TextArea\s*\(/);
        if (m) return makeElement('TextArea', m[1], m[1]);
    }
    // EditorGUILayout.IntField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.IntField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('IntField', m[2], m[1]);
    }
    // EditorGUILayout.FloatField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.FloatField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('FloatField', m[2], m[1]);
    }
    // EditorGUILayout.Slider
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.Slider\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('Slider', m[2], m[1]);
    }
    // EditorGUILayout.IntSlider
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.IntSlider\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('IntSlider', m[2], m[1]);
    }
    // EditorGUILayout.Toggle / GUILayout.Toggle
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|GUILayout|EditorGUI)\.Toggle\s*\(\s*(?:"([^"]+)")?/);
        if (m) return makeElement('Toggle', m[2] ?? m[1], m[1]);
    }
    // EditorGUILayout.ColorField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.ColorField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('ColorField', m[2], m[1]);
    }
    // EditorGUILayout.Vector2Field
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.Vector2Field\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('Vector2Field', m[2], m[1]);
    }
    // EditorGUILayout.Vector3Field
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.Vector3Field\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('Vector3Field', m[2], m[1]);
    }
    // EditorGUILayout.ObjectField
    {
        const m = line.match(/(\w+)\s*=\s*\(?\s*\w*\)?\s*(?:EditorGUILayout|EditorGUI)\.ObjectField\s*\(\s*"([^"]+)"/);
        if (m) {
            const el = makeElement('ObjectField', m[2], m[1]);
            if (line.includes('true')) el.allowSceneObjects = true;
            if (line.includes('false')) el.allowSceneObjects = false;
            const typeMatch = line.match(/typeof\s*\(\s*([\w.]+)\s*\)/);
            if (typeMatch) el.objectType = typeMatch[1];
            return el;
        }
        // ラベルなし
        const m2 = line.match(/(\w+)\s*=\s*\(?\s*(\w+)\)?\s*(?:EditorGUILayout|EditorGUI)\.ObjectField\s*\(/);
        if (m2) {
            const el = makeElement('ObjectField', m2[1], m2[1]);
            if (m2[2] && m2[2] !== 'Object' && m2[2] !== 'EditorGUILayout') el.objectType = m2[2];
            const typeMatch = line.match(/typeof\s*\(\s*([\w.]+)\s*\)/);
            if (typeMatch) el.objectType = typeMatch[1];
            return el;
        }
    }
    // HelpBox
    {
        const m = line.match(/EditorGUILayout\.HelpBox\s*\(\s*"([^"]*)"\s*,\s*MessageType\.(\w+)\s*\)/);
        if (m) {
            const el = makeElement('HelpBox', m[1], '');
            el.defaultValue = m[1];
            el.helpBoxType = m[2] as any;
            return el;
        }
    }
    // Space
    {
        const m = line.match(/(?:Editor)?GUILayout\.Space\s*\(\s*(\d+)?\s*\)/);
        if (m) {
            const el = makeElement('Space', 'Space', '');
            el.spaceHeight = m[1] ? parseInt(m[1]) : 10;
            return el;
        }
    }
    // Separator
    {
        if (line.includes('GUI.skin.horizontalSlider')) {
            return makeElement('Separator', 'Separator', '');
        }
    }
    // EditorGUILayout.EnumPopup
    {
        const m = line.match(/(\w+)\s*=\s*\(?[^)]*\)?\s*(?:EditorGUILayout|EditorGUI)\.EnumPopup\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('EnumPopup', m[2], m[1]);
        const m2 = line.match(/(\w+)\s*=\s*\(?[^)]*\)?\s*(?:EditorGUILayout|EditorGUI)\.EnumPopup\s*\(/);
        if (m2) return makeElement('EnumPopup', m2[1], m2[1]);
    }
    // EditorGUILayout.Popup
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.Popup\s*\(\s*(?:"([^"]+)")?/);
        if (m) return makeElement('Popup', m[2] ?? m[1], m[1]);
    }
    // EditorGUILayout.LayerField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.LayerField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('LayerField', m[2], m[1]);
    }
    // EditorGUILayout.TagField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.TagField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('TagField', m[2], m[1]);
    }
    // EditorGUILayout.CurveField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.CurveField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('CurveField', m[2], m[1]);
    }
    // EditorGUILayout.GradientField
    {
        const m = line.match(/(\w+)\s*=\s*(?:EditorGUILayout|EditorGUI)\.GradientField\s*\(\s*"([^"]+)"/);
        if (m) return makeElement('GradientField', m[2], m[1]);
    }
    // GUILayout.Label / EditorGUILayout.LabelField
    {
        const m = line.match(/(?:GUILayout\.Label|EditorGUILayout\.LabelField)\s*\(\s*"([^"]+)"/);
        if (m) {
            if (/EditorStyles\.boldLabel/.test(line)) {
                const el = makeElement('Header', m[1], '');
                el.headerText = m[1];
                return el;
            }
            return makeElement('Label', m[1], '');
        }
        const m2 = line.match(/(?:GUILayout\.Label|EditorGUILayout\.LabelField)\s*\(\s*(\$?"[^"]*"|[\w.]+)/);
        if (m2) return makeElement('Label', m2[1].replace(/"/g, ''), '');
    }
    // GUILayout.Toolbar (TabGroupとして)
    {
        const m = line.match(/(\w+)\s*=\s*\(?[^)]*\)?\s*GUILayout\.Toolbar\s*\(/);
        if (m) {
            const el = makeElement('TabGroup', m[1], m[1]);
            el.children = [];
            const tabsMatch = line.match(/new\s*(?:string\s*\[\])?\s*\{\s*([^}]+)\}/);
            if (tabsMatch) {
                el.tabs = tabsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''));
            }
            return el;
        }
    }

    return null;
}

// =====================================================================
// ヘルパーユーティリティ
// =====================================================================

/** CustomCode用のUI要素を作成 */
function makeCustomCodeElement(code: string): UIElement {
    return {
        id: crypto.randomUUID(),
        type: 'Button', // カスタムコードとしてボタン型で保持
        label: 'カスタムコード',
        variableName: '',
        action: 'customCode',
        actionParam: code,
    };
}

/** UI要素のインスタンスを作成 */
function makeElement(type: ElementType, label: string, varName: string): UIElement {
    return {
        id: crypto.randomUUID(),
        type,
        label,
        variableName: varName,
    };
}

/** ブレースで囲まれたブロックの抽出 */
function extractBraceBlock(lines: string[], startLine: number): { text: string; endLine: number } | null {
    // startLine以降で最初の{を見つける
    let braceStart = -1;
    for (let i = startLine; i < lines.length; i++) {
        if (lines[i].includes('{')) {
            braceStart = i;
            break;
        }
    }
    if (braceStart === -1) return null;

    let depth = 0;
    for (let i = braceStart; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return {
                        text: lines.slice(startLine, i + 1).join('\n'),
                        endLine: i,
                    };
                }
            }
        }
    }
    return null;
}

/** 対応するEnd行を見つける */
function findMatchingEnd(lines: string[], startIndex: number, endPattern: RegExp): number {
    let depth = 1;
    const beginPattern = lines[startIndex].match(/(Begin\w+)/)?.[1];
    const beginRegex = beginPattern ? new RegExp(beginPattern.replace('Begin', 'Begin')) : null;

    for (let i = startIndex + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // ネストされたBeginを検出
        if (beginRegex && beginRegex.test(trimmed)) depth++;
        if (endPattern.test(trimmed)) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** 対応する閉じ波括弧を見つける */
function findMatchingBrace(lines: string[], startIndex: number): number {
    let depth = 0;
    let foundOpen = false;

    for (let i = startIndex; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') {
                depth++;
                foundOpen = true;
            }
            if (ch === '}') {
                depth--;
                if (foundOpen && depth === 0) return i;
            }
        }
    }
    return -1;
}

/** 文ブロック（if/for/foreach等）を抽出 */
function tryExtractStatementBlock(lines: string[], startIndex: number): { text: string; nextLine: number } | null {
    const line = lines[startIndex];

    // 単一行（セミコロンで終わる）
    if (line.endsWith(';')) {
        return { text: line, nextLine: startIndex + 1 };
    }

    // ブロック文
    if (line.includes('{') || (startIndex + 1 < lines.length && lines[startIndex + 1]?.trim() === '{')) {
        const braceEnd = findMatchingBrace(lines, startIndex);
        if (braceEnd !== -1) {
            return {
                text: lines.slice(startIndex, braceEnd + 1).join('\n'),
                nextLine: braceEnd + 1,
            };
        }
    }

    return { text: line, nextLine: startIndex + 1 };
}

/** ファイルのスコアリング（メインファイル判定用） */
function scoreFile(content: string): number {
    let score = 0;
    if (/:\s*EditorWindow\b/.test(content)) score += 10;
    if (/:\s*Editor\b/.test(content)) score += 8;
    if (/\[CustomEditor/.test(content)) score += 8;
    if (/OnGUI|OnInspectorGUI/.test(content)) score += 5;
    if (/\[MenuItem/.test(content)) score += 3;
    if (/:\s*MonoBehaviour\b/.test(content)) score += 2;
    if (/:\s*ScriptableObject\b/.test(content)) score += 2;
    return score;
}
