import { useProject } from '../store/projectStore';
import { ELEMENT_DEFINITIONS, type UIElement } from '../types/editor';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
    element: UIElement;
    depth: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onMoveInto: (id: string, parentId: string) => void;
    onMoveOut: (id: string) => void;
    allElements: UIElement[];
}

function SortableItem({
    element, depth, isSelected, onSelect, onRemove,
    onMoveUp, onMoveDown, onMoveInto, onMoveOut, allElements,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: element.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const def = ELEMENT_DEFINITIONS.find(d => d.type === element.type);
    const hasChildren = def?.hasChildren;

    // レイアウト要素を探す（ドロップ先候補）
    const layoutElements = allElements.filter(el =>
        ELEMENT_DEFINITIONS.find(d => d.type === el.type)?.hasChildren && el.id !== element.id
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`layout-item ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''}`}
            data-depth={depth}
        >
            <div className="layout-item-header" onClick={() => onSelect(element.id)}>
                <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
                <span className="item-icon">{def?.icon || '📦'}</span>
                <span className="item-label">{element.label}</span>
                <span className="item-type">{def?.label}</span>
                <div className="item-actions">
                    {layoutElements.length > 0 && !hasChildren && (
                        <select
                            className="move-into-select"
                            value=""
                            onChange={(e) => {
                                if (e.target.value) onMoveInto(element.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title="グループに入れる"
                        >
                            <option value="">↳</option>
                            {layoutElements.map(le => (
                                <option key={le.id} value={le.id}>
                                    → {ELEMENT_DEFINITIONS.find(d => d.type === le.type)?.icon} {le.label}
                                </option>
                            ))}
                        </select>
                    )}
                    {depth > 0 && (
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onMoveOut(element.id); }} title="グループから出す">
                            ↑
                        </button>
                    )}
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onMoveUp(element.id); }} title="上へ移動">
                        ▲
                    </button>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onMoveDown(element.id); }} title="下へ移動">
                        ▼
                    </button>
                    <button className="btn-icon btn-delete" onClick={(e) => { e.stopPropagation(); onRemove(element.id); }} title="削除">
                        ✕
                    </button>
                </div>
            </div>
            {hasChildren && element.children && element.children.length > 0 && (
                <div className="layout-children">
                    {element.children.map(child => (
                        <SortableItem
                            key={child.id}
                            element={child}
                            depth={depth + 1}
                            isSelected={isSelected && child.id === element.id}
                            onSelect={onSelect}
                            onRemove={onRemove}
                            onMoveUp={onMoveUp}
                            onMoveDown={onMoveDown}
                            onMoveInto={onMoveInto}
                            onMoveOut={onMoveOut}
                            allElements={allElements}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function LayoutEditor() {
    const { state, dispatch } = useProject();
    const { project, selectedElementId } = state;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            dispatch({
                type: 'REORDER_ELEMENTS',
                activeId: active.id as string,
                overId: over.id as string,
            });
        }
    };

    // フラットなIDリスト
    const getAllIds = (elements: UIElement[]): string[] => {
        const ids: string[] = [];
        for (const el of elements) {
            ids.push(el.id);
            if (el.children) ids.push(...getAllIds(el.children));
        }
        return ids;
    };

    // フラットな要素リスト
    const getAllElements = (elements: UIElement[]): UIElement[] => {
        const result: UIElement[] = [];
        for (const el of elements) {
            result.push(el);
            if (el.children) result.push(...getAllElements(el.children));
        }
        return result;
    };

    const allIds = getAllIds(project.elements);
    const allElements = getAllElements(project.elements);

    return (
        <div className="layout-editor">
            <div className="layout-editor-header">
                <h2>レイアウト</h2>
                <span className="element-count">{allElements.length} 要素</span>
            </div>
            <div className="layout-editor-content">
                {project.elements.length === 0 ? (
                    <div className="layout-empty">
                        <div className="empty-icon">📦</div>
                        <p>左のパレットから要素を追加してください</p>
                        <p className="empty-hint">クリックで追加、ドラッグで並び替え</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
                            {project.elements.map(element => (
                                <SortableItem
                                    key={element.id}
                                    element={element}
                                    depth={0}
                                    isSelected={selectedElementId === element.id}
                                    onSelect={(id) => dispatch({ type: 'SELECT_ELEMENT', elementId: id })}
                                    onRemove={(id) => dispatch({ type: 'REMOVE_ELEMENT', elementId: id })}
                                    onMoveUp={(id) => dispatch({ type: 'MOVE_ELEMENT', elementId: id, direction: 'up' })}
                                    onMoveDown={(id) => dispatch({ type: 'MOVE_ELEMENT', elementId: id, direction: 'down' })}
                                    onMoveInto={(id, parentId) => dispatch({ type: 'MOVE_INTO_PARENT', elementId: id, parentId })}
                                    onMoveOut={(id) => dispatch({ type: 'MOVE_OUT_OF_PARENT', elementId: id })}
                                    allElements={allElements}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
}
