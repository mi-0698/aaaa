import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import {
    type ScriptCraftProject,
    type ScriptType,
    type UIElement,
    type ProjectSettings,
    createNewProject,
    createUIElement,
    type ElementType,
} from '../types/editor';

// ===========================
// アクション定義
// ===========================
type Action =
    | { type: 'NEW_PROJECT'; name?: string }
    | { type: 'LOAD_PROJECT'; project: ScriptCraftProject }
    | { type: 'SET_SCRIPT_TYPE'; scriptType: ScriptType }
    | { type: 'UPDATE_SETTINGS'; settings: Partial<ProjectSettings> }
    | { type: 'ADD_ELEMENT'; elementType: ElementType; parentId?: string }
    | { type: 'REMOVE_ELEMENT'; elementId: string }
    | { type: 'UPDATE_ELEMENT'; elementId: string; updates: Partial<UIElement> }
    | { type: 'MOVE_ELEMENT'; elementId: string; direction: 'up' | 'down' }
    | { type: 'SELECT_ELEMENT'; elementId: string | null }
    | { type: 'MOVE_INTO_PARENT'; elementId: string; parentId: string }
    | { type: 'MOVE_OUT_OF_PARENT'; elementId: string }
    | { type: 'REORDER_ELEMENTS'; activeId: string; overId: string };

interface State {
    project: ScriptCraftProject;
    selectedElementId: string | null;
}

// ===========================
// ヘルパー関数
// ===========================

/** 要素ツリーの中から指定IDの要素を見つける */
function findElementById(elements: UIElement[], id: string): UIElement | null {
    for (const el of elements) {
        if (el.id === id) return el;
        if (el.children) {
            const found = findElementById(el.children, id);
            if (found) return found;
        }
    }
    return null;
}

/** 要素ツリーから指定IDの要素を削除し、削除した要素を返す */
function removeElementById(elements: UIElement[], id: string): { remaining: UIElement[]; removed: UIElement | null } {
    let removed: UIElement | null = null;
    const remaining = elements.filter(el => {
        if (el.id === id) {
            removed = el;
            return false;
        }
        return true;
    });

    if (!removed) {
        for (const el of remaining) {
            if (el.children) {
                const result = removeElementById(el.children, id);
                if (result.removed) {
                    el.children = result.remaining;
                    return { remaining, removed: result.removed };
                }
            }
        }
    }

    return { remaining, removed };
}

/** 要素ツリーの中で指定IDの要素を更新する */
function updateElementInTree(elements: UIElement[], id: string, updates: Partial<UIElement>): UIElement[] {
    return elements.map(el => {
        if (el.id === id) {
            return { ...el, ...updates };
        }
        if (el.children) {
            return { ...el, children: updateElementInTree(el.children, id, updates) };
        }
        return el;
    });
}

/** 要素を上下に移動する */
function moveElementInTree(elements: UIElement[], id: string, direction: 'up' | 'down'): UIElement[] {
    const index = elements.findIndex(el => el.id === id);
    if (index !== -1) {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= elements.length) return elements;
        const newElements = [...elements];
        [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
        return newElements;
    }

    return elements.map(el => {
        if (el.children) {
            return { ...el, children: moveElementInTree(el.children, id, direction) };
        }
        return el;
    });
}

/** 要素を親に追加する */
function addElementToParent(elements: UIElement[], element: UIElement, parentId: string): UIElement[] {
    return elements.map(el => {
        if (el.id === parentId && el.children) {
            return { ...el, children: [...el.children, element] };
        }
        if (el.children) {
            return { ...el, children: addElementToParent(el.children, element, parentId) };
        }
        return el;
    });
}

/** フラットなIDリスト（ツリー内の全要素）を返す */
export function getAllElementIds(elements: UIElement[]): string[] {
    const ids: string[] = [];
    for (const el of elements) {
        ids.push(el.id);
        if (el.children) {
            ids.push(...getAllElementIds(el.children));
        }
    }
    return ids;
}

/** 要素の親IDを見つける */
export function findParentId(elements: UIElement[], id: string): string | null {
    for (const el of elements) {
        if (el.children) {
            if (el.children.some(child => child.id === id)) {
                return el.id;
            }
            const found = findParentId(el.children, id);
            if (found) return found;
        }
    }
    return null;
}

/** 2つの要素を入れ替える（ツリー全体横断） */
function reorderElements(elements: UIElement[], activeId: string, overId: string): UIElement[] {
    // 同じレベルでの並び替え
    const activeIndex = elements.findIndex(el => el.id === activeId);
    const overIndex = elements.findIndex(el => el.id === overId);

    if (activeIndex !== -1 && overIndex !== -1) {
        const newElements = [...elements];
        const [movedElement] = newElements.splice(activeIndex, 1);
        newElements.splice(overIndex, 0, movedElement);
        return newElements;
    }

    // 子要素内での並び替え
    return elements.map(el => {
        if (el.children) {
            return { ...el, children: reorderElements(el.children, activeId, overId) };
        }
        return el;
    });
}

// ===========================
// Reducer
// ===========================
function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'NEW_PROJECT':
            return {
                project: createNewProject(action.name),
                selectedElementId: null,
            };

        case 'LOAD_PROJECT':
            return {
                project: action.project,
                selectedElementId: null,
            };

        case 'SET_SCRIPT_TYPE':
            return {
                ...state,
                project: {
                    ...state.project,
                    scriptType: action.scriptType,
                    updatedAt: new Date().toISOString(),
                },
            };

        case 'UPDATE_SETTINGS':
            return {
                ...state,
                project: {
                    ...state.project,
                    settings: { ...state.project.settings, ...action.settings },
                    updatedAt: new Date().toISOString(),
                },
            };

        case 'ADD_ELEMENT': {
            const newElement = createUIElement(action.elementType);
            let newElements: UIElement[];
            if (action.parentId) {
                newElements = addElementToParent(state.project.elements, newElement, action.parentId);
            } else {
                newElements = [...state.project.elements, newElement];
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: newElements,
                    updatedAt: new Date().toISOString(),
                },
                selectedElementId: newElement.id,
            };
        }

        case 'REMOVE_ELEMENT': {
            const { remaining } = removeElementById(state.project.elements, action.elementId);
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: remaining,
                    updatedAt: new Date().toISOString(),
                },
                selectedElementId:
                    state.selectedElementId === action.elementId ? null : state.selectedElementId,
            };
        }

        case 'UPDATE_ELEMENT':
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: updateElementInTree(state.project.elements, action.elementId, action.updates),
                    updatedAt: new Date().toISOString(),
                },
            };

        case 'MOVE_ELEMENT':
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: moveElementInTree(state.project.elements, action.elementId, action.direction),
                    updatedAt: new Date().toISOString(),
                },
            };

        case 'SELECT_ELEMENT':
            return {
                ...state,
                selectedElementId: action.elementId,
            };

        case 'MOVE_INTO_PARENT': {
            const { remaining, removed } = removeElementById(state.project.elements, action.elementId);
            if (!removed) return state;
            const newElements = addElementToParent(remaining, removed, action.parentId);
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: newElements,
                    updatedAt: new Date().toISOString(),
                },
            };
        }

        case 'MOVE_OUT_OF_PARENT': {
            const parentId = findParentId(state.project.elements, action.elementId);
            if (!parentId) return state;
            const { remaining, removed } = removeElementById(state.project.elements, action.elementId);
            if (!removed) return state;
            // 親の直後に挿入
            const parentIndex = remaining.findIndex(el => el.id === parentId);
            if (parentIndex !== -1) {
                const newElements = [...remaining];
                newElements.splice(parentIndex + 1, 0, removed);
                return {
                    ...state,
                    project: {
                        ...state.project,
                        elements: newElements,
                        updatedAt: new Date().toISOString(),
                    },
                };
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: [...remaining, removed],
                    updatedAt: new Date().toISOString(),
                },
            };
        }

        case 'REORDER_ELEMENTS':
            return {
                ...state,
                project: {
                    ...state.project,
                    elements: reorderElements(state.project.elements, action.activeId, action.overId),
                    updatedAt: new Date().toISOString(),
                },
            };

        default:
            return state;
    }
}

// ===========================
// Context
// ===========================
interface ProjectContextType {
    state: State;
    dispatch: React.Dispatch<Action>;
    selectedElement: UIElement | null;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
    // localStorage から復元を試みる
    const savedProject = localStorage.getItem('scriptcraft_project');
    let initialProject: ScriptCraftProject;
    try {
        initialProject = savedProject ? JSON.parse(savedProject) : createNewProject();
        // 新フィールドのマイグレーション（古いデータとの互換性）
        if (!initialProject.usingStatements) initialProject.usingStatements = [];
        if (!initialProject.fieldDeclarations) initialProject.fieldDeclarations = [];
        if (!initialProject.customMethods) initialProject.customMethods = [];
        if (!initialProject.innerTypes) initialProject.innerTypes = [];
        if (!initialProject.lifecycleMethods) initialProject.lifecycleMethods = [];
        if (!initialProject.outerCode) initialProject.outerCode = [];
        if (!initialProject.settings.interfaces) initialProject.settings.interfaces = [];
        if (!initialProject.settings.classAttributes) initialProject.settings.classAttributes = [];
        if (initialProject.rawGuiMethodBody === undefined) initialProject.rawGuiMethodBody = '';
    } catch {
        initialProject = createNewProject();
    }

    const [state, dispatch] = useReducer(reducer, {
        project: initialProject,
        selectedElementId: null,
    });

    // 自動保存
    React.useEffect(() => {
        localStorage.setItem('scriptcraft_project', JSON.stringify(state.project));
    }, [state.project]);

    const selectedElement = state.selectedElementId
        ? findElementById(state.project.elements, state.selectedElementId)
        : null;

    return (
        <ProjectContext.Provider value={{ state, dispatch, selectedElement }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const ctx = useContext(ProjectContext);
    if (!ctx) throw new Error('useProject must be used within ProjectProvider');
    return ctx;
}
