import { useState } from 'react';
import { useProject } from '../store/projectStore';
import {
    ELEMENT_DEFINITIONS,
    type ElementCategory,
    type ElementType,
} from '../types/editor';

const CATEGORY_LABELS: Record<ElementCategory, string> = {
    input: '📝 入力',
    display: '🏷️ 表示',
    layout: '📐 レイアウト',
};

const CATEGORY_ORDER: ElementCategory[] = ['input', 'display', 'layout'];

export function Palette() {
    const { state, dispatch } = useProject();
    const [openCategories, setOpenCategories] = useState<Record<ElementCategory, boolean>>({
        input: true,
        display: true,
        layout: true,
    });

    const toggleCategory = (cat: ElementCategory) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const handleAddElement = (type: ElementType) => {
        // 選択中の要素がレイアウト系なら、その中に追加
        const selectedEl = state.selectedElementId
            ? findSelectedElement(state.project.elements, state.selectedElementId)
            : null;
        const isLayoutParent = selectedEl && ELEMENT_DEFINITIONS.find(d => d.type === selectedEl.type)?.hasChildren;

        dispatch({
            type: 'ADD_ELEMENT',
            elementType: type,
            parentId: isLayoutParent ? state.selectedElementId! : undefined,
        });
    };

    return (
        <aside className="palette">
            <div className="palette-header">
                <h2>パレット</h2>
            </div>
            <div className="palette-content">
                {CATEGORY_ORDER.map(category => (
                    <div key={category} className="palette-category">
                        <button
                            className={`category-toggle ${openCategories[category] ? 'open' : ''}`}
                            onClick={() => toggleCategory(category)}
                        >
                            <span className="toggle-arrow">{openCategories[category] ? '▾' : '▸'}</span>
                            {CATEGORY_LABELS[category]}
                        </button>
                        {openCategories[category] && (
                            <div className="category-items">
                                {ELEMENT_DEFINITIONS
                                    .filter(d => d.category === category)
                                    .map(def => (
                                        <button
                                            key={def.type}
                                            className="palette-item"
                                            onClick={() => handleAddElement(def.type)}
                                            title={def.description}
                                        >
                                            <span className="palette-item-icon">{def.icon}</span>
                                            <span className="palette-item-label">{def.label}</span>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </aside>
    );
}

// ヘルパー
import type { UIElement } from '../types/editor';
function findSelectedElement(elements: UIElement[], id: string): UIElement | null {
    for (const el of elements) {
        if (el.id === id) return el;
        if (el.children) {
            const found = findSelectedElement(el.children, id);
            if (found) return found;
        }
    }
    return null;
}
