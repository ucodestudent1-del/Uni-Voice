import React, { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  useDraggable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, type Transform } from "@dnd-kit/utilities";
import {
  InvoiceDocument,
  AnyComponent,
  ComponentId,
  ComponentType,
  ParentId,
} from "../types";
import {
  getChildren,
  findComponent,
  findParent,
  findSiblings,
  canDropComponent,
} from "../document-operations";
import { getComponentDefinition, RenderContext, PaletteItem, getPaletteItems } from "../registry/index";
import { analytics } from "../../lib/analytics";

type DragOperation = "create" | "reorder";

interface ActiveDrag {
  operation: DragOperation;
  componentId: ComponentId | null;
  componentType: ComponentType | null;
  sourceParentId: ParentId | null;
  sourceIndex: number;
}

interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number;
  snapType: "left" | "right" | "center" | "top" | "bottom";
}

export const PALETTE_DRAGGABLE_ID_PREFIX = "palette-";

export interface DocumentEditorProps {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  onSelect: (id: ComponentId) => void;
  onInsertComponent: (params: { type: ComponentType; parentId: ParentId; index: number }) => void;
  onReorderComponent: (params: { componentId: ComponentId; newParentId: ParentId; newIndex: number }) => void;
  onDuplicate?: (componentId: ComponentId) => void;
  onDelete?: (componentId: ComponentId) => void;
  business: any;
  customer: any;
  invoice: any;
  calculations: any;
  currency: string;
  locale: string;
}

function getCategories(): { id: string; label: string; items: PaletteItem[] }[] {
  const allItems = getPaletteItems();
  type Category = { id: string; label: string; items: PaletteItem[] };
  const categories: Category[] = [
    { id: "structure", label: "Layout", items: allItems.filter((i: PaletteItem) => i.category === "structure") },
    { id: "business", label: "Invoice Fields", items: allItems.filter((i: PaletteItem) => i.category === "business") },
    { id: "totals", label: "Totals", items: allItems.filter((i: PaletteItem) => i.category === "totals") },
    { id: "content", label: "Content", items: allItems.filter((i: PaletteItem) => i.category === "content") },
  ];
  return categories.filter((c: Category) => c.items.length > 0);
}

export function getComponentIcon(type: ComponentType): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    text: "📝", image: "🖼️", logo: "🏢", customerInfo: "👤",
    invoiceNumber: "#️", date: "📅", lineItems: "📋", subtotal: "💰",
    tax: "🧾", discount: "✂️", paymentTerms: "📄", signature: "✍️",
    customField: "⚙️", notes: "📝", terms: "📄", paymentInstructions: "🏦",
    fees: "➕", total: "💵", amountDue: "➡️", businessInfo: "🏪",
    spacer: "␣", divider: "—", section: "📦", row: "➖", column: "⬛",
  };
  return icons[type] ?? "•";
}

const PaletteItemCard: React.FC<{ type: ComponentType; label: string; description: string }> = ({ type, label, description }) => {
  const dragId = `palette-${type}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { componentType: type },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="
        flex items-center gap-3 p-2 rounded-lg
        bg-white border border-slate-200
        hover:border-primary-300 hover:bg-primary-50
        cursor-grab active:cursor-grabbing
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
      "
      aria-label={`Add ${label} (${description})`}
      aria-grabbed="false"
      role="button"
      tabIndex={0}
    >
      <span className="text-lg">{getComponentIcon(type)}</span>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
};

function parseDropZoneId(dropZoneId: string): { parentId: ParentId; index: number } | null {
  const match = dropZoneId.match(/^dropzone-(.+)-(\d+)$/);
  if (!match) return null;
  return { parentId: match[1] as ParentId, index: parseInt(match[2], 10) };
}

const SortableNode: React.FC<{
  componentId: ComponentId;
  doc: InvoiceDocument;
  isSelected: boolean;
  onSelect: (id: ComponentId) => void;
  onContextMenu: (e: React.MouseEvent, id: ComponentId) => void;
  onDuplicate: (id: ComponentId) => void;
  onDelete: (id: ComponentId) => void;
  renderContext: RenderContext;
}> = ({ componentId, doc, isSelected, onSelect, onContextMenu, onDuplicate, onDelete, renderContext }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: componentId });

  const component = findComponent(doc, componentId);
  if (!component) return null;

  const def = getComponentDefinition(component.type);
  if (!def) return null;

  const isStructural = component.type === "section" || component.type === "row" || component.type === "column";
  const childrenIds = getChildren(doc, componentId);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const nodeClassName = `
    relative border rounded-lg p-3 mb-2 transition-all cursor-grab
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
    ${isSelected
      ? "ring-2 ring-primary-500 border-primary-500 bg-primary-50"
      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
    }
    ${isStructural ? "bg-slate-50" : "bg-white"}
    ${isDragging ? "opacity-50" : ""}
  `;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(componentId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, componentId);
  };

  let content: React.ReactNode;
  if (isStructural && childrenIds.length > 0) {
    content = (
      <div className="relative">
        {childrenIds.map((childId) => (
          <SortableNode
            key={childId}
            componentId={childId}
            doc={doc}
            isSelected={false}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            renderContext={renderContext}
          />
        ))}
      </div>
    );
  } else {
    content = def.render(component, renderContext);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={nodeClassName}
      onClick={handleSelect}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role={isStructural ? "treeitem" : "group"}
      aria-selected={isSelected}
      aria-label={`${component.type} component (${component.id})`}
      data-component-id={componentId}
      data-component-type={component.type}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(componentId);
        }
        if (e.key === "Delete") {
          e.preventDefault();
          onDelete(componentId);
        }
        if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onDuplicate(componentId);
        }
      }}
    >
      <div style={{ ...component.style, ...(component.visible === false ? { opacity: 0.5 } : {}) }}>
        {content}
      </div>

      {isSelected && !isDragging && (
        <div className="absolute top-1 right-1 flex gap-0.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(componentId);
            }}
            aria-label="Duplicate component"
            title="Duplicate (Ctrl+D)"
            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs"
          >
            📄
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(componentId);
            }}
            aria-label="Delete component"
            title="Delete (Delete)"
            className="w-5 h-5 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

const DropZone: React.FC<{
  id: string;
  doc: InvoiceDocument;
  parentId: ParentId;
  index: number;
  activeDrag: ActiveDrag | null;
}> = ({ id, doc, parentId, index, activeDrag }) => {
  const validation = activeDrag ? canDropComponent(doc, activeDrag.componentType!, parentId) : { success: false };
  const canReceive = activeDrag?.operation === "create" ||
    (activeDrag?.operation === "reorder" && activeDrag.componentId !== null);

  const isValidTarget = canReceive && validation.success;

  return (
    <div
      key={id}
      id={id}
      data-dropzone={id}
      data-parent-id={parentId}
      data-index={index}
      role="button"
      aria-dropeffect="none"
      tabIndex={-1}
      className={`
        border-2 border-dashed rounded-lg py-3 text-center text-sm
        transition-all duration-200 mb-2
        ${isValidTarget
          ? "border-primary-300 bg-primary-50 text-primary-700"
          : "border-slate-200 text-slate-400"
        }
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
      `}
    >
      {isValidTarget ? `Insert at index ${index}` : "Drop here"}
    </div>
  );
};

function renderComponentTree(
  doc: InvoiceDocument,
  parentId: ParentId,
  selectedComponentId: ComponentId | null,
  onSelect: (id: ComponentId) => void,
  onContextMenu: (e: React.MouseEvent, id: ComponentId) => void,
  onDuplicate: (id: ComponentId) => void,
  onDelete: (id: ComponentId) => void,
  renderContext: RenderContext,
  activeDrag: ActiveDrag | null
): ReactNode {
  const children = getChildren(doc, parentId);

  const items = children.map((childId, index) => {
    const child = findComponent(doc, childId);
    if (!child) return null;

    const nodeKey = `node-${childId}`;

    return (
      <React.Fragment key={nodeKey}>
        <DropZone
          id={`dropzone-${childId}-${index}`}
          doc={doc}
          parentId={parentId}
          index={index}
          activeDrag={activeDrag}
        />
        <SortableNode
          componentId={childId}
          doc={doc}
          isSelected={selectedComponentId === childId}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          renderContext={renderContext}
        />
      </React.Fragment>
    );
  });

  return (
    <>
      <DropZone
        id={`dropzone-${parentId as string}-0`}
        doc={doc}
        parentId={parentId}
        index={0}
        activeDrag={activeDrag}
      />
      {items}
      <DropZone
        id={`dropzone-${parentId as string}-${children.length}`}
        doc={doc}
        parentId={parentId}
        index={children.length}
        activeDrag={activeDrag}
      />
    </>
  );
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document: doc,
  selectedComponentId,
  onSelect,
  onInsertComponent,
  onReorderComponent,
  onDuplicate = () => {},
  onDelete = () => {},
  business,
  customer,
  invoice,
  calculations,
  currency,
  locale,
}) => {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; componentId: ComponentId } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [snapDelta, setSnapDelta] = useState<Transform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStartRectRef = useRef<DOMRect | null>(null);
  const draggedComponentIdRef = useRef<ComponentId | null>(null);

  const SNAP_THRESHOLD = 8;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, componentId: ComponentId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, componentId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleDuplicate = useCallback((componentId: ComponentId) => {
    try {
      analytics.trackEvent("component_duplicated", { componentId });
    } catch {}
    onDuplicate(componentId);
  }, [onDuplicate]);

  const handleDelete = useCallback((componentId: ComponentId) => {
    try {
      analytics.trackEvent("component_deleted", { componentId });
    } catch {}
    onDelete(componentId);
  }, [onDelete]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!canvasRef.current || !activeDrag || !dragStartRectRef.current) {
      setAlignmentGuides([]);
      setSnapDelta({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      return;
    }

    const startRect = dragStartRectRef.current;
    const offset = event.delta ?? { x: 0, y: 0 };
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const currentLeft = startRect.left + offset.x;
    const currentTop = startRect.top + offset.y;
    const currentRight = currentLeft + startRect.width;
    const currentBottom = currentTop + startRect.height;
    const currentCenterX = currentLeft + startRect.width / 2;
    const currentCenterY = currentTop + startRect.height / 2;

    const elements = canvasRef.current.querySelectorAll<HTMLElement>('[data-component-id]');

    const guides: AlignmentGuide[] = [];
    let snapDeltaX = 0;
    let snapDeltaY = 0;
    let bestSnapX = Infinity;
    let bestSnapY = Infinity;

    elements.forEach((el) => {
      const elRect = el.getBoundingClientRect();
      const elLeft = elRect.left;
      const elRight = elRect.right;
      const elTop = elRect.top;
      const elBottom = elRect.bottom;
      const elCenterX = elLeft + elRect.width / 2;
      const elCenterY = elTop + elRect.height / 2;

      const checks: { diff: number; guide: AlignmentGuide; delta: { x: number; y: number } }[] = [];

      checks.push({
        diff: Math.abs(currentLeft - elLeft),
        guide: { type: "vertical", position: elLeft - canvasRect.left, snapType: "left" },
        delta: { x: elLeft - currentLeft, y: 0 },
      });
      checks.push({
        diff: Math.abs(currentRight - elRight),
        guide: { type: "vertical", position: elRight - canvasRect.left, snapType: "right" },
        delta: { x: elRight - currentRight, y: 0 },
      });
      checks.push({
        diff: Math.abs(currentCenterX - elCenterX),
        guide: { type: "vertical", position: elCenterX - canvasRect.left, snapType: "center" },
        delta: { x: elCenterX - currentCenterX, y: 0 },
      });
      checks.push({
        diff: Math.abs(currentTop - elTop),
        guide: { type: "horizontal", position: elTop - canvasRect.top, snapType: "top" },
        delta: { x: 0, y: elTop - currentTop },
      });
      checks.push({
        diff: Math.abs(currentBottom - elBottom),
        guide: { type: "horizontal", position: elBottom - canvasRect.top, snapType: "bottom" },
        delta: { x: 0, y: elBottom - currentBottom },
      });
      checks.push({
        diff: Math.abs(currentCenterY - elCenterY),
        guide: { type: "horizontal", position: elCenterY - canvasRect.top, snapType: "center" },
        delta: { x: 0, y: elCenterY - currentCenterY },
      });

      checks.forEach((c) => {
        if (c.diff <= SNAP_THRESHOLD) {
          guides.push(c.guide);
          if (c.guide.type === "vertical" && c.diff < bestSnapX) {
            bestSnapX = c.diff;
            snapDeltaX = c.delta.x;
          }
          if (c.guide.type === "horizontal" && c.diff < bestSnapY) {
            bestSnapY = c.diff;
            snapDeltaY = c.delta.y;
          }
        }
      });
    });

    setAlignmentGuides(guides);
    setSnapDelta({
      x: bestSnapX < Infinity ? snapDeltaX : 0,
      y: bestSnapY < Infinity ? snapDeltaY : 0,
      scaleX: 1,
      scaleY: 1,
    });
  }, [activeDrag]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };
    const handleClick = () => {
      if (contextMenu) closeContextMenu();
    };
    if (contextMenu) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClick);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleClick);
      };
    }
  }, [contextMenu, closeContextMenu]);

  const renderContext: RenderContext = {
    document: doc,
    business,
    customer,
    invoice,
    calculations,
    currency,
    locale,
    isEditing: true,
    selectedComponentId: selectedComponentId ?? null,
    onSelect,
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;

    if (activeId.startsWith("palette-")) {
      const componentType = activeId.replace("palette-", "") as ComponentType;
      setActiveDrag({
        operation: "create",
        componentId: null,
        componentType,
        sourceParentId: null,
        sourceIndex: -1,
      });
      dragStartRectRef.current = null;
      draggedComponentIdRef.current = null;
    } else {
      const component = findComponent(doc, activeId as ComponentId);
      if (!component) return;

      const element = document.querySelector(`[data-component-id="${window.CSS.escape(activeId as string)}"]`);
      if (element) {
        dragStartRectRef.current = element.getBoundingClientRect();
      }
      draggedComponentIdRef.current = activeId as ComponentId;

      const parentId = findParent(doc, activeId as ComponentId);
      const siblings = findSiblings(doc, activeId as ComponentId);
      const sourceIndex = siblings.indexOf(activeId as ComponentId);

      setActiveDrag({
        operation: "reorder",
        componentId: activeId as ComponentId,
        componentType: component.type,
        sourceParentId: parentId,
        sourceIndex,
      });
    }
  }, [doc]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !activeDrag) {
      setActiveDrag(null);
      setAlignmentGuides([]);
      setSnapDelta({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      dragStartRectRef.current = null;
      draggedComponentIdRef.current = null;
      return;
    }

    const overId = over.id as string;

    if (activeDrag.operation === "create") {
      const dropZoneInfo = parseDropZoneId(overId);
      if (dropZoneInfo) {
        const { parentId: targetParentId, index: targetIndex } = dropZoneInfo;
        const validation = canDropComponent(doc, activeDrag.componentType!, targetParentId);
        if (validation.success) {
          const componentType = activeDrag.componentType!;
          try {
            analytics.trackEvent("component_added", { componentType, parentId: targetParentId, index: targetIndex });
          } catch {}
          onInsertComponent({
            type: componentType,
            parentId: targetParentId,
            index: targetIndex,
          });
        }
      }
    } else if (activeDrag.operation === "reorder" && activeDrag.componentId) {
      const draggedId = activeDrag.componentId;

      if (draggedId === overId) {
        setActiveDrag(null);
        return;
      }

      const dropZoneInfo = parseDropZoneId(overId);
      if (dropZoneInfo) {
        const { parentId: targetParentId, index: targetIndex } = dropZoneInfo;
        let adjustedIndex = targetIndex;

        if (activeDrag.sourceParentId === targetParentId && activeDrag.sourceIndex < targetIndex) {
          adjustedIndex = targetIndex - 1;
        }

        onReorderComponent({
          componentId: draggedId,
          newParentId: targetParentId,
          newIndex: adjustedIndex,
        });
      } else {
        const targetComponent = findComponent(doc, overId as ComponentId);
        if (targetComponent) {
          const targetParentId = targetComponent.parentId ?? doc.rootSectionId;
          const targetSiblings = findSiblings(doc, overId as ComponentId);
          let targetIndex = targetSiblings.indexOf(overId as ComponentId);

          if (activeDrag.sourceParentId === targetParentId && activeDrag.sourceIndex < targetIndex) {
            targetIndex = targetIndex - 1;
          }

          onReorderComponent({
            componentId: draggedId,
            newParentId: targetParentId,
            newIndex: Math.max(0, targetIndex),
          });
        }
      }
    }

    setActiveDrag(null);
    setAlignmentGuides([]);
    setSnapDelta({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    dragStartRectRef.current = null;
    draggedComponentIdRef.current = null;
  }, [doc, activeDrag, onInsertComponent, onReorderComponent]);

  const rootSection = doc.sections[doc.rootSectionId];
  if (!rootSection) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter}>
        <div className="p-6">Loading document...</div>
      </DndContext>
    );
  }

  const rootChildren: string[] = getChildren(doc, doc.rootSectionId);
  const categories = getCategories();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-hidden">
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Components</h2>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id}>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {category.label}
                </h3>
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <PaletteItemCard
                      key={item.type}
                      type={item.type}
                      label={item.label}
                      description={item.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex-1 overflow-auto relative"
          onClick={closeContextMenu}
          ref={canvasRef}
        >
          <div className="p-6 bg-slate-50 h-full">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 min-h-[600px] relative">
                {alignmentGuides.length > 0 && (
                  <>
                    {alignmentGuides
                      .filter((g) => g.type === "vertical")
                      .map((guide, i) => (
                        <div
                          key={`vguide-${i}`}
                          className="absolute h-full w-px bg-blue-500/50 pointer-events-none"
                          style={{ left: guide.position }}
                        />
                      ))}
                    {alignmentGuides
                      .filter((g) => g.type === "horizontal")
                      .map((guide, i) => (
                        <div
                          key={`hguide-${i}`}
                          className="absolute w-full h-px bg-blue-500/50 pointer-events-none"
                          style={{ top: guide.position }}
                        />
                      ))}
                  </>
                )}
                <SortableContext items={rootChildren} strategy={verticalListSortingStrategy}>
                  <div>
                    {renderComponentTree(
                      doc,
                      doc.rootSectionId,
                      selectedComponentId,
                      onSelect,
                      handleContextMenu,
                      handleDuplicate,
                      handleDelete,
                      renderContext,
                      activeDrag
                    )}
                  </div>
                </SortableContext>
              </div>
            </div>
          </div>
        </div>

        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
            aria-label="Component context menu"
          >
            <button
              onClick={() => {
                handleDuplicate(contextMenu.componentId);
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              Duplicate
            </button>
            <button
              onClick={() => {
                handleDelete(contextMenu.componentId);
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              Delete
            </button>
          </div>
        )}

        <DragOverlay>
          {activeDrag && (
            <div
              className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 opacity-90"
              style={{
                transform: snapDelta.x !== 0 || snapDelta.y !== 0
                  ? `translate(${snapDelta.x}px, ${snapDelta.y}px)`
                  : undefined,
              }}
            >
              <div className="text-sm font-medium text-slate-700">
                {activeDrag.componentType || "Component"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeDrag.operation === "create" ? "Drag to canvas" : "Dragging..."}
              </div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default DocumentEditor;