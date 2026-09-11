import { ComponentType, AnyComponent, StyleProps, LineItemColumn } from "../types";
import { componentSchemas } from "../schemas";
import { z } from "zod";

export interface ComponentDefinition<T extends AnyComponent = AnyComponent> {
  type: ComponentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "structure" | "business" | "content" | "totals";
  defaultProps: T["props"];
  defaultStyle: StyleProps;
  schema: z.ZodType<T>;
  canHaveChildren: boolean;
  allowedParentTypes: ComponentType[];
  render: (component: T, context: RenderContext, children?: React.ReactNode) => React.ReactNode;
  inspector: (component: T, onChange: (props: Partial<T["props"]>, style: Partial<StyleProps>) => void, context: InspectorContext) => React.ReactNode;
}

export interface RenderContext {
  document: any;
  business: any;
  customer: any;
  invoice: any;
  calculations: any;
  currency: string;
  locale: string;
  isEditing: boolean;
  selectedComponentId: string | null;
  onSelect: (id: string) => void;
}

export interface InspectorContext {
  document: any;
  business: any;
  customer: any;
  currency: string;
  locale: string;
}

export interface PaletteItem {
  type: ComponentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "structure" | "business" | "content" | "totals";
}

const componentRegistry = new Map<ComponentType, ComponentDefinition>();

export function registerComponent<T extends AnyComponent>(definition: ComponentDefinition<T>): void {
  componentRegistry.set(definition.type, definition as unknown as ComponentDefinition);
}

export function getComponentDefinition(type: ComponentType): ComponentDefinition | undefined {
  return componentRegistry.get(type);
}

export function getAllComponentDefinitions(): ComponentDefinition[] {
  return Array.from(componentRegistry.values());
}

export function getPaletteItems(): PaletteItem[] {
  return Array.from(componentRegistry.values()).map((def) => ({
    type: def.type,
    label: def.label,
    description: def.description,
    icon: def.icon,
    category: def.category,
  }));
}

export function getComponentSchema(type: ComponentType) {
  return componentSchemas[type];
}

export function validateComponentProps(type: ComponentType, props: unknown) {
  const schema = componentSchemas[type];
  if (!schema) return { success: false, error: `No schema for type ${type}` };
  const result = schema.safeParse(props);
  return result;
}

export function createDefaultComponent(type: ComponentType): AnyComponent | null {
  const def = componentRegistry.get(type);
  if (!def) return null;

  const id = `cmp_${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    type,
    props: def.defaultProps,
    style: def.defaultStyle,
    children: def.canHaveChildren ? [] : undefined,
    parentId: undefined,
    visible: true,
  } as unknown as AnyComponent;
}

export function getComponentsByCategory(category: PaletteItem["category"]): ComponentDefinition[] {
  return Array.from(componentRegistry.values()).filter((def) => def.category === category);
}