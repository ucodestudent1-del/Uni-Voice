import {
  InvoiceDocument,
  AnyComponent,
  ComponentId,
  ComponentType,
  SectionId,
  RowId,
  ColumnId,
  ParentId,
  SectionComponent,
  RowComponent,
  ColumnComponent,
  StyleProps,
} from "./types";

export interface InsertComponentParams {
  type: ComponentType;
  parentId: ParentId;
  index: number;
  props?: any;
  style?: StyleProps;
}

export interface UpdateComponentParams {
  componentId: ComponentId;
  props?: Record<string, unknown>;
  style?: StyleProps;
  visible?: boolean;
  condition?: string;
}

export interface MoveComponentParams {
  componentId: ComponentId;
  newParentId: ParentId;
  newIndex: number;
}

export interface RemoveComponentParams {
  componentId: ComponentId;
}

export interface SetSettingsParams {
  settings: Partial<InvoiceDocument["settings"]>;
}

export interface DocumentOperation {
  type: "insert" | "update" | "move" | "remove" | "set_settings";
  payload: InsertComponentParams | UpdateComponentParams | MoveComponentParams | RemoveComponentParams | SetSettingsParams;
}

export class DocumentBuilder {
  private doc: InvoiceDocument;

  constructor(doc: InvoiceDocument) {
    this.doc = JSON.parse(JSON.stringify(doc));
  }

  get document(): InvoiceDocument {
    return this.doc;
  }

  insertComponent(params: InsertComponentParams): DocumentBuilder {
    const { type, parentId, index } = params;
    this.ensureParentExists(parentId);

    const component = this.createComponent(type, params.props, params.style);
    component.parentId = parentId;

    this.addChild(parentId, component.id, index);
    this.doc.components[component.id] = component;

    return this;
  }

  updateComponent(params: UpdateComponentParams): DocumentBuilder {
    const { componentId, props, style, visible, condition } = params;
    const component = this.doc.components[componentId];
    if (!component) return this;

    if (props) {
      component.props = { ...component.props, ...props };
    }
    if (style) {
      component.style = { ...component.style, ...style };
    }
    if (visible !== undefined) {
      component.visible = visible;
    }
    if (condition !== undefined) {
      component.condition = condition;
    }

    this.doc.updatedAt = new Date().toISOString();
    this.doc.version += 1;

    return this;
  }

  moveComponent(params: MoveComponentParams): DocumentBuilder {
    const { componentId, newParentId, newIndex } = params;
    this.removeFromParent(componentId);
    this.insertIntoParent(componentId, newParentId, newIndex);
    this.doc.components[componentId].parentId = newParentId;
    this.doc.updatedAt = new Date().toISOString();
    this.doc.version += 1;
    return this;
  }

  removeComponent(params: RemoveComponentParams): DocumentBuilder {
    const { componentId } = params;
    this.removeFromParent(componentId);
    delete this.doc.components[componentId];
    this.doc.updatedAt = new Date().toISOString();
    this.doc.version += 1;
    return this;
  }

  setSettings(settings: SetSettingsParams): DocumentBuilder {
    this.doc.settings = { ...this.doc.settings, ...settings.settings };
    this.doc.updatedAt = new Date().toISOString();
    this.doc.version += 1;
    return this;
  }

  build(): InvoiceDocument {
    return this.doc;
  }

  private createComponent(type: ComponentType, props?: any, style?: StyleProps): AnyComponent {
    const id = this.generateId();
    const base = {
      id,
      type,
      props: props ?? {},
      style: { ...style },
      children: [],
      parentId: undefined,
      visible: true,
    };

    switch (type) {
      case "section":
        return { ...base, props: { name: "Section", fullWidth: true, ...props }, children: [] } as SectionComponent;
      case "row":
        return { ...base, props: { name: "Row", columns: 2, columnGap: 16, rowGap: 16, ...props }, children: [] } as RowComponent;
      case "column":
        return { ...base, props: { name: "Column", span: 1, ...props }, children: [] } as ColumnComponent;
      default:
        return base as AnyComponent;
    }
  }

  private generateId(): string {
    return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private ensureParentExists(parentId: ParentId): void {
    if (this.doc.sections[parentId as string]) return;
    if (this.doc.rows[parentId as string]) return;
    if (this.doc.columns[parentId as string]) return;
    if (this.doc.components[parentId as string]) return;
    throw new Error(`Parent with id ${parentId} not found`);
  }

  private addChild(parentId: ParentId, childId: string, index: number): void {
    const children = this.getChildren(parentId);
    if (index < 0 || index > children.length) {
      index = children.length;
    }
    children.splice(index, 0, childId);
  }

  private getChildren(parentId: ParentId): ComponentId[] {
    const section = this.doc.sections[parentId as string];
    if (section) return section.children;

    const row = this.doc.rows[parentId as string];
    if (row) return row.children;

    const column = this.doc.columns[parentId as string];
    if (column) return column.children;

    const component = this.doc.components[parentId as string];
    if (component) {
      if (!component.children) {
        component.children = [];
      }
      return component.children;
    }

    throw new Error(`Cannot get children for parent ${parentId}`);
  }

  private removeFromParent(componentId: ComponentId): void {
    const component = this.doc.components[componentId];
    if (!component || !component.parentId) return;

    const parentId = component.parentId;

    const section = this.doc.sections[parentId as string];
    if (section) {
      section.children = section.children.filter((id) => id !== componentId);
      return;
    }

    const row = this.doc.rows[parentId as string];
    if (row) {
      row.children = row.children.filter((id) => id !== componentId);
      return;
    }

    const column = this.doc.columns[parentId as string];
    if (column) {
      column.children = column.children.filter((id) => id !== componentId);
      return;
    }

    const parentComponent = this.doc.components[parentId as string];
    if (parentComponent && parentComponent.children) {
      parentComponent.children = parentComponent.children.filter((id) => id !== componentId);
    }
  }

  private insertIntoParent(componentId: ComponentId, parentId: ParentId, index: number): void {
    const children = this.getChildren(parentId);
    if (index < 0 || index > children.length) {
      index = children.length;
    }
    children.splice(index, 0, componentId);
  }
}

export function insertComponent(doc: InvoiceDocument, params: InsertComponentParams): InvoiceDocument {
  return new DocumentBuilder(doc).insertComponent(params).build();
}

export function updateComponent(doc: InvoiceDocument, params: UpdateComponentParams): InvoiceDocument {
  return new DocumentBuilder(doc).updateComponent(params).build();
}

export function moveComponent(doc: InvoiceDocument, params: MoveComponentParams): InvoiceDocument {
  return new DocumentBuilder(doc).moveComponent(params).build();
}

export function removeComponent(doc: InvoiceDocument, params: RemoveComponentParams): InvoiceDocument {
  return new DocumentBuilder(doc).removeComponent(params).build();
}

export function setDocumentSettings(doc: InvoiceDocument, settings: SetSettingsParams): InvoiceDocument {
  return new DocumentBuilder(doc).setSettings(settings).build();
}

export function getRootSectionChildren(doc: InvoiceDocument): ComponentId[] {
  const rootSection = doc.sections[doc.rootSectionId];
  if (!rootSection) return [];
  return rootSection.children;
}

export function getComponentChildren(doc: InvoiceDocument, componentId: ComponentId): ComponentId[] {
  const component = doc.components[componentId];
  if (!component) return [];
  return component.children ?? [];
}

export function findComponent(doc: InvoiceDocument, id: ComponentId): AnyComponent | undefined {
  return doc.components[id];
}

export function findParent(doc: InvoiceDocument, componentId: ComponentId): ParentId | null {
  const component = doc.components[componentId];
  if (component && component.parentId) {
    return component.parentId;
  }
  return null;
}

export function findSiblings(doc: InvoiceDocument, componentId: ComponentId): ComponentId[] {
  const parentId = findParent(doc, componentId);
  if (!parentId) return [];
  return getChildren(doc, parentId);
}

export function getSiblingIndex(doc: InvoiceDocument, componentId: ComponentId): number {
  const siblings = findSiblings(doc, componentId);
  return siblings.indexOf(componentId);
}

export function getChildren(doc: InvoiceDocument, parentId: ParentId): ComponentId[] {
  const section = doc.sections[parentId as string];
  if (section) return [...section.children];

  const row = doc.rows[parentId as string];
  if (row) return [...row.children];

  const column = doc.columns[parentId as string];
  if (column) return [...column.children];

  const component = doc.components[parentId as string];
  if (component) return [...(component.children ?? [])];

  return [];
}

export function getComponentTree(doc: InvoiceDocument, parentId: ParentId | null = null): ComponentId[] {
  if (!parentId) {
    parentId = doc.rootSectionId;
  }
  const children = getChildren(doc, parentId);
  const result: ComponentId[] = [];
  for (const childId of children) {
    result.push(childId);
    result.push(...getComponentTree(doc, childId));
  }
  return result;
}

export function canDropComponent(
  doc: InvoiceDocument,
  componentType: ComponentType,
  targetParentId: ParentId | null
): boolean {
  if (!componentType) return false;

  const isStructural = componentType === "section" || componentType === "row" || componentType === "column";

  if (isStructural) {
    if (componentType === "section") {
      return targetParentId === null || targetParentId === doc.rootSectionId;
    }
    if (componentType === "row") {
      return targetParentId !== null && doc.sections[targetParentId as string] !== undefined;
    }
    if (componentType === "column") {
      return targetParentId !== null && doc.rows[targetParentId as string] !== undefined;
    }
  }

  return targetParentId !== null && doc.columns[targetParentId as string] !== undefined;
}
