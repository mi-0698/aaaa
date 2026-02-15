import { useProject } from '../store/projectStore';
import {
    ELEMENT_DEFINITIONS,
    ACTION_LABELS,
    type ActionType,
    type HelpBoxType,
    type UIElement,
} from '../types/editor';

export function PropertyPanel() {
    const { state, dispatch, selectedElement } = useProject();
    const { project } = state;
    const settings = project.settings;

    const updateElement = (updates: Partial<UIElement>) => {
        if (!selectedElement) return;
        dispatch({ type: 'UPDATE_ELEMENT', elementId: selectedElement.id, updates });
    };

    return (
        <div className="property-panel">
            <div className="property-panel-header">
                <h2>プロパティ</h2>
            </div>
            <div className="property-panel-content">
                {/* ── プロジェクト設定 ── */}
                <div className="property-section">
                    <h3 className="property-section-title">📋 プロジェクト設定</h3>

                    <div className="property-row">
                        <label>クラス名</label>
                        <input
                            type="text"
                            value={settings.className}
                            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { className: e.target.value } })}
                        />
                    </div>

                    {(project.scriptType === 'EditorWindow' || project.scriptType === 'SettingsProvider') && (
                        <div className="property-row">
                            <label>メニューパス</label>
                            <input
                                type="text"
                                value={settings.menuPath}
                                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { menuPath: e.target.value } })}
                            />
                        </div>
                    )}

                    {project.scriptType === 'EditorWindow' && (
                        <div className="property-row">
                            <label>ウィンドウタイトル</label>
                            <input
                                type="text"
                                value={settings.windowTitle}
                                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { windowTitle: e.target.value } })}
                            />
                        </div>
                    )}

                    {project.scriptType === 'CustomEditor' && (
                        <div className="property-row">
                            <label>対象の型名</label>
                            <input
                                type="text"
                                value={settings.targetTypeName}
                                placeholder="例: MyComponent"
                                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { targetTypeName: e.target.value } })}
                            />
                        </div>
                    )}

                    {project.scriptType === 'SettingsProvider' && (
                        <>
                            <div className="property-row">
                                <label>設定パス</label>
                                <input
                                    type="text"
                                    value={settings.settingsPath}
                                    onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { settingsPath: e.target.value } })}
                                />
                            </div>
                            <div className="property-row">
                                <label>スコープ</label>
                                <select
                                    value={settings.settingsScope}
                                    onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { settingsScope: e.target.value as 'User' | 'Project' } })}
                                >
                                    <option value="User">User (Preferences)</option>
                                    <option value="Project">Project (Project Settings)</option>
                                </select>
                            </div>
                        </>
                    )}

                    {project.scriptType === 'PropertyDrawer' && (
                        <div className="property-row">
                            <label>属性名</label>
                            <input
                                type="text"
                                value={settings.targetAttributeName}
                                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { targetAttributeName: e.target.value } })}
                            />
                        </div>
                    )}

                    {project.scriptType === 'ScriptableObject' && (
                        <div className="property-row">
                            <label>作成メニューパス</label>
                            <input
                                type="text"
                                value={settings.createMenuPath}
                                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { createMenuPath: e.target.value } })}
                            />
                        </div>
                    )}

                    <div className="property-row">
                        <label>名前空間</label>
                        <input
                            type="text"
                            value={settings.namespaceName}
                            placeholder="省略可"
                            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { namespaceName: e.target.value } })}
                        />
                    </div>
                </div>

                {/* ── 選択中の要素 ── */}
                {selectedElement && (
                    <div className="property-section">
                        <h3 className="property-section-title">
                            {ELEMENT_DEFINITIONS.find(d => d.type === selectedElement.type)?.icon}{' '}
                            選択中: {ELEMENT_DEFINITIONS.find(d => d.type === selectedElement.type)?.label}
                        </h3>

                        <div className="property-row">
                            <label>ラベル</label>
                            <input
                                type="text"
                                value={selectedElement.label}
                                onChange={(e) => updateElement({ label: e.target.value })}
                            />
                        </div>

                        <div className="property-row">
                            <label>変数名</label>
                            <input
                                type="text"
                                value={selectedElement.variableName}
                                onChange={(e) => updateElement({ variableName: e.target.value })}
                            />
                        </div>

                        {/* デフォルト値 */}
                        {['TextField', 'TextArea', 'IntField', 'FloatField'].includes(selectedElement.type) && (
                            <div className="property-row">
                                <label>初期値</label>
                                <input
                                    type="text"
                                    value={selectedElement.defaultValue ?? ''}
                                    onChange={(e) => updateElement({ defaultValue: e.target.value })}
                                />
                            </div>
                        )}

                        {/* Slider */}
                        {(selectedElement.type === 'Slider' || selectedElement.type === 'IntSlider') && (
                            <>
                                <div className="property-row">
                                    <label>最小値</label>
                                    <input
                                        type="number"
                                        value={selectedElement.minValue ?? 0}
                                        onChange={(e) => updateElement({ minValue: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="property-row">
                                    <label>最大値</label>
                                    <input
                                        type="number"
                                        value={selectedElement.maxValue ?? 1}
                                        onChange={(e) => updateElement({ maxValue: Number(e.target.value) })}
                                    />
                                </div>
                            </>
                        )}

                        {/* Toggle */}
                        {selectedElement.type === 'Toggle' && (
                            <div className="property-row">
                                <label>初期値</label>
                                <select
                                    value={selectedElement.defaultValue ?? 'false'}
                                    onChange={(e) => updateElement({ defaultValue: e.target.value })}
                                >
                                    <option value="false">OFF</option>
                                    <option value="true">ON</option>
                                </select>
                            </div>
                        )}

                        {/* HelpBox */}
                        {selectedElement.type === 'HelpBox' && (
                            <>
                                <div className="property-row">
                                    <label>メッセージ</label>
                                    <textarea
                                        value={selectedElement.defaultValue ?? ''}
                                        onChange={(e) => updateElement({ defaultValue: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div className="property-row">
                                    <label>種類</label>
                                    <select
                                        value={selectedElement.helpBoxType ?? 'Info'}
                                        onChange={(e) => updateElement({ helpBoxType: e.target.value as HelpBoxType })}
                                    >
                                        <option value="None">なし</option>
                                        <option value="Info">情報</option>
                                        <option value="Warning">警告</option>
                                        <option value="Error">エラー</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Space */}
                        {selectedElement.type === 'Space' && (
                            <div className="property-row">
                                <label>高さ (px)</label>
                                <input
                                    type="number"
                                    value={selectedElement.spaceHeight ?? 10}
                                    onChange={(e) => updateElement({ spaceHeight: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        {/* Header */}
                        {selectedElement.type === 'Header' && (
                            <div className="property-row">
                                <label>見出しテキスト</label>
                                <input
                                    type="text"
                                    value={selectedElement.headerText ?? ''}
                                    onChange={(e) => updateElement({ headerText: e.target.value })}
                                />
                            </div>
                        )}

                        {/* ObjectField */}
                        {selectedElement.type === 'ObjectField' && (
                            <>
                                <div className="property-row">
                                    <label>オブジェクト型</label>
                                    <input
                                        type="text"
                                        value={selectedElement.objectType ?? 'Object'}
                                        placeholder="例: GameObject, Texture2D"
                                        onChange={(e) => updateElement({ objectType: e.target.value })}
                                    />
                                </div>
                                <div className="property-row">
                                    <label>シーンオブジェクト許可</label>
                                    <select
                                        value={selectedElement.allowSceneObjects ? 'true' : 'false'}
                                        onChange={(e) => updateElement({ allowSceneObjects: e.target.value === 'true' })}
                                    >
                                        <option value="true">はい</option>
                                        <option value="false">いいえ</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Popup */}
                        {selectedElement.type === 'Popup' && (
                            <div className="property-row">
                                <label>選択肢（改行区切り）</label>
                                <textarea
                                    value={(selectedElement.popupOptions ?? []).join('\\n')}
                                    onChange={(e) => updateElement({ popupOptions: e.target.value.split('\\n') })}
                                    rows={4}
                                />
                            </div>
                        )}

                        {/* Foldout */}
                        {selectedElement.type === 'Foldout' && (
                            <div className="property-row">
                                <label>初期状態</label>
                                <select
                                    value={selectedElement.foldoutDefault ? 'true' : 'false'}
                                    onChange={(e) => updateElement({ foldoutDefault: e.target.value === 'true' })}
                                >
                                    <option value="true">開いた状態</option>
                                    <option value="false">閉じた状態</option>
                                </select>
                            </div>
                        )}

                        {/* TabGroup */}
                        {selectedElement.type === 'TabGroup' && (
                            <div className="property-row">
                                <label>タブ名（改行区切り）</label>
                                <textarea
                                    value={(selectedElement.tabs ?? []).join('\\n')}
                                    onChange={(e) => updateElement({ tabs: e.target.value.split('\\n') })}
                                    rows={4}
                                />
                            </div>
                        )}

                        {/* DisabledGroup */}
                        {selectedElement.type === 'DisabledGroup' && (
                            <div className="property-row">
                                <label>無効化条件</label>
                                <input
                                    type="text"
                                    value={selectedElement.disableCondition ?? 'false'}
                                    placeholder="例: !isEnabled"
                                    onChange={(e) => updateElement({ disableCondition: e.target.value })}
                                />
                            </div>
                        )}

                        {/* Button アクション */}
                        {selectedElement.type === 'Button' && (
                            <>
                                <div className="property-row">
                                    <label>アクション</label>
                                    <select
                                        value={selectedElement.action ?? 'none'}
                                        onChange={(e) => updateElement({ action: e.target.value as ActionType })}
                                    >
                                        {Object.entries(ACTION_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedElement.action && selectedElement.action !== 'none' && (
                                    <div className="property-row">
                                        <label>
                                            {selectedElement.action === 'customCode' ? 'コード' : 'パラメータ'}
                                        </label>
                                        {selectedElement.action === 'customCode' ? (
                                            <textarea
                                                value={selectedElement.actionParam ?? ''}
                                                onChange={(e) => updateElement({ actionParam: e.target.value })}
                                                rows={5}
                                                placeholder="C#コードを入力..."
                                                className="code-input"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={selectedElement.actionParam ?? ''}
                                                onChange={(e) => updateElement({ actionParam: e.target.value })}
                                            />
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── スタイル設定（Box, Label, Header, Button等） ── */}
                        {['Box', 'Label', 'Header', 'Button', 'TextField', 'TextArea'].includes(selectedElement.type) && (
                            <div className="property-section-sub">
                                <h4>スタイル設定</h4>
                                <div className="property-row">
                                    <label>フォントサイズ</label>
                                    <input
                                        type="number"
                                        value={selectedElement.fontSize ?? 12}
                                        onChange={(e) => updateElement({ fontSize: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="property-row">
                                    <label>スタイル</label>
                                    <select
                                        value={selectedElement.fontStyle ?? 'Normal'}
                                        onChange={(e) => updateElement({ fontStyle: e.target.value as any })}
                                    >
                                        <option value="Normal">標準</option>
                                        <option value="Bold">太字</option>
                                        <option value="Italic">斜体</option>
                                        <option value="BoldItalic">太字斜体</option>
                                    </select>
                                </div>
                                <div className="property-row">
                                    <label>配置</label>
                                    <select
                                        value={selectedElement.textAlignment ?? 'Left'}
                                        onChange={(e) => updateElement({ textAlignment: e.target.value as any })}
                                    >
                                        <option value="Left">左揃え</option>
                                        <option value="Center">中央揃え</option>
                                        <option value="Right">右揃え</option>
                                    </select>
                                </div>
                                {selectedElement.type === 'Box' && (
                                    <div className="property-row">
                                        <label>Boxスタイル</label>
                                        <input
                                            type="text"
                                            value={selectedElement.boxStyle ?? 'box'}
                                            placeholder="例: box, window, button"
                                            onChange={(e) => updateElement({ boxStyle: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!selectedElement && (
                    <div className="property-empty">
                        <p>要素を選択するとプロパティが表示されます</p>
                    </div>
                )}
            </div>
        </div>
    );
}
