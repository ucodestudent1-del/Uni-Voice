import React, { useMemo } from "react";
import {
  findComponentDeep,
  getChildren,
  type ComponentId,
  type InvoiceDocument,
  type ParentId,
  getComponentDefinition,
} from "../document-model";

interface TreeNode {
  id: ComponentId;
  type: string;
  label: string;
  visible: boolean;
  children: TreeNode[];
}

function buildNodeTree(doc: InvoiceDocument, parentId: ParentId | null): TreeNode[] {
  const children = getChildren(doc, parentId ?? doc.rootSectionId);
  return children.map((id) => {
    const component = findComponentDeep(doc, id);
    const def = component ? getComponentDefinition(component.type as any) : null;
    const childChildren = component?.children && def?.canHaveChildren
      ? buildNodeTree(doc, id as ParentId)
      : [];
    return {
      id,
      type: component?.type ?? "unknown",
      label: (def?.label ?? component?.type ?? "unknown"),
      visible: component?.visible !== false,
      children: childChildren,
    };
  });
}

function renderTree(
  nodes: TreeNode[],
  level: number,
  selectedId: string | null,
  onSelect: (id: ComponentId) => void
): React.ReactNode {
  return nodes.map((node) => {
    const indent = level * 16;
    const isSelected = node.id === selectedId;
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 rounded px-1.5 py-0.75 text-sm cursor-pointer transition-colors ${
            isSelected
              ? "bg-primary-bg text-primary-brand"
              : "text-secondary hover:bg-surface-alt"
          }`}
          style={{ paddingLeft: `${indent + 4}px` }}
          onClick={() => onSelect(node.id)}
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={isSelected ? 0 : -1}
        >
          {hasChildren && (
            <span
              className="text-xs text-tertiary"
              aria-label={node.children.filter((c) => c.visible).length > 0 ? "expanded" : "collapsed"}
            >
              {node.children.filter((c) => c.visible).length > 0 ? "▼" : "▶"}
            </span>
          )}
          {!hasChildren && (
            <span className="w-3 text-center text-xs text-tertiary">•</span>
          )}
          <span
            className={`truncate ${node.visible ? "" : "opacity-50 italic"}`}
            title={node.label}
          >
            {node.label}
          </span>
          {node.type === "lineItems" && (
            <span className="ml-auto text-xs text-tertiary">📋</span>
          )}
        </div>
        {hasChildren && renderTree(node.children, level + 1, selectedId, onSelect)}
      </div>
    );
  });
}

export interface OutlineEditorProps {
  document: InvoiceDocument;
  selectedComponentId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate?: (id: ComponentId) => void;
  onRemove?: (id: ComponentId) => void;
  className?: string;
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({
  document,
  selectedComponentId,
  onSelect,
  onDuplicate,
  onRemove,
}) => {
  const [expanded, setExpanded] = React.useState<boolean>(true);

  const rootComponent = document.sections[document.rootSectionId];
  const rootChildren = (rootComponent?.children ?? []).filter(
    (id) => document.sections[id as string] || document.rows[id as string] || document.columns[id as string] || document.components[id as string]
  );

  if (!rootChildren.length) {
    return null;
  }

  const tree = useMemo(() => buildNodeTree(document, null), [document]);

  return (
    <div className="w-64 overflow-y-auto border-l border-color-subtle bg-surface">
      <div className="flex items-center justify-between border-b border-color-subtle px-3 py-2">
        <h3 className="text-xs font-medium text-secondary uppercase">Document Outline</h3>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded p-0.5 text-tertiary hover:bg-surface-alt hover:text-secondary"
          aria-label={expanded ? "Collapse outline" : "Expand outline"}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded && (
        <div className="overflow-y-auto" role="tree">
          {tree.map((root, i) => (
            <div key={`root-${root.id}-${i}`}>
              {renderTreeNode(root, 0, selectedComponentId, onSelect, onDuplicate, onRemove)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function renderTreeNode(
  node: TreeNode,
  level: number,
  selectedId: string | null,
  onSelect: (id: ComponentId) => void,
  onDuplicate?: (id: ComponentId) => void,
  onRemove?: (id: ComponentId) => void
): React.ReactNode {
  const indent = level * 16;
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;
  const isStructural = ["section", "row", "column"].includes(node.type);

  return (
    <div key={node.id}>
      <div
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.75 text-sm cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary-bg text-primary-brand"
            : "text-secondary hover:bg-surface-alt"
        }`}
        style={{ paddingLeft: `${indent + 4}px` }}
        onClick={() => onSelect(node.id)}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        {hasChildren && (
          <span
            className="text-xs text-tertiary"
            aria-label={node.children.filter((c) => c.visible).length > 0 ? "expanded" : "collapsed"}
          >
            {node.children.filter((c) => c.visible).length > 0 ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && (
          <span className="w-3 text-center text-xs text-tertiary">•</span>
        )}
        <span
          className={`truncate ${node.visible ? "" : "opacity-50 italic"}`}
          title={node.label}
        >
          {node.label}
        </span>
        {isStructural && (
          <span className="ml-auto text-xs text-tertiary" title={node.type}>
            {node.type === "row" ? "↔" : node.type === "column" ? "▭" : "[]"}
          </span>
        )}
        {isSelected && onDuplicate && onRemove && (
          <div
            className="ml-auto flex gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(node.id)}
                className="rounded p-0.5 text-tertiary hover:bg-surface-alt hover:text-secondary"
                title="Duplicate"
                aria-label={`Duplicate ${node.label}`}
              >
                📋
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(node.id)}
                className="rounded p-0.5 text-tertiary hover:bg-surface-alt hover:text-secondary"
                title="Delete"
                aria-label={`Delete ${node.label}`}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
      {hasChildren && renderTreeNodeChildren(node.children, level + 1, selectedId, onSelect, onDuplicate, onRemove)}
    </div>
  );
}

function renderTreeNodeChildren(
  nodes: TreeNode[],
  level: number,
  selectedId: string | null,
  onSelect: (id: ComponentId) => void,
  onDuplicate?: (id: ComponentId) => void,
  onRemove?: (id: ComponentId) => void
): React.ReactNode {
  return nodes.map((node) => renderTreeNode(node, level, selectedId, onSelect, onDuplicate, onRemove));
}

export default OutlineEditor;





