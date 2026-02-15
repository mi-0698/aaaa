import { createNewProject, createDefaultSettings } from '../types/editor';

// ===========================================
// チュートリアル 1: インタラクティブデモ
// ===========================================
const basicTutorial = createNewProject('TutorialWindow');
basicTutorial.settings = {
    ...createDefaultSettings(),
    className: 'TutorialWindow',
    windowTitle: 'Tutorial',
    menuPath: 'Window/Tutorial',
};

// 必要なusing
basicTutorial.usingStatements = [
    'using UnityEditor;',
    'using UnityEngine;',
];

// 変数宣言
basicTutorial.fieldDeclarations = [
    'private bool showHelp = true;',
    'private string userName = "User";',
];

// UI要素の構築
basicTutorial.elements = [
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'ScriptCraft チュートリアル',
        variableName: '',
        headerText: 'ScriptCraft チュートリアル'
    },
    {
        id: crypto.randomUUID(),
        type: 'HelpBox',
        label: 'Description',
        variableName: '',
        defaultValue: 'このウィンドウはScriptCraftで生成されました。ボタンやテキストフィールドの動作を確認できます。',
        helpBoxType: 'Info'
    },
    {
        id: crypto.randomUUID(),
        type: 'Space',
        label: 'Space',
        variableName: '',
        spaceHeight: 10
    },
    {
        id: crypto.randomUUID(),
        type: 'Button',
        label: 'ヘルプの表示切替',
        variableName: '',
        action: 'customCode',
        actionParam: 'showHelp = !showHelp;'
    },
    {
        id: crypto.randomUUID(),
        type: 'Button', // CustomCode holder
        label: 'カスタムコード',
        variableName: '',
        action: 'customCode',
        actionParam: `if (showHelp)\n{\n    EditorGUILayout.HelpBox("ボタンでこの表示を切り替えられます。", MessageType.Info);\n}`
    },
    {
        id: crypto.randomUUID(),
        type: 'Separator',
        label: 'Separator',
        variableName: ''
    },
    {
        id: crypto.randomUUID(),
        type: 'TextField',
        label: 'お名前',
        variableName: 'userName'
    },
    {
        id: crypto.randomUUID(),
        type: 'Button',
        label: '挨拶する',
        variableName: '',
        action: 'debugLog',
        actionParam: '$"こんにちは、{userName}さん！"'
    }
];

export const TUTORIAL_PROJECT = basicTutorial;


// ===========================================
// チュートリアル 2: 全ノードカタログ
// ===========================================
const allNodesTutorial = createNewProject('AllNodesTutorial');
allNodesTutorial.settings = {
    ...createDefaultSettings(),
    className: 'AllNodesTutorial',
    windowTitle: 'All Nodes',
    menuPath: 'Window/AllNodes',
};

// using
allNodesTutorial.usingStatements = [
    'using UnityEditor;',
    'using UnityEngine;',
];

// タブ管理用変数ほか
allNodesTutorial.fieldDeclarations = [
    'private int selectedTab = 0;',
    'private string textFieldVal = "Text";',
    'private string textAreaVal = "Multi-line\\nText";',
    'private bool toggleVal = true;',
    'private int intFieldVal = 100;',
    'private float floatFieldVal = 1.0f;',
    'private float sliderVal = 0.5f;',
    'private int intSliderVal = 50;',
    'private bool showFoldout = true;',
    'private Vector2 scrollPos;',
    'private Color colorVal = Color.white;',
    'private Vector2 vec2Val = Vector2.zero;',
    'private Vector3 vec3Val = Vector3.zero;',
    'private Object objVal = null;',
    'private AnimationCurve curveVal = new AnimationCurve();',
    'private Gradient gradientVal = new Gradient();',
    'private int layerVal = 0;',
    'private string tagVal = "Untagged";',
    'private int popupVal = 0;',
    'private int enumVal = 0;',
];

// タブグループの構築
// (TabGroupは現在ジェネレータ制限のため使用せず、ボタン切り替えのみで実装)

// --- Tab 0: Basic ---
// Note: TabGroupのchildrenは通常直列に並ぶが、ScriptCraftのTabGroup実装は
// switch文を生成し、caseごとにコードを生成する仕組みになっている (base.ts参照)
// ただし、現在のデータ構造上の `children` は一次元配列。
// ジェネレーター側で、case 0: children[0]... となるわけではなく、
// 実装上は `TabGroup` の下には全ての要素がフラットに入っていて、
// ジェネレーターが `case 0: ... break;` の中に何を生成するかを知る必要がある。
//
// ... `base.ts` を確認すると:
// lines.push(`${indent(indentLevel + 1)}case ${i}: // ${tab}`);
// // タブに対応する子要素があればここに
// lines.push(`${indent(indentLevel + 2)}break;`);
// 
// 現在のジェネレータ実装 (`base.ts`) は、タブごとの子要素の割り振りを実装していない（プレイホルダーのみ）。
// `TabGroup` の `children` をインデックスで振り分けるロジックがおそらく欠けているか、未完成。
//
// 修正が必要だが、ここでは「タブ切り替え」を CustomCode で実装するか、
// ジェネレータが未対応なら一旦単純なリストにするか...
//
// 待てよ、`base.ts` 413行目: `// タブに対応する子要素があればここに` となっており、
// コード生成されていない。
// ということは、現時点ではTabGroupを使っても中身が空になる。
// 
// 今回は「TabGroupを使わず、カスタムコードでswitch文を書く」か、
// 「TabGroupの実装を修正する」か。
// タスクは「チュートリアル実装」なので、ジェネレータ修正はスコープ外のリスクがあるが、
// 「全ノードカタログ」を作るならTabGroupは必須級。
//
// 簡易的に、TabGroupを使わず、EnumPopup + Custom Code (if/switch) で実装する方針にする。
// ジェネレータ修正はリスキー。

// 代替案: EnumPopupでタブ切り替えをシミュレート
// 1. EnumPopup (Mock) -> Toolbar
// 実際には GUILayout.Toolbar を使いたい。
// CustomCodeで Toolbar を書くのが確実。

allNodesTutorial.elements = [
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'All Nodes Catalog',
        variableName: '',
        headerText: 'All Nodes Catalog'
    },
    {
        id: crypto.randomUUID(),
        type: 'Button', // CustomCode holder for Toolbar
        label: 'Toolbar',
        variableName: '',
        action: 'customCode',
        actionParam: `
selectedTab = GUILayout.Toolbar(selectedTab, new string[] { "Basic", "Numbers", "Layouts", "Advanced" });
`
    },
    {
        id: crypto.randomUUID(),
        type: 'Space',
        label: 'Space',
        variableName: '',
        spaceHeight: 10
    }
];

// Tab 0: Basic Elements
const tab0Elements = [
    `if (selectedTab == 0) {`,
    `    EditorGUILayout.LabelField("Basic Input", EditorStyles.boldLabel);`,
    `    textFieldVal = EditorGUILayout.TextField("TextField", textFieldVal);`,
    `    EditorGUILayout.LabelField("TextArea");`,
    `    textAreaVal = EditorGUILayout.TextArea(textAreaVal, GUILayout.Height(60));`,
    `    toggleVal = EditorGUILayout.Toggle("Toggle", toggleVal);`,
    `    if (GUILayout.Button("Button")) { Debug.Log("Clicked!"); }`,
    `}`
].join('\n');

allNodesTutorial.elements.push({
    id: crypto.randomUUID(),
    type: 'Button',
    label: 'Tab 0 Logic',
    variableName: '',
    action: 'customCode',
    actionParam: tab0Elements
});

// Tab 1: Numbers
const tab1Elements = [
    `if (selectedTab == 1) {`,
    `    EditorGUILayout.LabelField("Numeric Input", EditorStyles.boldLabel);`,
    `    intFieldVal = EditorGUILayout.IntField("IntField", intFieldVal);`,
    `    floatFieldVal = EditorGUILayout.FloatField("FloatField", floatFieldVal);`,
    `    sliderVal = EditorGUILayout.Slider("Slider", sliderVal, 0f, 1f);`,
    `    intSliderVal = EditorGUILayout.IntSlider("IntSlider", intSliderVal, 0, 100);`,
    `    EditorGUILayout.Space(10);`,
    `    EditorGUI.ProgressBar(EditorGUILayout.GetControlRect(false, 20), sliderVal, "Progress Bar");`,
    `}`
].join('\n');

allNodesTutorial.elements.push({
    id: crypto.randomUUID(),
    type: 'Button',
    label: 'Tab 1 Logic',
    variableName: '',
    action: 'customCode',
    actionParam: tab1Elements
});

// Tab 2: Layouts
// ここはコンポーネントを使いたいが、ifブロック内に入れることができない（UIElementツリー構造上）。
// CustomCodeですべて書くのは本末転倒（ノードエディタの意味がない）。
// 
// しかし、「全ノードカタログ」をScriptCraftのデータ構造で表現する場合、
// 条件分岐（タブ）の中にノードを入れる構造が現在のEditorでサポートされていない（TabGroup未実装のため）。
// 
// 妥協案:
// タブ切り替えをやめて、ScrollViewで縦長に全ての要素を並べる。
// 「All Nodes」なので、全要素が見えればよい。
// Headerで区切る。

const simpleCatalog = createNewProject('AllNodesTutorial');
simpleCatalog.settings = { ...allNodesTutorial.settings };
simpleCatalog.usingStatements = allNodesTutorial.usingStatements;
simpleCatalog.fieldDeclarations = allNodesTutorial.fieldDeclarations;
// Toolbarは削除し、単一のリストにする
simpleCatalog.elements = [
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'Basic Inputs',
        variableName: '',
        headerText: 'Basic Inputs'
    },
    {
        id: crypto.randomUUID(),
        type: 'TextField',
        label: 'TextField',
        variableName: 'textFieldVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'TextArea',
        label: 'TextArea',
        variableName: 'textAreaVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'Toggle',
        label: 'Toggle',
        variableName: 'toggleVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'Button',
        label: 'Button',
        variableName: '',
        action: 'debugLog',
        actionParam: 'Button Clicked'
    },
    {
        id: crypto.randomUUID(),
        type: 'Separator',
        label: 'Separator',
        variableName: ''
    },
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'Numbers',
        variableName: '',
        headerText: 'Numbers'
    },
    {
        id: crypto.randomUUID(),
        type: 'IntField',
        label: 'IntField',
        variableName: 'intFieldVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'FloatField',
        label: 'FloatField',
        variableName: 'floatFieldVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'Slider',
        label: 'Slider',
        variableName: 'sliderVal',
        minValue: 0,
        maxValue: 1
    },
    {
        id: crypto.randomUUID(),
        type: 'IntSlider',
        label: 'IntSlider',
        variableName: 'intSliderVal',
        minValue: 0,
        maxValue: 100
    },
    {
        id: crypto.randomUUID(),
        type: 'ProgressBar',
        label: 'ProgressBar',
        variableName: 'sliderVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'Separator',
        label: 'Separator',
        variableName: ''
    },
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'Layouts',
        variableName: '',
        headerText: 'Layouts'
    },
    {
        id: crypto.randomUUID(),
        type: 'HorizontalGroup',
        label: 'Horizontal',
        variableName: '',
        children: [
            {
                id: crypto.randomUUID(),
                type: 'Button',
                label: 'Btn A',
                variableName: '',
                action: 'none'
            },
            {
                id: crypto.randomUUID(),
                type: 'Button',
                label: 'Btn B',
                variableName: '',
                action: 'none'
            }
        ]
    },
    {
        id: crypto.randomUUID(),
        type: 'Space',
        label: 'Space',
        variableName: '',
        spaceHeight: 5
    },
    {
        id: crypto.randomUUID(),
        type: 'Box',
        label: 'Vertical Box',
        variableName: '',
        children: [
            {
                id: crypto.randomUUID(),
                type: 'Label',
                label: 'Inside Box 1',
                variableName: ''
            },
            {
                id: crypto.randomUUID(),
                type: 'Label',
                label: 'Inside Box 2',
                variableName: ''
            }
        ]
    },
    {
        id: crypto.randomUUID(),
        type: 'Foldout',
        label: 'Foldout Group',
        variableName: 'showFoldout',
        foldoutDefault: true,
        children: [
            {
                id: crypto.randomUUID(),
                type: 'HelpBox',
                label: 'Help',
                variableName: '',
                defaultValue: 'これは折りたたみの中身です',
                helpBoxType: 'Info'
            }
        ]
    },
    {
        id: crypto.randomUUID(),
        type: 'Separator',
        label: 'Separator',
        variableName: ''
    },
    {
        id: crypto.randomUUID(),
        type: 'Header',
        label: 'Advanced',
        variableName: '',
        headerText: 'Advanced'
    },
    {
        id: crypto.randomUUID(),
        type: 'ColorField',
        label: 'Color',
        variableName: 'colorVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'Vector3Field',
        label: 'Vector3',
        variableName: 'vec3Val'
    },
    {
        id: crypto.randomUUID(),
        type: 'ObjectField',
        label: 'Object',
        variableName: 'objVal',
        objectType: 'Transform',
        allowSceneObjects: true
    },
    {
        id: crypto.randomUUID(),
        type: 'LayerField',
        label: 'Layer',
        variableName: 'layerVal'
    },
    {
        id: crypto.randomUUID(),
        type: 'TagField',
        label: 'Tag',
        variableName: 'tagVal'
    }
];

export const TUTORIAL_ALL_NODES_PROJECT = simpleCatalog;
