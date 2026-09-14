import React, { useState, useCallback, useEffect, useRef, useMemo, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  InvoiceDocument,
  ComponentId,
  ComponentType,
  ParentId,
} from "../types";
import { getComponentDefinition } from "../registry";
import {
  getChildren,
  findComponentDeep,
} from "../document-operations";
import { getComponentIcon } from "./DocumentEditor";

export interface OutlineEditorProps {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  onSelect: (id: ComponentId) => void;
  onDuplicate: (componentId: ComponentId) => void;
  onDelete: (componentId: ComponentId) => void;
  onVisibilityToggle: (componentId: ComponentId) => void;
  onMove: (componentId: ComponentId, newParentId: ParentId, newIndex: number) => void;
}

interface TreeNode {
  id: ComponentId;
  type: ComponentType;
  name: string;
  visible: boolean;
  children: TreeNode[];
}

function buildTreeNode(doc: InvoiceDocument, id: ComponentId): TreeNode | null {
  const component = findComponentDeep(doc, id);
  if (!component) return null;
  const def = getComponentDefinition(component.type);
  const propName = (component.props as Record<string, unknown> | undefined)?.name as string | undefined;
  const name = propName ?? def?.label ?? component.type;
  const childIds = getChildren(doc, id);
  return {
    id,
    type: component.type,
    name: name ?? component.type,
    visible: component.visible !== false,
    children: childIds
      .map((childId) => buildTreeNode(doc, childId))
      .filter((node): node is TreeNode => node !== null),
  };
}

function buildTree(doc: InvoiceDocument): TreeNode | null {
  return buildTreeNode(doc, doc.rootSectionId);
}

function flattenVisibleNodes(
  nodes: TreeNode[],
  expanded: Set<ComponentId>,
  depth = 0
): { node: TreeNode; depth: number }[] {
  const result: { node: TreeNode; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (expanded.has(node.id) && node.children.length > 0) {
      result.push(...flattenVisibleNodes(node.children, expanded, depth + 1));
    }
  }
  return result;
}

function findNode(tree: TreeNode | null, id: ComponentId): TreeNode | null {
  if (!tree) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

interface OutlineNodeProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  isFocused: boolean;
  expanded: boolean;
  onToggleExpand: (id: ComponentId) => void;
  onSelect: (id: ComponentId) => void;
  onVisibilityToggle: (id: ComponentId) => void;
  onContextMenu: (e: React.MouseEvent, id: ComponentId) => void;
  onMoveUp: (id: ComponentId) => void;
  onMoveDown: (id: ComponentId) => void;
  onDuplicate: (id: ComponentId) => void;
  onDelete: (id: ComponentId) => void;
  dragId: string;
}

const OutlineNode: React.FC<OutlineNodeProps> = ({
  node,
  depth,
  isSelected,
  isFocused,
  expanded,
  onToggleExpand,
  onSelect,
  onVisibilityToggle,
  onContextMenu,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  dragId,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId });

  const hasChildren = node.children.length > 0;
  const paddingLeft = depth * 16 + 8;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(node.id);
    }
    if (e.key === "ArrowRight" && hasChildren) {
      e.preventDefault();
      if (!expanded) onToggleExpand(node.id);
    }
    if (e.key === "ArrowLeft" && hasChildren) {
      e.preventDefault();
      if (expanded) onToggleExpand(node.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex items-center gap-1 py-1.5 text-sm rounded
        border-l-2 transition-all duration-150
        motion-reduce:transition-none
        ${isSelected
          ? "bg-primary-100 border-primary-500"
          : isFocused
          ? "bg-slate-100 border-slate-400"
          : "border-transparent hover:bg-slate-100"
        }
        focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1
      `}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-level={depth + 1}
      role="treeitem"
      tabIndex={0}
      data-component-id={node.id}
      data-component-type={node.type}
      onClick={handleSelect}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
        >
          {expanded ? "▼" : "▶"}
        </button>
      )}

      {!hasChildren && <div className="w-4" />}

      <span className="text-base" aria-hidden={node.type === "section" || node.type === "row" || node.type === "column"}>
        {getComponentIcon(node.type)}
      </span>

      <div className="flex-1 flex items-center gap-2">
        <span className="font-medium text-slate-900">{node.name}</span>
        <span
          className="text-xs text-slate-400 font-mono"
          aria-label="Component ID"
          title={node.id}
        >
          #{node.id.slice(0, 8)}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onVisibilityToggle(node.id);
        }}
        aria-label={node.visible ? "Hide component" : "Show component"}
        aria-pressed={!node.visible}
        title={node.visible ? "Hide component" : "Show component"}
        className={`w-5 h-5 flex items-center justify-center rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 ${
          node.visible
            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
        }`}
      >
        {node.visible ? "👁" : "🚫"}
      </button>

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(node.id);
          }}
          aria-label="Move up"
          title="Move up (Ctrl+↑)"
          className="w-5 h-5 flex items-center justify-center rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(node.id);
          }}
          aria-label="Move down"
          title="Move down (Ctrl+↓)"
          className="w-5 h-5 flex items-center justify-center rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(node.id);
          }}
          aria-label="Duplicate"
          title="Duplicate (Ctrl+D)"
          className="w-5 h-5 flex items-center justify-center rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          📄
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          aria-label="Delete"
          title="Delete (Delete)"
          className="w-5 h-5 flex items-center justify-center rounded text-xs bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

function renderTree(
  nodes: TreeNode[],
  depth: number,
  selectedComponentId: ComponentId | null,
  focusedComponentId: ComponentId | null,
  expanded: Set<ComponentId>,
  onToggleExpand: (id: ComponentId) => void,
  onSelect: (id: ComponentId) => void,
  onVisibilityToggle: (id: ComponentId) => void,
  onContextMenu: (e: React.MouseEvent, id: ComponentId) => void,
  onMoveUp: (id: ComponentId) => void,
  onMoveDown: (id: ComponentId) => void,
  onDuplicate: (id: ComponentId) => void,
  onDelete: (id: ComponentId) => void
): ReactNode {
  const childIds = nodes.map((n) => `outline-node-${n.id}`);

  return (
    <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => {
        const dragId = `outline-node-${node.id}`;
        const isExpanded = expanded.has(node.id) && node.children.length > 0;
        return (
          <React.Fragment key={dragId}>
            <OutlineNode
              node={node}
              depth={depth}
              isSelected={selectedComponentId === node.id}
              isFocused={focusedComponentId === node.id}
              expanded={isExpanded}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onVisibilityToggle={onVisibilityToggle}
              onContextMenu={onContextMenu}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              dragId={dragId}
            />
            {isExpanded && node.children.length > 0 && (
              <div>
                {renderTree(
                  node.children,
                  depth + 1,
                  selectedComponentId,
                  focusedComponentId,
                  expanded,
                  onToggleExpand,
                  onSelect,
                  onVisibilityToggle,
                  onContextMenu,
                  onMoveUp,
                  onMoveDown,
                  onDuplicate,
                  onDelete
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </SortableContext>
  );
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({
  document: doc,
  selectedComponentId,
  onSelect,
  onDuplicate,
  onDelete,
  onVisibilityToggle,
  onMove,
}) => {
  const [expanded, setExpanded] = useState<Set<ComponentId>>(new Set());
  const [focusedComponentId, setFocusedComponentId] = useState<ComponentId | null>(selectedComponentId);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; componentId: ComponentId } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(doc), [doc]);

  useEffect(() => {
    if (tree) {
      const allIds: ComponentId[] = [tree.id];
      const collect = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          allIds.push(n.id);
          if (n.children.length > 0) collect(n.children);
        }
      };
      collect(tree.children);
      setExpanded(new Set(allIds));
    }
  }, [tree]);

  useEffect(() => {
    setFocusedComponentId(selectedComponentId);
  }, [selectedComponentId]);

  const visibleNodes = useMemo(() => {
    if (!tree) return [];
    return flattenVisibleNodes(tree.children, expanded, 0);
  }, [tree, expanded]);

  const toggleExpand = useCallback((id: ComponentId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleMoveUp = useCallback((id: ComponentId) => {
    const component = findComponentDeep(doc, id);
    if (!component || !component.parentId) return;
    const siblings = getChildren(doc, component.parentId);
    const currentIndex = siblings.indexOf(id);
    if (currentIndex > 0) {
      onMove(id, component.parentId, currentIndex - 1);
    }
  }, [doc, onMove]);

  const handleMoveDown = useCallback((id: ComponentId) => {
    const component = findComponentDeep(doc, id);
    if (!component || !component.parentId) return;
    const siblings = getChildren(doc, component.parentId);
    const currentIndex = siblings.indexOf(id);
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      onMove(id, component.parentId, currentIndex + 1);
    }
  }, [doc, onMove]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: ComponentId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, componentId: id });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !tree) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeNodeId = activeId.replace("outline-node-", "");
    const overNodeId = overId.replace("outline-node-", "");

    const component = findComponentDeep(doc, activeNodeId);
    if (!component || !component.parentId) return;

    const siblings = getChildren(doc, component.parentId);
    const fromIndex = siblings.indexOf(activeNodeId);
    const toIndex = siblings.indexOf(overNodeId);

    if (fromIndex >= 0 && toIndex >= 0) {
      const overComponent = findComponentDeep(doc, overNodeId);
      const overParentId = overComponent?.parentId;
      if (overParentId === component.parentId) {
        let targetIndex = toIndex;
        if (fromIndex < toIndex) targetIndex = toIndex - 1;
        onMove(activeNodeId, component.parentId, Math.max(0, targetIndex));
      }
    }
  }, [tree, doc, onMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedComponentId) return;

      if (e.key === "Escape") {
        closeContextMenu();
      }

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onDuplicate(focusedComponentId);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleMoveUp(focusedComponentId);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleMoveDown(focusedComponentId);
          return;
        }
      }

      if (e.key === "Delete" && !(e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onDelete(focusedComponentId);
        return;
      }

      // Arrow navigation (no modifier)
      if (!(e.ctrlKey || e.metaKey)) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const visible = flattenVisibleNodes(tree?.children ?? [], expanded, 0);
          const currentIndex = visible.findIndex((v) => v.node.id === focusedComponentId);
          if (currentIndex > 0) {
            setFocusedComponentId(visible[currentIndex - 1].node.id);
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const visible = flattenVisibleNodes(tree?.children ?? [], expanded, 0);
          const currentIndex = visible.findIndex((v) => v.node.id === focusedComponentId);
          if (currentIndex >= 0 && currentIndex < visible.length - 1) {
            setFocusedComponentId(visible[currentIndex + 1].node.id);
          }
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(focusedComponentId);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [focusedComponentId, tree, expanded, onDuplicate, onDelete, onSelect, handleMoveUp, handleMoveDown, closeContextMenu]);

  if (!tree) {
    return (
      <div className="p-4 text-sm text-slate-500" role="tree">
        No components found.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="h-full overflow-y-auto p-2 outline-none"
        role="tree"
        aria-label="Document outline"
        tabIndex={0}
        onClick={() => {
          if (contextMenu) closeContextMenu();
        }}
      >
        {tree && (
          <React.Fragment>
            <OutlineNode
              node={tree}
              depth={0}
              isSelected={selectedComponentId === tree.id}
              isFocused={focusedComponentId === tree.id}
              expanded={expanded.has(tree.id) && tree.children.length > 0}
              onToggleExpand={toggleExpand}
              onSelect={(id) => {
                onSelect(id);
                setFocusedComponentId(id);
              }}
              onVisibilityToggle={onVisibilityToggle}
              onContextMenu={handleContextMenu}
              onMoveUp={() => handleMoveUp(tree.id)}
              onMoveDown={() => handleMoveDown(tree.id)}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              dragId={`outline-node-${tree.id}`}
            />
            {expanded.has(tree.id) && tree.children.length > 0 && (
              <div>
                {renderTree(
                  tree.children,
                  1,
                  selectedComponentId,
                  focusedComponentId,
                  expanded,
                  toggleExpand,
                  (id) => {
                    onSelect(id);
                    setFocusedComponentId(id);
                  },
                  onVisibilityToggle,
                  handleContextMenu,
                  handleMoveUp,
                  handleMoveDown,
                  onDuplicate,
                  onDelete
                )}
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      <DragOverlay>
        {activeDragId && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 opacity-90">
            <span>{getComponentIcon(activeDragId.replace("outline-node-", "") as ComponentType)}</span>
            <span className="ml-2 text-sm">{activeDragId.replace("outline-node-", "")}</span>
          </div>
        )}
      </DragOverlay>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="Component context menu"
        >
          <button
            type="button"
            onClick={() => {
              onDuplicate(contextMenu.componentId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(contextMenu.componentId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      )}
    </DndContext>
  );
};

export default OutlineEditor;
