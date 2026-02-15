import { useState } from 'react';
import { useProject } from '../store/projectStore';
import {
    SCRIPT_TYPE_LABELS,
    SCRIPT_TYPE_DESCRIPTIONS,
    type ScriptType,
} from '../types/editor';
import { generateCode } from '../generators/base';
import { parseCSharpFile, parseCSharpFolder } from '../parsers/csParser';
import { TUTORIAL_PROJECT, TUTORIAL_ALL_NODES_PROJECT } from '../constants/tutorial';

export function Header() {
    const { state, dispatch } = useProject();
    const { project } = state;
    const [importLog, setImportLog] = useState<string[] | null>(null);

    const handleScriptTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        dispatch({ type: 'SET_SCRIPT_TYPE', scriptType: e.target.value as ScriptType });
    };

    const handleNewProject = () => {
        if (confirm('現在のプロジェクトを破棄して新規作成しますか？')) {
            dispatch({ type: 'NEW_PROJECT' });
        }
    };

    const handleExportJSON = () => {
        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.settings.className}.scriptcraft.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportJSON = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                dispatch({ type: 'LOAD_PROJECT', project: data });
            } catch {
                alert('ファイルの読み込みに失敗しました。');
            }
        };
        input.click();
    };

    /** C#ファイル読み込み */
    const handleImportCSharp = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cs';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const result = parseCSharpFile(file.name, text);
                dispatch({ type: 'LOAD_PROJECT', project: result.project });
                if (result.warnings.length > 0) {
                    setImportLog(result.warnings);
                }
            } catch (err) {
                alert(`C#ファイルの読み込みに失敗しました: ${err}`);
            }
        };
        input.click();
    };

    /** フォルダ読み込み（複数C#ファイル） */
    const handleImportFolder = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cs';
        input.multiple = true;
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.onchange = async (e) => {
            const fileList = (e.target as HTMLInputElement).files;
            if (!fileList || fileList.length === 0) return;

            try {
                const files: { name: string; content: string }[] = [];
                for (const file of Array.from(fileList)) {
                    if (file.name.endsWith('.cs')) {
                        const text = await file.text();
                        files.push({ name: file.name, content: text });
                    }
                }

                if (files.length === 0) {
                    alert('フォルダ内にC#ファイルが見つかりませんでした。');
                    return;
                }

                const result = parseCSharpFolder(files);
                dispatch({ type: 'LOAD_PROJECT', project: result.project });
                if (result.warnings.length > 0) {
                    setImportLog(result.warnings);
                }
            } catch (err) {
                alert(`フォルダの読み込みに失敗しました: ${err}`);
            }
        };
        input.click();
    };

    const handleLoadTutorial = (type: 'basic' | 'allNodes') => {
        if (confirm('現在のプロジェクトを破棄してチュートリアルを読み込みますか？')) {
            const project = type === 'basic' ? TUTORIAL_PROJECT : TUTORIAL_ALL_NODES_PROJECT;
            const cloned = JSON.parse(JSON.stringify(project));
            dispatch({ type: 'LOAD_PROJECT', project: cloned });
        }
    };

    const handleDownloadCode = () => {
        const code = generateCode(project);
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.settings.className}.cs`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyCode = async () => {
        const code = generateCode(project);
        await navigator.clipboard.writeText(code);
        const btn = document.querySelector('.copy-btn') as HTMLElement;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✓ コピー完了';
            setTimeout(() => { btn.textContent = original; }, 1500);
        }
    };

    return (
        <>
            <header className="app-header">
                <div className="header-left">
                    <h1 className="app-title">
                        <span className="app-icon">🔨</span>
                        Script Craft
                    </h1>
                    <div className="header-actions">
                        <button className="btn btn-ghost" onClick={handleNewProject} title="新規プロジェクト">
                            📄 新規
                        </button>
                        <TutorialMenu onSelect={handleLoadTutorial} />
                        <div className="btn-group">
                            <button className="btn btn-ghost" onClick={handleImportJSON} title="JSONプロジェクトを開く">
                                📂 開く
                            </button>
                            <button className="btn btn-ghost btn-import-cs" onClick={handleImportCSharp} title="既存のC#ファイルを読み込み">
                                📥 C#読込
                            </button>
                            <button className="btn btn-ghost btn-import-folder" onClick={handleImportFolder} title="フォルダごとC#ファイルを読み込み">
                                📁 フォルダ読込
                            </button>
                        </div>
                        <button className="btn btn-ghost" onClick={handleExportJSON} title="JSONエクスポート">
                            💾 保存
                        </button>
                    </div>
                </div>
                <div className="header-center">
                    <div className="script-type-selector">
                        <label>スクリプト種類:</label>
                        <select value={project.scriptType} onChange={handleScriptTypeChange}>
                            {Object.entries(SCRIPT_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <span className="script-type-desc">
                            {SCRIPT_TYPE_DESCRIPTIONS[project.scriptType]}
                        </span>
                    </div>
                </div>
                <div className="header-right">
                    <button className="btn btn-secondary copy-btn" onClick={handleCopyCode}>
                        📋 コピー
                    </button>
                    <button className="btn btn-primary" onClick={handleDownloadCode}>
                        ⬇️ .cs ダウンロード
                    </button>
                </div>
            </header>

            {/* インポートログモーダル */}
            {importLog && (
                <div className="import-log-overlay" onClick={() => setImportLog(null)}>
                    <div className="import-log-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="import-log-header">
                            <h3>📋 読み込み結果</h3>
                            <button className="btn-icon" onClick={() => setImportLog(null)}>✕</button>
                        </div>
                        <div className="import-log-content">
                            {importLog.map((msg, i) => (
                                <div key={i} className={`log-line ${msg.startsWith('  ') ? 'log-indent' : ''}`}>
                                    {msg}
                                </div>
                            ))}
                        </div>
                        <div className="import-log-footer">
                            <button className="btn btn-primary" onClick={() => setImportLog(null)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function TutorialMenu({ onSelect }: { onSelect: (project: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);

    // 遅延インポートのためにここでrequireなどを検討したが
    // TSXなのでトップレベルimportが必要。
    // そのため、Headerコンポーネントの外で定義するか、
    // Header内でインポート済みの定数を使う。

    // 今回は親からハンドラを受け取る形にする。

    return (
        <div className="tutorial-menu" style={{ position: 'relative', display: 'inline-block' }}>
            <button className="btn btn-ghost" onClick={() => setIsOpen(!isOpen)} title="チュートリアル/サンプルをロード">
                🎓 チュートリアル
            </button>
            {isOpen && (
                <>
                    <div className="menu-overlay"
                        style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="menu-dropdown"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            backgroundColor: '#2d2d2d',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            zIndex: 101,
                            minWidth: '200px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                        }}>
                        <button className="menu-item"
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                            onClick={() => { onSelect('basic'); setIsOpen(false); }}>
                            🔰 インタラクティブデモ
                        </button>
                        <button className="menu-item"
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                            onClick={() => { onSelect('allNodes'); setIsOpen(false); }}>
                            📚 全ノードカタログ
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
