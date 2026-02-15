// ===========================
// コード生成 - 基本ロジック
// ===========================
import type { ScriptCraftProject, UIElement, ScriptType } from '../types/editor';

/** インデントを生成 */
function indent(level: number): string {
    return '    '.repeat(level);
}

/** 変数のC#型を取得 */
function getCSharpType(element: UIElement): string {
    switch (element.type) {
        case 'TextField':
        case 'TextArea':
        case 'TagField':
            return 'string';
        case 'IntField':
        case 'IntSlider':
        case 'Popup':
        case 'LayerField':
            return 'int';
        case 'FloatField':
        case 'Slider':
        case 'ProgressBar':
            return 'float';
        case 'Toggle':
            return 'bool';
        case 'ColorField':
            return 'Color';
        case 'Vector2Field':
            return 'Vector2';
        case 'Vector3Field':
            return 'Vector3';
        case 'ObjectField':
            return element.objectType || 'Object';
        case 'EnumPopup':
            return 'int'; // Enum はユーザー定義型なので int で代替
        case 'CurveField':
            return 'AnimationCurve';
        case 'GradientField':
            return 'Gradient';
        case 'Foldout':
            return 'bool';
        case 'TabGroup':
            return 'int';
        default:
            return 'object';
    }
}

/** 変数のデフォルト値を取得 */
function getDefaultValue(element: UIElement): string {
    if (element.defaultValue) return element.defaultValue;
    switch (element.type) {
        case 'TextField':
        case 'TextArea':
            return '""';
        case 'IntField':
        case 'IntSlider':
        case 'Popup':
        case 'LayerField':
            return '0';
        case 'FloatField':
        case 'ProgressBar':
            return '0f';
        case 'Slider':
            return '0.5f';
        case 'Toggle':
            return 'false';
        case 'ColorField':
            return 'Color.white';
        case 'Vector2Field':
            return 'Vector2.zero';
        case 'Vector3Field':
            return 'Vector3.zero';
        case 'ObjectField':
            return 'null';
        case 'CurveField':
            return 'new AnimationCurve()';
        case 'GradientField':
            return 'new Gradient()';
        case 'Foldout':
            return element.foldoutDefault ? 'true' : 'false';
        case 'TabGroup':
            return '0';
        default:
            return 'null';
    }
}

/** 変数宣言が必要かどうか */
function needsVariable(element: UIElement): boolean {
    const noVarTypes = ['Button', 'Label', 'HelpBox', 'Space', 'Separator', 'Header',
        'HorizontalGroup', 'VerticalGroup', 'ScrollView', 'DisabledGroup', 'Box'];
    return !noVarTypes.includes(element.type);
}

/** 全要素をフラット化（子要素を含む） */
function flattenElements(elements: UIElement[]): UIElement[] {
    const result: UIElement[] = [];
    for (const el of elements) {
        result.push(el);
        if (el.children) {
            result.push(...flattenElements(el.children));
        }
    }
    return result;
}

/** 変数宣言を生成 */
function generateVariableDeclarations(elements: UIElement[], indentLevel: number): string {
    const flat = flattenElements(elements);
    const lines: string[] = [];

    for (const el of flat) {
        if (needsVariable(el)) {
            const csType = getCSharpType(el);
            const defaultVal = getDefaultValue(el);
            lines.push(`${indent(indentLevel)}private ${csType} ${el.variableName} = ${defaultVal};`);
        }
    }

    // ScrollView用のscrollPosition
    const hasScrollView = flat.some(el => el.type === 'ScrollView');
    if (hasScrollView) {
        lines.push(`${indent(indentLevel)}private Vector2 scrollPosition;`);
    }

    return lines.join('\n');
}

/** アクションコードを生成 */
function generateActionCode(element: UIElement, indentLevel: number): string {
    if (!element.action || element.action === 'none') return '';

    const ind = indent(indentLevel);
    switch (element.action) {
        case 'debugLog':
            return `${ind}Debug.Log("${element.actionParam || element.label}");`;
        case 'displayDialog':
            return `${ind}EditorUtility.DisplayDialog("${element.label}", "${element.actionParam || ''}", "OK");`;
        case 'repaint':
            return `${ind}Repaint();`;
        case 'setDirty':
            return `${ind}EditorUtility.SetDirty(target);`;
        case 'undoRecord':
            return `${ind}Undo.RecordObject(target, "${element.actionParam || '変更'}");`;
        case 'customCode':
            return element.actionParam
                ? element.actionParam.split('\n').map(line => `${ind}${line}`).join('\n')
                : '';
        default:
            return '';
    }
}

/**
 * UI要素のスタイル設定コードを生成
 * 例: new GUIStyle(EditorStyles.label) { fontSize = 12, fontStyle = FontStyle.Bold }
 */
function getGUIStyleCode(element: UIElement, defaultStyleVariable: string = 'EditorStyles.label'): string | null {
    const hasStyle = element.fontSize || (element.fontStyle && element.fontStyle !== 'Normal') || element.textAlignment || (element.boxStyle && element.boxStyle !== 'box');

    // スタイル変更がなく、boxStyleも指定されていない場合はnull
    if (!hasStyle && !element.boxStyle) return null;

    let baseStyle: string;
    if (element.boxStyle) {
        // 文字列指定の場合は引用符で囲む
        baseStyle = `"${element.boxStyle}"`;
    } else {
        baseStyle = defaultStyleVariable;
    }

    const initializers: string[] = [];
    if (element.fontSize) initializers.push(`fontSize = ${element.fontSize}`);
    if (element.fontStyle && element.fontStyle !== 'Normal') initializers.push(`fontStyle = FontStyle.${element.fontStyle}`);
    if (element.textAlignment) initializers.push(`alignment = TextAnchor.${element.textAlignment}`);

    if (initializers.length === 0) {
        if (element.boxStyle) return baseStyle;
        return null;
    }

    return `new GUIStyle(${baseStyle}) { ${initializers.join(', ')} }`;
}

/** UI要素の描画コードを生成 */
function generateElementCode(element: UIElement, indentLevel: number, scriptType: ScriptType): string {
    const ind = indent(indentLevel);
    const lines: string[] = [];

    // スタイル引数の生成ヘルパー
    const withStyle = (code: string, styleBase: string = 'EditorStyles.label') => {
        const styleCode = getGUIStyleCode(element, styleBase);
        if (!styleCode) return code;

        // コードの最後の閉じカッコの前にスタイル引数を追加
        // 例: EditorGUILayout.TextField("Label", text) -> EditorGUILayout.TextField("Label", text, style)
        // 注意: params引数がある場合などは単純に追加できない場合があるが、基本的なフィールドではこれでいける
        if (code.endsWith(');')) {
            return code.slice(0, -2) + `, ${styleCode});`;
        }
        return code;
    };

    switch (element.type) {
        case 'Button':
            {
                const styleCode = getGUIStyleCode(element, '"button"');
                const args = [`"${element.label}"`];
                if (styleCode) args.push(styleCode);

                lines.push(`${ind}if (GUILayout.Button(${args.join(', ')}))`);
                lines.push(`${ind}{`);
                {
                    const actionCode = generateActionCode(element, indentLevel + 1);
                    if (actionCode) {
                        lines.push(actionCode);
                    } else {
                        lines.push(`${indent(indentLevel + 1)}// TODO: ボタンのアクション`);
                    }
                }
                lines.push(`${ind}}`);
            }
            break;

        case 'TextField':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.TextField("${element.label}", ${element.variableName});`, 'EditorStyles.textField'));
            break;

        case 'TextArea':
            lines.push(`${ind}EditorGUILayout.LabelField("${element.label}");`);
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.TextArea(${element.variableName}, GUILayout.Height(60));`, 'EditorStyles.textArea'));
            break;

        case 'IntField':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.IntField("${element.label}", ${element.variableName});`, 'EditorStyles.numberField'));
            break;

        case 'FloatField':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.FloatField("${element.label}", ${element.variableName});`, 'EditorStyles.numberField'));
            break;

        case 'Slider':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.Slider("${element.label}", ${element.variableName}, ${element.minValue ?? 0}f, ${element.maxValue ?? 1}f);`);
            break;

        case 'IntSlider':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.IntSlider("${element.label}", ${element.variableName}, ${element.minValue ?? 0}, ${element.maxValue ?? 100});`);
            break;

        case 'Toggle':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.Toggle("${element.label}", ${element.variableName});`, 'EditorStyles.toggle'));
            break;

        case 'ColorField':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.ColorField("${element.label}", ${element.variableName});`);
            break;

        case 'Vector2Field':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.Vector2Field("${element.label}", ${element.variableName});`);
            break;

        case 'Vector3Field':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.Vector3Field("${element.label}", ${element.variableName});`);
            break;

        case 'ObjectField':
            lines.push(`${ind}${element.variableName} = (${element.objectType || 'Object'})EditorGUILayout.ObjectField("${element.label}", ${element.variableName}, typeof(${element.objectType || 'Object'}), ${element.allowSceneObjects ?? true});`);
            break;

        case 'EnumPopup':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.Popup("${element.label}", ${element.variableName}, System.Enum.GetNames(typeof(${element.objectType || 'Space'})));`, 'EditorStyles.popup'));
            break;

        case 'Popup':
            {
                const options = element.popupOptions?.map(o => `"${o}"`).join(', ') || '"選択肢1", "選択肢2"';
                lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.Popup("${element.label}", ${element.variableName}, new string[] { ${options} });`, 'EditorStyles.popup'));
            }
            break;

        case 'LayerField':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.LayerField("${element.label}", ${element.variableName});`);
            break;

        case 'TagField':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.TagField("${element.label}", ${element.variableName});`);
            break;

        case 'CurveField':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.CurveField("${element.label}", ${element.variableName});`);
            break;

        case 'GradientField':
            lines.push(`${ind}${element.variableName} = EditorGUILayout.GradientField("${element.label}", ${element.variableName});`);
            break;

        case 'Label':
            {
                const styleCode = getGUIStyleCode(element, 'EditorStyles.label');
                const args = [`"${element.label}"`];
                if (styleCode) args.push(styleCode);
                lines.push(`${ind}EditorGUILayout.LabelField(${args.join(', ')});`);
            }
            break;

        case 'HelpBox':
            lines.push(`${ind}EditorGUILayout.HelpBox("${element.defaultValue || element.label}", MessageType.${element.helpBoxType || 'Info'});`);
            break;

        case 'Space':
            lines.push(`${ind}EditorGUILayout.Space(${element.spaceHeight || 10});`);
            break;

        case 'Separator':
            lines.push(`${ind}EditorGUILayout.LabelField("", GUI.skin.horizontalSlider);`);
            break;

        case 'Header':
            {
                // HeaderはデフォルトでboldLabelを使うが、スタイル指定がある場合はそれを優先（あるいはマージ）
                // ここではEditorStyles.boldLabelをデフォルトとして、スタイル指定があれば上書き
                const styleCode = getGUIStyleCode(element, 'EditorStyles.boldLabel');
                const args = [`"${element.headerText || element.label}"`, styleCode || 'EditorStyles.boldLabel'];
                lines.push(`${ind}EditorGUILayout.LabelField(${args.join(', ')});`);
            }
            break;

        case 'ProgressBar':
            lines.push(`${ind}EditorGUI.ProgressBar(EditorGUILayout.GetControlRect(false, 20), ${element.variableName}, "${element.label}");`);
            break;

        case 'HorizontalGroup':
            lines.push(`${ind}EditorGUILayout.BeginHorizontal();`);
            if (element.children) {
                for (const child of element.children) {
                    lines.push(generateElementCode(child, indentLevel, scriptType));
                }
            }
            lines.push(`${ind}EditorGUILayout.EndHorizontal();`);
            break;

        case 'VerticalGroup':
            lines.push(`${ind}EditorGUILayout.BeginVertical();`);
            if (element.children) {
                for (const child of element.children) {
                    lines.push(generateElementCode(child, indentLevel, scriptType));
                }
            }
            lines.push(`${ind}EditorGUILayout.EndVertical();`);
            break;

        case 'Foldout':
            lines.push(withStyle(`${ind}${element.variableName} = EditorGUILayout.Foldout(${element.variableName}, "${element.label}", true);`, 'EditorStyles.foldout'));
            lines.push(`${ind}if (${element.variableName})`);
            lines.push(`${ind}{`);
            lines.push(`${indent(indentLevel + 1)}EditorGUI.indentLevel++;`);
            if (element.children) {
                for (const child of element.children) {
                    lines.push(generateElementCode(child, indentLevel + 1, scriptType));
                }
            }
            lines.push(`${indent(indentLevel + 1)}EditorGUI.indentLevel--;`);
            lines.push(`${ind}}`);
            break;

        case 'ScrollView':
            lines.push(`${ind}scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);`);
            if (element.children) {
                for (const child of element.children) {
                    lines.push(generateElementCode(child, indentLevel, scriptType));
                }
            }
            lines.push(`${ind}EditorGUILayout.EndScrollView();`);
            break;

        case 'DisabledGroup':
            lines.push(`${ind}EditorGUI.BeginDisabledGroup(${element.disableCondition || 'false'});`);
            if (element.children) {
                for (const child of element.children) {
                    lines.push(generateElementCode(child, indentLevel, scriptType));
                }
            }
            lines.push(`${ind}EditorGUI.EndDisabledGroup();`);
            break;

        case 'Box':
            {
                const styleCode = getGUIStyleCode(element, '"box"');
                const args = styleCode ? [styleCode] : ['"box"'];
                lines.push(`${ind}EditorGUILayout.BeginVertical(${args.join(', ')});`);
                if (element.children) {
                    for (const child of element.children) {
                        lines.push(generateElementCode(child, indentLevel, scriptType));
                    }
                }
                lines.push(`${ind}EditorGUILayout.EndVertical();`);
            }
            break;

        case 'TabGroup':
            {
                const tabLabels = element.tabs?.map(t => `"${t}"`).join(', ') || '"タブ1", "タブ2"';
                lines.push(`${ind}${element.variableName} = GUILayout.Toolbar(${element.variableName}, new string[] { ${tabLabels} });`);
                lines.push(`${ind}switch (${element.variableName})`);
                lines.push(`${ind}{`);
                if (element.tabs) {
                    element.tabs.forEach((tab, i) => {
                        lines.push(`${indent(indentLevel + 1)}case ${i}: // ${tab}`);
                        // タブに対応する子要素があればここに
                        lines.push(`${indent(indentLevel + 2)}break;`);
                    });
                }
                lines.push(`${ind}}`);
            }
            break;
    }

    return lines.join('\n');
}

/** 全UI要素の描画コードを生成 */
function generateAllElementsCode(elements: UIElement[], indentLevel: number, scriptType: ScriptType): string {
    return elements.map(el => generateElementCode(el, indentLevel, scriptType)).join('\n\n');
}

// ===========================
// using文の生成ヘルパー
// ===========================

/** プロジェクトのusing文を生成（保持分 + デフォルト） */
function generateUsingStatements(project: ScriptCraftProject, defaults: string[]): string {
    const usings = new Set<string>();

    // プロジェクトで保持されたusing文を優先
    if (project.usingStatements && project.usingStatements.length > 0) {
        for (const u of project.usingStatements) {
            usings.add(u);
        }
    }

    // デフォルトを追加（まだ含まれていなければ）
    for (const d of defaults) {
        if (![...usings].some(u => u.includes(d.replace('using ', '').replace(';', '')))) {
            usings.add(d);
        }
    }

    return [...usings].join('\n');
}

/** クラス宣言行を生成（インターフェース・属性含む） */
function generateClassDeclaration(project: ScriptCraftProject, baseClass: string, indentLevel: number): string[] {
    const lines: string[] = [];
    const ind = indent(indentLevel);
    const settings = project.settings;

    // クラス属性（保持分）
    if (settings.classAttributes && settings.classAttributes.length > 0) {
        for (const attr of settings.classAttributes) {
            lines.push(`${ind}${attr}`);
        }
    }

    // クラス宣言
    let classLine = `${ind}public class ${settings.className} : ${baseClass}`;
    if (settings.interfaces && settings.interfaces.length > 0) {
        classLine += `, ${settings.interfaces.join(', ')}`;
    }
    lines.push(classLine);

    return lines;
}

/** 保持されたフィールド・内部型・ライフサイクルメソッド・カスタムメソッドを出力 */
function generatePreservedCode(project: ScriptCraftProject, indentLevel: number): string {
    const lines: string[] = [];
    const ind = indent(indentLevel);

    // 保持されたフィールド宣言
    if (project.fieldDeclarations && project.fieldDeclarations.length > 0) {
        lines.push('');
        lines.push(`${ind}// === フィールド宣言（インポート時保持） ===`);
        for (const field of project.fieldDeclarations) {
            // 複数行フィールドはそのままインデント
            const fieldLines = field.split('\n');
            for (const fl of fieldLines) {
                lines.push(`${ind}${fl.trim()}`);
            }
        }
    }

    // 内部クラス/enum/struct
    if (project.innerTypes && project.innerTypes.length > 0) {
        lines.push('');
        lines.push(`${ind}// === 内部型定義（インポート時保持） ===`);
        for (const innerType of project.innerTypes) {
            lines.push('');
            const typeLines = innerType.split('\n');
            for (const tl of typeLines) {
                lines.push(`${ind}${tl.trim()}`);
            }
        }
    }

    // ライフサイクルメソッド
    if (project.lifecycleMethods && project.lifecycleMethods.length > 0) {
        lines.push('');
        for (const method of project.lifecycleMethods) {
            lines.push('');
            const methodLines = method.split('\n');
            for (const ml of methodLines) {
                lines.push(`${ind}${ml.trim()}`);
            }
        }
    }

    // カスタムメソッド
    if (project.customMethods && project.customMethods.length > 0) {
        lines.push('');
        for (const method of project.customMethods) {
            lines.push('');
            const methodLines = method.split('\n');
            for (const ml of methodLines) {
                lines.push(`${ind}${ml.trim()}`);
            }
        }
    }

    return lines.join('\n');
}

/** GUIメソッドの中身を出力（rawGuiMethodBody優先） */
function generateGuiMethodContent(project: ScriptCraftProject, indentLevel: number, scriptType: ScriptType): string {
    const ind = indent(indentLevel);

    // rawGuiMethodBodyがあれば優先（複雑なGUIコードの場合）
    if (project.rawGuiMethodBody && project.elements.length === 0) {
        const rawLines = project.rawGuiMethodBody.split('\n');
        return rawLines.map(l => `${ind}${l.trimStart()}`).join('\n');
    }

    // UI要素配列から生成
    if (project.elements.length > 0) {
        return generateAllElementsCode(project.elements, indentLevel, scriptType);
    }

    return `${ind}// UI要素をパレットから追加してください`;
}

/** outerCode (ヘルパークラス等) を出力 */
function generateOuterCode(project: ScriptCraftProject): string {
    if (!project.outerCode || project.outerCode.length === 0) return '';

    const lines: string[] = ['', '// === 追加コード（インポート時保持） ==='];
    for (const code of project.outerCode) {
        lines.push(code);
    }
    return lines.join('\n');
}

// ===========================
// スクリプト種類ごとのテンプレート
// ===========================

function generateEditorWindow(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEditor;', 'using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    // クラス宣言
    const classDecl = generateClassDeclaration(project, 'EditorWindow', 0);
    lines.push(...classDecl);
    lines.push('{');
    lines.push(`    [MenuItem("${settings.menuPath}")]`);
    lines.push(`    public static void ShowWindow()`);
    lines.push(`    {`);
    lines.push(`        GetWindow<${settings.className}>("${settings.windowTitle}");`);
    lines.push(`    }`);
    lines.push('');

    // 保持されたフィールド宣言
    const preserved = generatePreservedCode(project, 1);

    // UI要素用の変数宣言（保持フィールドと重複しないもの）
    const vars = generateVariableDeclarations(elements, 1);
    if (vars) {
        lines.push(vars);
        lines.push('');
    }

    if (preserved) {
        lines.push(preserved);
    }

    // OnGUI
    lines.push('');
    lines.push('    private void OnGUI()');
    lines.push('    {');
    lines.push(generateGuiMethodContent(project, 2, 'EditorWindow'));
    lines.push('    }');
    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

function generateCustomEditor(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEditor;', 'using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    const targetType = settings.targetTypeName || 'MonoBehaviour';
    lines.push(`[CustomEditor(typeof(${targetType}))]`);

    // クラス宣言
    const classDecl = generateClassDeclaration(project, 'Editor', 0);
    lines.push(...classDecl);
    lines.push('{');

    // 保持されたフィールド
    const preserved = generatePreservedCode(project, 1);

    // 変数宣言
    const vars = generateVariableDeclarations(elements, 1);
    if (vars) {
        lines.push(vars);
        lines.push('');
    }

    if (preserved) {
        lines.push(preserved);
    }

    lines.push('');
    lines.push('    public override void OnInspectorGUI()');
    lines.push('    {');
    if (project.rawGuiMethodBody && elements.length === 0) {
        // 生コードモード: serializedObject.Update/Apply は生コード中に含まれている
        lines.push(generateGuiMethodContent(project, 2, 'CustomEditor'));
    } else {
        lines.push('        serializedObject.Update();');
        lines.push('');
        lines.push(generateGuiMethodContent(project, 2, 'CustomEditor'));
        lines.push('');
        lines.push('        serializedObject.ApplyModifiedProperties();');
    }
    lines.push('    }');
    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

function generateMonoBehaviour(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    if (settings.requireComponents?.length) {
        for (const comp of settings.requireComponents) {
            lines.push(`[RequireComponent(typeof(${comp}))]`);
        }
    }

    if (settings.addHelpURL && settings.helpURL) {
        lines.push(`[HelpURL("${settings.helpURL}")]`);
    }

    // クラス宣言
    const classDecl = generateClassDeclaration(project, 'MonoBehaviour', 0);
    lines.push(...classDecl);
    lines.push('{');

    // 保持されたフィールド
    const preserved = generatePreservedCode(project, 1);

    // フィールド宣言
    const flat = flattenElements(elements);
    for (const el of flat) {
        if (needsVariable(el)) {
            const csType = getCSharpType(el);
            const defaultVal = getDefaultValue(el);
            lines.push(`    [SerializeField] private ${csType} ${el.variableName} = ${defaultVal};`);
        }
    }

    if (preserved) {
        lines.push(preserved);
    }

    // ライフサイクルメソッドが保持されていなければデフォルトを生成
    const hasStart = project.lifecycleMethods?.some(m => /\bStart\b/.test(m));
    const hasUpdate = project.lifecycleMethods?.some(m => /\bUpdate\b/.test(m));
    if (!hasStart && !project.lifecycleMethods?.length) {
        lines.push('');
        lines.push('    private void Start()');
        lines.push('    {');
        lines.push('        // 初期化処理');
        lines.push('    }');
    }
    if (!hasUpdate && !project.lifecycleMethods?.length) {
        lines.push('');
        lines.push('    private void Update()');
        lines.push('    {');
        lines.push('        // 毎フレーム処理');
        lines.push('    }');
    }
    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

function generateScriptableObject(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    lines.push(`[CreateAssetMenu(fileName = "New${settings.className}", menuName = "${settings.createMenuPath || 'ScriptCraft/' + settings.className}")]`);

    // クラス宣言
    const classDecl = generateClassDeclaration(project, 'ScriptableObject', 0);
    lines.push(...classDecl);
    lines.push('{');

    // 保持されたフィールド
    const preserved = generatePreservedCode(project, 1);

    // フィールド宣言
    const flat = flattenElements(elements);
    for (const el of flat) {
        if (needsVariable(el)) {
            const csType = getCSharpType(el);
            const defaultVal = getDefaultValue(el);
            lines.push(`    [SerializeField] private ${csType} ${el.variableName} = ${defaultVal};`);
        }
    }

    if (preserved) {
        lines.push(preserved);
    }

    // プロパティ（ゲッター）
    lines.push('');
    for (const el of flat) {
        if (needsVariable(el)) {
            const csType = getCSharpType(el);
            const propName = el.variableName.charAt(0).toUpperCase() + el.variableName.slice(1);
            lines.push(`    public ${csType} ${propName} => ${el.variableName};`);
        }
    }

    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

function generateSettingsProvider(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEditor;', 'using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    // クラス宣言
    const classDecl = generateClassDeclaration(project, 'SettingsProvider', 0);
    lines.push(...classDecl);
    lines.push('{');

    // 保持されたフィールド
    const preserved = generatePreservedCode(project, 1);

    // 変数宣言
    const vars = generateVariableDeclarations(elements, 1);
    if (vars) {
        lines.push(vars);
        lines.push('');
    }

    if (preserved) {
        lines.push(preserved);
    }

    const scope = settings.settingsScope === 'Project' ? 'SettingsScope.Project' : 'SettingsScope.User';
    lines.push(`    public ${settings.className}(string path, SettingsScope scope = ${scope})`);
    lines.push('        : base(path, scope) { }');
    lines.push('');
    lines.push('    public override void OnGUI(string searchContext)');
    lines.push('    {');
    lines.push(generateGuiMethodContent(project, 2, 'SettingsProvider'));
    lines.push('    }');
    lines.push('');
    lines.push(`    [SettingsProvider]`);
    lines.push(`    public static SettingsProvider Create${settings.className}()`);
    lines.push(`    {`);
    lines.push(`        return new ${settings.className}("${settings.settingsPath || 'Preferences/' + settings.className}");`);
    lines.push(`    }`);
    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

function generatePropertyDrawer(project: ScriptCraftProject): string {
    const { settings, elements } = project;
    const lines: string[] = [];

    // using文
    lines.push(generateUsingStatements(project, ['using UnityEditor;', 'using UnityEngine;']));
    lines.push('');

    if (settings.namespaceName) {
        lines.push(`namespace ${settings.namespaceName}`);
        lines.push('{');
    }

    // 属性クラス
    lines.push(`public class ${settings.targetAttributeName || 'MyAttribute'}Attribute : PropertyAttribute`);
    lines.push('{');
    lines.push('}');
    lines.push('');

    // Drawer クラス
    lines.push(`[CustomPropertyDrawer(typeof(${settings.targetAttributeName || 'MyAttribute'}Attribute))]`);

    const classDecl = generateClassDeclaration(project, 'PropertyDrawer', 0);
    lines.push(...classDecl);
    lines.push('{');

    // 保持されたフィールド
    const preserved = generatePreservedCode(project, 1);
    if (preserved) {
        lines.push(preserved);
    }

    lines.push('    public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)');
    lines.push('    {');
    if (project.rawGuiMethodBody && elements.length === 0) {
        lines.push(generateGuiMethodContent(project, 2, 'PropertyDrawer'));
    } else {
        lines.push('        EditorGUI.BeginProperty(position, label, property);');
        lines.push('');
        lines.push(generateGuiMethodContent(project, 2, 'PropertyDrawer'));
        lines.push('');
        lines.push('        EditorGUI.EndProperty();');
    }
    lines.push('    }');
    lines.push('}');

    if (settings.namespaceName) {
        lines.push('}');
    }

    // outerCode
    const outer = generateOuterCode(project);
    if (outer) lines.push(outer);

    return lines.join('\n');
}

// ===========================
// メインのコード生成関数
// ===========================
export function generateCode(project: ScriptCraftProject): string {
    const generators: Record<ScriptType, (p: ScriptCraftProject) => string> = {
        EditorWindow: generateEditorWindow,
        CustomEditor: generateCustomEditor,
        MonoBehaviour: generateMonoBehaviour,
        ScriptableObject: generateScriptableObject,
        SettingsProvider: generateSettingsProvider,
        PropertyDrawer: generatePropertyDrawer,
    };

    return generators[project.scriptType](project);
}
