// ===========================
// Script Craft - 型定義
// ===========================

/** 対応するスクリプト種類 */
export type ScriptType =
  | 'EditorWindow'
  | 'CustomEditor'
  | 'MonoBehaviour'
  | 'ScriptableObject'
  | 'SettingsProvider'
  | 'PropertyDrawer';

export const SCRIPT_TYPE_LABELS: Record<ScriptType, string> = {
  EditorWindow: 'エディタウィンドウ',
  CustomEditor: 'カスタムインスペクター',
  MonoBehaviour: 'コンポーネント (MonoBehaviour)',
  ScriptableObject: 'データアセット (ScriptableObject)',
  SettingsProvider: '設定画面 (SettingsProvider)',
  PropertyDrawer: 'プロパティ描画 (PropertyDrawer)',
};

export const SCRIPT_TYPE_DESCRIPTIONS: Record<ScriptType, string> = {
  EditorWindow: 'メニューから開けるカスタムウィンドウを作成します',
  CustomEditor: 'コンポーネントのインスペクター表示をカスタマイズします',
  MonoBehaviour: 'GameObjectにアタッチするランタイムコンポーネントを作成します',
  ScriptableObject: 'プロジェクトに保存できるデータアセットを作成します',
  SettingsProvider: 'Preferences / Project Settings に設定画面を追加します',
  PropertyDrawer: 'フィールドの描画方法をカスタマイズする属性を作成します',
};

/** UI要素の種類 */
export type ElementType =
  // 入力系
  | 'Button'
  | 'TextField'
  | 'TextArea'
  | 'IntField'
  | 'FloatField'
  | 'Slider'
  | 'IntSlider'
  | 'Toggle'
  | 'ColorField'
  | 'Vector2Field'
  | 'Vector3Field'
  | 'ObjectField'
  | 'EnumPopup'
  | 'Popup'
  | 'LayerField'
  | 'TagField'
  | 'CurveField'
  | 'GradientField'
  // 表示系
  | 'Label'
  | 'HelpBox'
  | 'Space'
  | 'Separator'
  | 'Header'
  | 'ProgressBar'
  // レイアウト系
  | 'HorizontalGroup'
  | 'VerticalGroup'
  | 'Foldout'
  | 'ScrollView'
  | 'DisabledGroup'
  | 'Box'
  | 'TabGroup';

export type ElementCategory = 'input' | 'display' | 'layout';

export interface ElementDefinition {
  type: ElementType;
  label: string;
  category: ElementCategory;
  icon: string;
  description: string;
  hasChildren?: boolean;
}

export const ELEMENT_DEFINITIONS: ElementDefinition[] = [
  // 入力系
  { type: 'Button', label: 'ボタン', category: 'input', icon: '🔘', description: 'クリック可能なボタン' },
  { type: 'TextField', label: 'テキスト入力', category: 'input', icon: '📝', description: '1行テキスト入力' },
  { type: 'TextArea', label: 'テキストエリア', category: 'input', icon: '📄', description: '複数行テキスト入力' },
  { type: 'IntField', label: '整数入力', category: 'input', icon: '🔢', description: '整数値の入力' },
  { type: 'FloatField', label: '小数入力', category: 'input', icon: '🔢', description: '小数値の入力' },
  { type: 'Slider', label: 'スライダー', category: 'input', icon: '🎚️', description: '範囲指定の小数スライダー' },
  { type: 'IntSlider', label: '整数スライダー', category: 'input', icon: '🎚️', description: '範囲指定の整数スライダー' },
  { type: 'Toggle', label: 'トグル', category: 'input', icon: '☑️', description: 'ON/OFF切り替え' },
  { type: 'ColorField', label: '色', category: 'input', icon: '🎨', description: 'カラーピッカー' },
  { type: 'Vector2Field', label: 'Vector2', category: 'input', icon: '📐', description: '2D座標入力' },
  { type: 'Vector3Field', label: 'Vector3', category: 'input', icon: '📐', description: '3D座標入力' },
  { type: 'ObjectField', label: 'オブジェクト参照', category: 'input', icon: '🔗', description: 'アセット/オブジェクト参照' },
  { type: 'EnumPopup', label: '列挙型選択', category: 'input', icon: '📋', description: 'Enum のドロップダウン' },
  { type: 'Popup', label: 'ポップアップ選択', category: 'input', icon: '📋', description: '文字列リストのドロップダウン' },
  { type: 'LayerField', label: 'レイヤー', category: 'input', icon: '🏷️', description: 'レイヤー選択' },
  { type: 'TagField', label: 'タグ', category: 'input', icon: '🏷️', description: 'タグ選択' },
  { type: 'CurveField', label: 'カーブ', category: 'input', icon: '📈', description: 'アニメーションカーブ' },
  { type: 'GradientField', label: 'グラデーション', category: 'input', icon: '🌈', description: 'グラデーション編集' },
  // 表示系
  { type: 'Label', label: 'ラベル', category: 'display', icon: '🏷️', description: 'テキスト表示' },
  { type: 'HelpBox', label: 'ヘルプボックス', category: 'display', icon: '💡', description: '情報/警告/エラー表示' },
  { type: 'Space', label: 'スペース', category: 'display', icon: '↕️', description: '余白の挿入' },
  { type: 'Separator', label: '区切り線', category: 'display', icon: '➖', description: '水平区切り線' },
  { type: 'Header', label: '見出し', category: 'display', icon: '📌', description: 'セクション見出し' },
  { type: 'ProgressBar', label: 'プログレスバー', category: 'display', icon: '📊', description: '進捗バー表示' },
  // レイアウト系
  { type: 'HorizontalGroup', label: '水平グループ', category: 'layout', icon: '↔️', description: '横並びレイアウト', hasChildren: true },
  { type: 'VerticalGroup', label: '垂直グループ', category: 'layout', icon: '↕️', description: '縦並びレイアウト', hasChildren: true },
  { type: 'Foldout', label: 'フォルドアウト', category: 'layout', icon: '📂', description: '折り畳みセクション', hasChildren: true },
  { type: 'ScrollView', label: 'スクロールビュー', category: 'layout', icon: '📜', description: 'スクロール可能エリア', hasChildren: true },
  { type: 'DisabledGroup', label: '無効化グループ', category: 'layout', icon: '🚫', description: '条件付き無効化', hasChildren: true },
  { type: 'Box', label: 'ボックス', category: 'layout', icon: '📦', description: '枠付きグループ', hasChildren: true },
  { type: 'TabGroup', label: 'タブグループ', category: 'layout', icon: '📑', description: 'タブ切り替え', hasChildren: true },
];

/** アクション種類 */
export type ActionType =
  | 'none'
  | 'debugLog'
  | 'displayDialog'
  | 'repaint'
  | 'setDirty'
  | 'undoRecord'
  | 'customCode';

export const ACTION_LABELS: Record<ActionType, string> = {
  none: 'なし',
  debugLog: 'Debug.Log',
  displayDialog: 'ダイアログ表示',
  repaint: '再描画 (Repaint)',
  setDirty: '変更フラグ (SetDirty)',
  undoRecord: 'Undo記録',
  customCode: 'カスタムコード',
};

/** HelpBoxのメッセージタイプ */
export type HelpBoxType = 'None' | 'Info' | 'Warning' | 'Error';

/** UI要素のインスタンスデータ */
export interface UIElement {
  id: string;
  type: ElementType;
  label: string;
  variableName: string;
  // 値関連
  defaultValue?: string;
  minValue?: number;
  maxValue?: number;
  // アクション（ボタン用）
  action?: ActionType;
  actionParam?: string;
  // HelpBox用
  helpBoxType?: HelpBoxType;
  // ObjectField用
  objectType?: string;
  allowSceneObjects?: boolean;
  // Space用
  spaceHeight?: number;
  // Foldout用
  foldoutDefault?: boolean;
  // 子要素（レイアウト系）
  children?: UIElement[];
  // Popup用
  popupOptions?: string[];
  // ProgressBar用
  progressValue?: number;
  // Tab用
  tabs?: string[];
  // DisabledGroup用
  disableCondition?: string;
  // Header用
  headerText?: string;
  // スタイル関連 (Box, Label, Header等)
  fontSize?: number;
  fontStyle?: 'Normal' | 'Bold' | 'Italic' | 'BoldItalic';
  textAlignment?: 'Left' | 'Center' | 'Right';
  boxStyle?: string; // "box", "window", "button" 等のGUIStyle名
}

/** プロジェクト設定 */
export interface ProjectSettings {
  className: string;
  menuPath: string;
  windowTitle: string;
  // CustomEditor用
  targetTypeName: string;
  // SettingsProvider用
  settingsPath: string;
  settingsScope: 'User' | 'Project';
  // PropertyDrawer用
  targetAttributeName: string;
  // ScriptableObject用
  createMenuPath: string;
  // MonoBehaviour用
  requireComponents: string[];
  // 共通
  namespaceName: string;
  addHelpURL: boolean;
  helpURL: string;
  // インターフェース実装 (例: "IEditorOnly")
  interfaces: string[];
  // クラス属性 (例: "[AddComponentMenu(...)]", "[DisallowMultipleComponent]")
  classAttributes: string[];
}

/** プロジェクト全体のデータ */
export interface ScriptCraftProject {
  id: string;
  name: string;
  scriptType: ScriptType;
  settings: ProjectSettings;
  elements: UIElement[];
  createdAt: string;
  updatedAt: string;
  // === C#コード保持 ===
  /** using 文 (例: ["using System;", "using System.Collections.Generic;"]) */
  usingStatements: string[];
  /** フィールド宣言部分（OnGUI外のクラスメンバー変数） */
  fieldDeclarations: string[];
  /** カスタムメソッド（OnGUI以外のメソッド） */
  customMethods: string[];
  /** 内部クラス・enum・struct定義 */
  innerTypes: string[];
  /** OnEnable/OnDisable等のライフサイクルメソッド */
  lifecycleMethods: string[];
  /** クラス外のコード（ヘルパークラスなど） */
  outerCode: string[];
  /** OnGUI/OnInspectorGUIの生コード（UI要素変換が困難なとき使用） */
  rawGuiMethodBody: string;
}

/** デフォルト設定を生成 */
export function createDefaultSettings(): ProjectSettings {
  return {
    className: 'MyTool',
    menuPath: 'Tools/My Tool',
    windowTitle: 'My Tool',
    targetTypeName: '',
    settingsPath: 'Preferences/My Settings',
    settingsScope: 'User',
    targetAttributeName: 'MyAttribute',
    createMenuPath: 'ScriptCraft/My Data',
    requireComponents: [],
    namespaceName: '',
    addHelpURL: false,
    helpURL: '',
    interfaces: [],
    classAttributes: [],
  };
}

/** 新しいUI要素を生成 */
export function createUIElement(type: ElementType): UIElement {
  const def = ELEMENT_DEFINITIONS.find(d => d.type === type);
  const id = crypto.randomUUID();
  const varName = `${type.charAt(0).toLowerCase()}${type.slice(1)}_${id.slice(0, 4)}`;

  const element: UIElement = {
    id,
    type,
    label: def?.label ?? type,
    variableName: varName,
  };

  // デフォルト値の設定
  switch (type) {
    case 'TextField':
    case 'TextArea':
      element.defaultValue = '';
      break;
    case 'IntField':
      element.defaultValue = '0';
      break;
    case 'FloatField':
      element.defaultValue = '0f';
      break;
    case 'Slider':
      element.minValue = 0;
      element.maxValue = 1;
      element.defaultValue = '0.5f';
      break;
    case 'IntSlider':
      element.minValue = 0;
      element.maxValue = 100;
      element.defaultValue = '50';
      break;
    case 'Toggle':
      element.defaultValue = 'false';
      break;
    case 'ColorField':
      element.defaultValue = 'Color.white';
      break;
    case 'Vector2Field':
      element.defaultValue = 'Vector2.zero';
      break;
    case 'Vector3Field':
      element.defaultValue = 'Vector3.zero';
      break;
    case 'ObjectField':
      element.objectType = 'Object';
      element.allowSceneObjects = true;
      break;
    case 'Space':
      element.spaceHeight = 10;
      break;
    case 'HelpBox':
      element.helpBoxType = 'Info';
      element.defaultValue = 'ここにメッセージを入力';
      break;
    case 'Header':
      element.headerText = 'セクション名';
      break;
    case 'ProgressBar':
      element.progressValue = 0.5;
      break;
    case 'Popup':
      element.popupOptions = ['選択肢1', '選択肢2', '選択肢3'];
      element.defaultValue = '0';
      break;
    case 'Button':
      element.action = 'none';
      break;
    case 'TabGroup':
      element.tabs = ['タブ1', 'タブ2'];
      element.children = [];
      break;
    case 'DisabledGroup':
      element.disableCondition = 'false';
      element.children = [];
      break;
  }

  // レイアウト系は子要素配列を初期化
  if (def?.hasChildren && !element.children) {
    element.children = [];
    if (type === 'Foldout') {
      element.foldoutDefault = true;
    }
  }

  return element;
}

/** 新しいプロジェクトを生成 */
export function createNewProject(name?: string): ScriptCraftProject {
  return {
    id: crypto.randomUUID(),
    name: name ?? '新規プロジェクト',
    scriptType: 'EditorWindow',
    settings: createDefaultSettings(),
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usingStatements: [],
    fieldDeclarations: [],
    customMethods: [],
    innerTypes: [],
    lifecycleMethods: [],
    outerCode: [],
    rawGuiMethodBody: '',
  };
}
