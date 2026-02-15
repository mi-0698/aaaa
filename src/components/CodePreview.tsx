import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useProject } from '../store/projectStore';
import { generateCode } from '../generators/base';

export function CodePreview() {
    const { state } = useProject();
    const { project } = state;

    const code = useMemo(() => generateCode(project), [project]);

    return (
        <div className="code-preview">
            <div className="code-preview-header">
                <h2>コードプレビュー</h2>
                <span className="file-name">{project.settings.className}.cs</span>
            </div>
            <div className="code-preview-content">
                <Editor
                    height="100%"
                    language="csharp"
                    value={code}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        padding: { top: 8 },
                    }}
                />
            </div>
        </div>
    );
}
