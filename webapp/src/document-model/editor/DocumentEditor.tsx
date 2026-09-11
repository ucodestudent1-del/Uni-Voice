import React, { useState, useCallback, ReactNode } from "react";
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
  useDraggable,
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

type DragOperation = "create" | "reorder";

interface ActiveDrag {
  operation: DragOperation;
  componentId: ComponentId | null;
  componentType: ComponentType | null;
  sourceParentId: ParentId | null;
  sourceIndex: number;
}

export const PALETTE_DRAGGABLE_ID_PREFIX = "palette-";

export interface DocumentEditorProps {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  onSelect: (id: ComponentId) => void;
  onInsertComponent: (params: { type: ComponentType; parentId: ParentId; index: number }) => void;
  onReorderComponent: (params: { componentId: ComponentId; newParentId: ParentId; newIndex: number }) => void;
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

function getComponentIcon(type: ComponentType): React.ReactNode {
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
      "
    >
      <span className="text-lg">{getComponentIcon(type)}</span>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
};

const SortableNode: React.FC<{
  componentId: ComponentId;
  doc: InvoiceDocument;
  isSelected: boolean;
  onSelect: (id: ComponentId) => void;
  renderContext: RenderContext;
}> = ({ componentId, doc, isSelected, onSelect, renderContext }) => {
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
    ${isSelected
      ? "ring-2 ring-primary-500 border-primary-500 bg-primary-50"
      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
    }
    ${isStructural ? "bg-slate-50" : "bg-white"}
  `;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(componentId);
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
      data-component-id={componentId}
      data-component-type={component.type}
    >
      <div style={{ ...component.style, ...(component.visible === false ? { opacity: 0.5 } : {}) }}>
        {content}
      </div>
    </div>
  );
};

const DropZone: React.FC<{
  id: string;
  parentId: ParentId;
  index: number;
  activeDrag: ActiveDrag | null;
}> = ({ id, parentId, index, activeDrag }) => {
  const canReceive = activeDrag?.operation === "create" ||
    (activeDrag?.operation === "reorder" && activeDrag.componentId !== null);

  return (
    <div
      key={id}
      id={id}
      data-dropzone={id}
      className={`
        border-2 border-dashed rounded-lg py-3 text-center text-sm
        transition-all duration-200 mb-2
        ${canReceive
          ? "border-primary-300 bg-primary-50 text-primary-700"
          : "border-slate-200 text-slate-400"
        }
      `}
    >
      Drop here
    </div>
  );
};

function renderComponentTree(
  doc: InvoiceDocument,
  parentId: ParentId,
  selectedComponentId: ComponentId | null,
  onSelect: (id: ComponentId) => void,
  renderContext: RenderContext,
  activeDrag: ActiveDrag | null
): ReactNode {
  const children = getChildren(doc, parentId);

  const items = children.map((childId, index) => {
    const child = findComponent(doc, childId);
    if (!child) return null;

    const dzKey = `dz-${childId}`;
    const nodeKey = `node-${childId}`;

    return (
      <React.Fragment key={nodeKey}>
        <DropZone
          id={`dropzone-${childId}`}
          parentId={childId}
          index={index}
          activeDrag={activeDrag}
        />
        <SortableNode
          componentId={childId}
          doc={doc}
          isSelected={selectedComponentId === childId}
          onSelect={onSelect}
          renderContext={renderContext}
        />
      </React.Fragment>
    );
  });

  return (
    <>
      <DropZone
        id={`dropzone-${parentId as string}-0`}
        parentId={parentId}
        index={0}
        activeDrag={activeDrag}
      />
      {items}
      <DropZone
        id={`dropzone-${parentId as string}-${children.length}`}
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
  business,
  customer,
  invoice,
  calculations,
  currency,
  locale,
}) => {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    } else {
      const component = findComponent(doc, activeId as ComponentId);
      if (!component) return;

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
      return;
    }

    const overId = over.id as string;

    if (activeDrag.operation === "create") {
      if (overId.startsWith("dropzone-")) {
        const targetParentId = overId.replace("dropzone-", "").replace(/-\d+$/, "") as ParentId;

        if (canDropComponent(doc, activeDrag.componentType!, targetParentId)) {
          onInsertComponent({
            type: activeDrag.componentType!,
            parentId: targetParentId,
            index: 0,
          });
        }
      }
    } else if (activeDrag.operation === "reorder" && activeDrag.componentId) {
      const draggedId = activeDrag.componentId;

      if (draggedId === overId) {
        setActiveDrag(null);
        return;
      }

      if (overId.startsWith("dropzone-")) {
        const targetParent = overId.replace("dropzone-", "").replace(/-\d+$/, "") as ParentId;
        onReorderComponent({
          componentId: draggedId,
          newParentId: targetParent,
          newIndex: 0,
        });
      } else {
        const targetSiblings = findSiblings(doc, overId as ComponentId);
        let targetIndex = targetSiblings.indexOf(overId as ComponentId);
        let targetParentId: ParentId | null = findParent(doc, overId as ComponentId);

        if (!targetParentId) {
          targetParentId = doc.rootSectionId;
        }

        if (targetIndex === -1) {
          const targetComponent = findComponent(doc, overId as ComponentId);
          if (targetComponent && targetComponent.parentId) {
            targetParentId = targetComponent.parentId;
          }
        }

        if (targetParentId) {
          onReorderComponent({
            componentId: draggedId,
            newParentId: targetParentId,
            newIndex: Math.max(0, targetIndex),
          });
        }
      }
    }

    setActiveDrag(null);
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

        <div className="flex-1 overflow-auto">
          <div className="p-6 bg-slate-50 h-full">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 min-h-[600px]">
                <SortableContext items={rootChildren} strategy={verticalListSortingStrategy}>
                  <div>
                    <DropZone
                      id={`dropzone-${doc.rootSectionId}-0`}
                      parentId={doc.rootSectionId}
                      index={0}
                      activeDrag={activeDrag}
                    />
                    {rootChildren.map((childId) => {
                      const child = findComponent(doc, childId);
                      if (!child) return null;
                      return (
                        <React.Fragment key={childId}>
                          <SortableNode
                            componentId={childId}
                            doc={doc}
                            isSelected={selectedComponentId === childId}
                            onSelect={onSelect}
                            renderContext={renderContext}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </SortableContext>
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeDrag && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 opacity-90">
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
