import React from "react";
import { AnyComponent, ComponentId, ComponentType, StyleProps } from "../types";
import { getComponentDefinition, InspectorContext } from "../registry/index";

export interface PropertyInspectorProps {
  componentId: ComponentId | null;
  component: AnyComponent | null;
  onSelect: (id: ComponentId) => void;
  onUpdate: (componentId: ComponentId, props: Record<string, unknown>, style?: Partial<StyleProps>) => void;
  onDelete: (componentId: ComponentId) => void;
  onDuplicate?: (componentId: ComponentId) => void;
  onVisibilityToggle: (componentId: ComponentId) => void;
  document: any;
  business: any;
  customer: any;
  currency: string;
  locale: string;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  componentId,
  component,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate = () => {},
  onVisibilityToggle,
  document,
  business,
  customer,
  currency,
  locale,
}) => {
  if (!component) {
    return (
      <div className="w-80 bg-surface border-l border-color-subtle p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-secondary mb-4">Properties</h3>
        <p className="text-sm text-tertiary">Select a component to edit its properties.</p>
      </div>
    );
  }

  const def = getComponentDefinition(component.type);
  if (!def) {
    return (
      <div className="w-80 bg-surface border-l border-color-subtle p-4 overflow-y-auto">
        <p className="text-sm text-secondary">Component definition not found.</p>
      </div>
    );
  }

  const inspectorContext: InspectorContext = {
    document,
    business,
    customer,
    currency,
    locale,
  };

  const handlePropsChange = (props: Partial<any>) => {
    onUpdate(component.id, props, undefined);
  };

  const handleStyleChange = (style: Partial<StyleProps>) => {
    onUpdate(component.id, {}, style);
  };

  return (
    <div className="w-80 bg-surface border-l border-color-subtle p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          {component.type} Properties
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => onVisibilityToggle(component.id)}
            aria-label={component.visible === false ? "Show component" : "Hide component"}
            aria-pressed={component.visible !== false}
            title={component.visible === false ? "Show component" : "Hide component"}
            className={`p-1 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
              component.visible === false
                ? "status-warning-bg text-warning-text"
                : "bg-surface-alt text-secondary hover:bg-surface-alt"
            }`}
          >
            {component.visible === false ? "hidden" : "visible"}
          </button>
          <button
            onClick={() => onDuplicate(component.id)}
            aria-label="Duplicate component"
            title="Duplicate (Ctrl+D)"
            className="p-1 rounded text-xs bg-surface-alt text-secondary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            📄
          </button>
          <button
            onClick={() => onDelete(component.id)}
            aria-label="Delete component"
            title="Delete (Delete)"
            className="p-1 rounded text-xs status-error-bg status-error-text hover:bg-error-bg focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-1"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-secondary uppercase mb-1">
          Component ID
        </label>
        <p className="text-xs text-tertiary break-all">{component.id}</p>
      </div>

      <div className="border-b border-color-subtle mb-4">
        {def.inspector(component, handlePropsChange, inspectorContext)}
      </div>

      <div className="border-b border-color-subtle mb-4">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Style</h4>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prop-font-size" className="block text-xs font-medium text-secondary mb-1">Font Size</label>
              <input
                id="prop-font-size"
                type="number"
                value={component.style.fontSize || ""}
                onChange={(e) => handleStyleChange({ fontSize: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="14"
                className="w-full text-sm border border-input-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="prop-color" className="block text-xs font-medium text-secondary mb-1">Color</label>
              <input
                id="prop-color"
                type="color"
                value={component.style.color || "#000000"}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
                className="w-full h-8 border border-input-border rounded-lg cursor-pointer p-0 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prop-font-weight" className="block text-xs font-medium text-secondary mb-1">Font Weight</label>
            <select
              id="prop-font-weight"
              value={component.style.fontWeight || "normal"}
              onChange={(e) => {
                const v = e.target.value;
                handleStyleChange({ fontWeight: v === "normal" ? "normal" : parseInt(v) });
              }}
              className="w-full text-sm border border-input-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="normal">Normal</option>
              <option value="300">Light</option>
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
              <option value="800">Extra Bold</option>
            </select>
          </div>

          <div>
            <label htmlFor="prop-text-align" className="block text-xs font-medium text-secondary mb-1">Text Align</label>
            <div className="flex gap-1">
              {(["left", "center", "right", "justify"] as const).map((align) => (
                <button
                  key={align}
                  id={`prop-text-align-${align}`}
                  aria-label={`Align text to ${align}`}
                  onClick={() => handleStyleChange({ textAlign: align })}
                  className={`flex-1 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary ${
                    component.style.textAlign === align
                      ? "bg-primary-bg text-primary-brand"
                      : "bg-surface-alt text-secondary hover:bg-surface-alt"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="prop-padding" className="block text-xs font-medium text-secondary mb-1">Padding</label>
            <input
              id="prop-padding"
              type="text"
              value={component.style.padding || ""}
              onChange={(e) => handleStyleChange({ padding: e.target.value || undefined })}
              placeholder="e.g. 8px or 8px 16px"
              className="w-full text-sm border border-input-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="prop-margin" className="block text-xs font-medium text-secondary mb-1">Margin</label>
            <input
              id="prop-margin"
              type="text"
              value={component.style.margin || ""}
              onChange={(e) => handleStyleChange({ margin: e.target.value || undefined })}
              placeholder="e.g. 8px or 8px 16px"
              className="w-full text-sm border border-input-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyInspector;






