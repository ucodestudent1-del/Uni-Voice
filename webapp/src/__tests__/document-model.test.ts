import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyDocument,
  InvoiceDocument,
  ComponentType,
  makeUUID,
  AnyComponent,
  TextComponent,
  SectionComponent,
  RowComponent,
  ColumnComponent,
} from "../document-model/types";
import {
  insertComponent,
  updateComponent,
  moveComponent,
  removeComponent,
  setDocumentSettings,
  getChildren,
  findComponent,
  findParent,
  findSiblings,
  canDropComponent,
  validateComponentProps,
} from "../document-model/document-operations";
import { getComponentDefinition, validateComponentProps as registryValidateProps } from "../document-model/registry";
import { initializeRegistry } from "../document-model";

initializeRegistry();

function getTextComponent(doc: InvoiceDocument, componentId: string): TextComponent {
  return doc.components[componentId] as TextComponent;
}

describe("document-model", () => {
  let doc: InvoiceDocument;

  beforeEach(() => {
    doc = createEmptyDocument("test-business", "Test Invoice");
  });

  describe("createEmptyDocument", () => {
    it("creates a valid document with root section, row, and column", () => {
      expect(doc.id).toBeDefined();
      expect(doc.version).toBe(1);
      expect(doc.name).toBe("Test Invoice");
      expect(doc.businessId).toBe("test-business");
      expect(doc.rootSectionId).toBeDefined();
      expect(doc.sections[doc.rootSectionId]).toBeDefined();
      expect(doc.rows).toBeDefined();
      expect(doc.columns).toBeDefined();
      expect(doc.components).toBeDefined();
    });

    it("sets default document settings", () => {
      expect(doc.settings.pageSize).toBe("A4");
      expect(doc.settings.orientation).toBe("portrait");
      expect(doc.settings.currency).toBe("USD");
    });
  });

  describe("insertComponent", () => {
    it("inserts a text component into a column", () => {
      const columnId = Object.keys(doc.columns)[0];
      const newDoc = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Hello World", format: "plain" },
      });

      expect(Object.keys(newDoc.components)).toHaveLength(1);
      const componentId = Object.keys(newDoc.components)[0];
      const component = getTextComponent(newDoc, componentId);
      expect(component.type).toBe("text");
      expect(component.props.content).toBe("Hello World");
      expect(component.parentId).toBe(columnId);
    });

    it("inserts a structural section at root level", () => {
      const newDoc = insertComponent(doc, {
        type: "section",
        parentId: doc.rootSectionId,
        index: 0,
        props: { name: "New Section", fullWidth: true },
      });

      expect(newDoc.sections[Object.keys(newDoc.sections)[1]]).toBeDefined();
    });

    it("inserts a row into a section", () => {
      const newDoc = insertComponent(doc, {
        type: "row",
        parentId: doc.rootSectionId,
        index: 0,
        props: { name: "New Row", columns: 2, columnGap: 16, rowGap: 16 },
      });

      expect(Object.keys(newDoc.rows)).toHaveLength(2);
    });

    it("inserts a column into a row", () => {
      const rowId = Object.keys(doc.rows)[0];
      const newDoc = insertComponent(doc, {
        type: "column",
        parentId: rowId,
        index: 0,
        props: { name: "New Column", span: 6 },
      });

      expect(Object.keys(newDoc.columns)).toHaveLength(2);
    });

    it("allows dropping text into section directly", () => {
      expect(() => {
        insertComponent(doc, {
          type: "text",
          parentId: doc.rootSectionId,
          index: 0,
        });
      }).not.toThrow();
    });

    it("validates parent constraints - rejects section in column", () => {
      const columnId = Object.keys(doc.columns)[0];
      expect(() => {
        insertComponent(doc, {
          type: "section",
          parentId: columnId,
          index: 0,
        });
      }).toThrow();
    });
  });

  describe("updateComponent", () => {
    it("updates component props", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Original", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const updatedDoc = updateComponent(docWithText, {
        componentId,
        props: { content: "Updated", format: "markdown" },
      });

      const component = getTextComponent(updatedDoc, componentId);
      expect(component.props.content).toBe("Updated");
      expect(component.props.format).toBe("markdown");
    });

    it("updates component style", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const updatedDoc = updateComponent(docWithText, {
        componentId,
        style: { fontSize: 18, color: "#ff0000" },
      });

      const component = getTextComponent(updatedDoc, componentId);
      expect(component.style.fontSize).toBe(18);
      expect(component.style.color).toBe("#ff0000");
    });

    it("validates props against Zod schema", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      expect(() => {
        updateComponent(docWithText, {
          componentId,
          props: { content: 123, format: "plain" },
        });
      }).toThrow();
    });
  });

  describe("moveComponent", () => {
    it("moves a component to a different parent", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const rowId = Object.keys(docWithText.rows)[0];

      const docWithNewColumn = insertComponent(docWithText, {
        type: "column",
        parentId: rowId,
        index: 1,
        props: { name: "New Column", span: 6 },
      });

      const selectedColumnId = Object.keys(docWithNewColumn.columns).find((id) => id !== columnId)!;

      const movedDoc = moveComponent(docWithNewColumn, {
        componentId,
        newParentId: selectedColumnId,
        newIndex: 0,
      });

      expect(movedDoc.components[componentId].parentId).toBe(selectedColumnId);
    });

    it("allows moving text into section directly", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      expect(() => {
        moveComponent(docWithText, {
          componentId,
          newParentId: docWithText.rootSectionId,
          newIndex: 0,
        });
      }).not.toThrow();
    });
  });

  describe("removeComponent", () => {
    it("removes a component and its children", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const removedDoc = removeComponent(docWithText, { componentId });

      expect(removedDoc.components[componentId]).toBeUndefined();
      expect(getChildren(removedDoc, columnId)).not.toContain(componentId);
    });
  });

  describe("setDocumentSettings", () => {
    it("updates document settings", () => {
      const updatedDoc = setDocumentSettings(doc, {
        settings: { pageSize: "Letter", currency: "EUR" },
      });

      expect(updatedDoc.settings.pageSize).toBe("Letter");
      expect(updatedDoc.settings.currency).toBe("EUR");
    });
  });

  describe("getChildren", () => {
    it("returns children of a section", () => {
      const children = getChildren(doc, doc.rootSectionId);
      expect(children.length).toBeGreaterThan(0);
    });

    it("returns children of a row", () => {
      const rowId = Object.keys(doc.rows)[0];
      const children = getChildren(doc, rowId);
      expect(children.length).toBeGreaterThan(0);
    });

    it("returns children of a column", () => {
      const columnId = Object.keys(doc.columns)[0];
      const children = getChildren(doc, columnId);
      expect(Array.isArray(children)).toBe(true);
    });
  });

  describe("findComponent", () => {
    it("finds a component by ID", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const component = findComponent(docWithText, componentId);

      expect(component).toBeDefined();
      expect(component?.id).toBe(componentId);
    });

    it("returns undefined for non-existent ID", () => {
      const component = findComponent(doc, "non-existent-id");
      expect(component).toBeUndefined();
    });
  });

  describe("findParent", () => {
    it("finds the parent of a component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const parentId = findParent(docWithText, componentId);

      expect(parentId).toBe(columnId);
    });
  });

  describe("findSiblings", () => {
    it("finds siblings of a component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test 1", format: "plain" },
      });

      const componentId1 = Object.keys(docWithText1.components)[0];
      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "Test 2", format: "plain" },
      });

      const siblings = findSiblings(docWithText2, componentId1);
      expect(siblings.length).toBe(2);
    });
  });

  describe("canDropComponent", () => {
    it("allows dropping text into column", () => {
      const columnId = Object.keys(doc.columns)[0];
      const result = canDropComponent(doc, "text", columnId);
      expect(result.success).toBe(true);
    });

    it("allows dropping section at root", () => {
      const result = canDropComponent(doc, "section", doc.rootSectionId);
      expect(result.success).toBe(true);
    });

    it("allows dropping row into section", () => {
      const result = canDropComponent(doc, "row", doc.rootSectionId);
      expect(result.success).toBe(true);
    });

    it("allows dropping column into row", () => {
      const rowId = Object.keys(doc.rows)[0];
      const result = canDropComponent(doc, "column", rowId);
      expect(result.success).toBe(true);
    });

    it("allows dropping text into section directly", () => {
      const result = canDropComponent(doc, "text", doc.rootSectionId);
      expect(result.success).toBe(true);
    });

    it("rejects dropping section into column", () => {
      const columnId = Object.keys(doc.columns)[0];
      const result = canDropComponent(doc, "section", columnId);
      expect(result.success).toBe(false);
    });
  });

  describe("validateComponentProps", () => {
    it("validates text component props", () => {
      const result = validateComponentProps("text", {
        id: "cmp_test",
        type: "text",
        props: { content: "Hello", format: "plain" },
        style: {},
        children: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid text component props", () => {
      const result = validateComponentProps("text", {
        id: "cmp_test",
        type: "text",
        props: { content: 123, format: "plain" },
        style: {},
        children: [],
      });
      expect(result.success).toBe(false);
    });

    it("validates lineItems component props", () => {
      const result = validateComponentProps("lineItems", {
        id: "cmp_test",
        type: "lineItems",
        props: {
          columns: [{ key: "desc", label: "Description", visible: true }],
          showHeader: true,
          showQuantity: true,
          showUnit: true,
          showUnitPrice: true,
          showDiscount: false,
          showTax: true,
          showLineTotal: true,
          currency: "USD",
          allowMultiPage: true,
        },
        style: {},
        children: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("registry validation", () => {
    it("validates component props via registry", () => {
      const result = registryValidateProps("text", {
        id: "cmp_test",
        type: "text",
        props: { content: "Hello", format: "plain" },
        style: {},
        children: [],
      });
      expect(result.success).toBe(true);
    });

    it("gets component definition", () => {
      const def = getComponentDefinition("text");
      expect(def).toBeDefined();
      expect(def?.type).toBe("text");
    });
  });
});