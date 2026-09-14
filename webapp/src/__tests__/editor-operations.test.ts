import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import React from "react";
import {
  createEmptyDocument,
  InvoiceDocument,
  TextComponent,
  CustomFieldComponent,
} from "../document-model/types";
import {
  insertComponent,
  duplicateComponent,
  findComponentDeep,
  findSiblingsDeep,
  findComponent,
  getChildren,
  getSiblingIndex,
  removeComponent,
  moveComponent,
} from "../document-model/document-operations";
import { initializeRegistry } from "../document-model";
import { OutlineEditor } from "../document-model/editor/OutlineEditor";
import { getComponentDefinition } from "../document-model/registry";

initializeRegistry();

describe("editor-operations", () => {
  let doc: InvoiceDocument;

  beforeEach(() => {
    doc = createEmptyDocument("test-business", "Test Invoice");
  });

  describe("duplicateComponent", () => {
    it("creates a new component with a new ID", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Hello World", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const duplicatedDoc = duplicateComponent(docWithText, { componentId });

      const componentIds = Object.keys(duplicatedDoc.components);
      expect(componentIds).toHaveLength(2);

      const duplicatedId = componentIds.find((id) => id !== componentId);
      expect(duplicatedId).toBeDefined();
      expect(duplicatedId).not.toBe(componentId);
    });

    it("preserves props from the original component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Duplicate me", format: "markdown" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const duplicatedDoc = duplicateComponent(docWithText, { componentId });

      const original = findComponent(docWithText, componentId) as TextComponent;
      const duplicatedId = Object.keys(duplicatedDoc.components).find((id) => id !== componentId)!;
      const duplicated = findComponent(duplicatedDoc, duplicatedId) as TextComponent;

      expect(duplicated.props.content).toBe(original.props.content);
      expect(duplicated.props.format).toBe(original.props.format);
      expect(duplicated.type).toBe(original.type);
    });

    it("preserves style from the original component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Styled text", format: "plain" },
        style: { fontSize: 20, color: "#ff0000", textAlign: "center" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const duplicatedDoc = duplicateComponent(docWithText, { componentId });

      const duplicatedId = Object.keys(duplicatedDoc.components).find((id) => id !== componentId)!;
      const duplicated = findComponent(duplicatedDoc, duplicatedId) as TextComponent;

      expect(duplicated.style.fontSize).toBe(20);
      expect(duplicated.style.color).toBe("#ff0000");
      expect(duplicated.style.textAlign).toBe("center");
    });

    it("places the copy right after the original", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Original", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const duplicatedDoc = duplicateComponent(docWithText, { componentId });
      const siblings = getChildren(duplicatedDoc, columnId);

      const originalIndex = siblings.indexOf(componentId);
      const duplicatedId = Object.keys(duplicatedDoc.components).find((id) => id !== componentId)!;
      const duplicatedIndex = siblings.indexOf(duplicatedId);

      expect(duplicatedIndex).toBe(originalIndex + 1);
    });

    it("does not modify the original component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Original", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const originalBefore = findComponent(docWithText, componentId) as TextComponent;
      const originalProps = JSON.parse(JSON.stringify(originalBefore.props));
      const originalStyle = JSON.parse(JSON.stringify(originalBefore.style));

      const duplicatedDoc = duplicateComponent(docWithText, { componentId });

      const originalAfter = findComponent(duplicatedDoc, componentId) as TextComponent;
      expect(originalAfter.props).toEqual(originalProps);
      expect(originalAfter.style).toEqual(originalStyle);
    });

    it("places copy after original even with existing siblings", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "First", format: "plain" },
      });
      const componentId1 = Object.keys(docWithText1.components)[0];

      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "Second", format: "plain" },
      });
      const componentId2 = Object.keys(docWithText2.components).find((id) => id !== componentId1)!;

      const duplicatedDoc = duplicateComponent(docWithText2, { componentId: componentId1 });
      const siblings = getChildren(duplicatedDoc, columnId);

      const origIdx1 = siblings.indexOf(componentId1);
      const origIdx2 = siblings.indexOf(componentId2);
      const duplicatedId = Object.keys(duplicatedDoc.components).find(
        (id) => id !== componentId1 && id !== componentId2
      )!;
      const dupIdx = siblings.indexOf(duplicatedId);

      expect(dupIdx).toBe(origIdx1 + 1);
      expect(siblings.filter((id) => id !== componentId1 && id !== componentId2 && id !== duplicatedId)).toHaveLength(0);
    });

    it("duplicates structural components with their children recursively", () => {
      const rowId = Object.keys(doc.rows)[0];
      const columnId = Object.keys(doc.columns)[0];

      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Hello", format: "plain" },
      });

      const duplicatedDoc = duplicateComponent(docWithText, { componentId: rowId });

      expect(duplicatedDoc.rows[rowId]).toBeDefined();

      const duplicatedRowIds = Object.keys(duplicatedDoc.rows).filter((r) => r !== rowId);
      expect(duplicatedRowIds).toHaveLength(1);

      const duplicatedRow = findComponentDeep(duplicatedDoc, duplicatedRowIds[0]);
      expect(duplicatedRow).toBeDefined();
      expect(duplicatedRow!.type).toBe("row");
      expect(duplicatedRow!.children).toBeDefined();
      expect(duplicatedRow!.children!.length).toBe(1);

      const duplicatedColumnId = duplicatedRow!.children![0];
      const duplicatedColumn = findComponentDeep(duplicatedDoc, duplicatedColumnId);
      expect(duplicatedColumn).toBeDefined();
      expect(duplicatedColumn!.type).toBe("column");
      expect(duplicatedColumn!.children).toBeDefined();
      expect(duplicatedColumn!.children!.length).toBe(1);

      const duplicatedTextId = duplicatedColumn!.children![0];
      const duplicatedText = findComponent(duplicatedDoc, duplicatedTextId) as TextComponent;
      expect(duplicatedText).toBeDefined();
      expect(duplicatedText.props.content).toBe("Hello");

      expect(Object.keys(duplicatedDoc.components)).toHaveLength(2);
      expect(Object.keys(duplicatedDoc.columns)).toHaveLength(2);
    });

    it("assigns new IDs to all cloned children", () => {
      const rowId = Object.keys(doc.rows)[0];
      const columnId = Object.keys(doc.columns)[0];

      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Hello", format: "plain" },
      });

      const duplicatedDoc = duplicateComponent(docWithText, { componentId: rowId });

      const originalRowIds = Object.keys(docWithText.rows);
      const duplicatedRowIds = Object.keys(duplicatedDoc.rows);

      expect(duplicatedRowIds.length).toBe(originalRowIds.length + 1);

      for (const origRowId of originalRowIds) {
        expect(duplicatedDoc.rows[origRowId]).toBeDefined();
      }

      const newIds = duplicatedRowIds.filter((id) => !originalRowIds.includes(id));
      expect(newIds).toHaveLength(1);
      expect(newIds[0]).not.toBe(rowId);

      const originalColumnIds = Object.keys(docWithText.columns);
      const duplicatedColumnIds = Object.keys(duplicatedDoc.columns);
      expect(duplicatedColumnIds.length).toBe(originalColumnIds.length + 1);
    });

    it("can duplicate components with custom props", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithCustomField = insertComponent(doc, {
        type: "customField",
        parentId: columnId,
        index: 0,
        props: { key: "field_1", label: "Custom", value: "Value", type: "text" },
      });

      const componentId = Object.keys(docWithCustomField.components)[0];
      const duplicatedDoc = duplicateComponent(docWithCustomField, { componentId });

      const duplicatedId = Object.keys(duplicatedDoc.components).find((id) => id !== componentId)!;
      const duplicated = findComponent(duplicatedDoc, duplicatedId) as CustomFieldComponent;

      expect(duplicated.props.key).toBe("field_1");
      expect(duplicated.props.label).toBe("Custom");
      expect(duplicated.props.value).toBe("Value");
      expect(duplicated.props.type).toBe("text");
    });
  });

  describe("findComponentDeep", () => {
    it("finds components in the components dict", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const found = findComponentDeep(docWithText, componentId);

      expect(found).toBeDefined();
      expect(found?.type).toBe("text");
      expect(found?.id).toBe(componentId);
    });

    it("finds sections", () => {
      const found = findComponentDeep(doc, doc.rootSectionId);

      expect(found).toBeDefined();
      expect(found?.type).toBe("section");
      expect(found?.id).toBe(doc.rootSectionId);
    });

    it("finds rows", () => {
      const rowId = Object.keys(doc.rows)[0];
      const found = findComponentDeep(doc, rowId);

      expect(found).toBeDefined();
      expect(found?.type).toBe("row");
      expect(found?.id).toBe(rowId);
    });

    it("finds columns", () => {
      const columnId = Object.keys(doc.columns)[0];
      const found = findComponentDeep(doc, columnId);

      expect(found).toBeDefined();
      expect(found?.type).toBe("column");
      expect(found?.id).toBe(columnId);
    });

    it("returns undefined for non-existent ID", () => {
      const found = findComponentDeep(doc, "non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("findSiblingsDeep", () => {
    it("finds siblings of a leaf component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Text 1", format: "plain" },
      });
      const componentId1 = Object.keys(docWithText1.components)[0];

      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "Text 2", format: "plain" },
      });
      const componentId2 = Object.keys(docWithText2.components).find((id) => id !== componentId1)!;

      const siblings = findSiblingsDeep(docWithText2, componentId1);
      expect(siblings).toContain(componentId1);
      expect(siblings).toContain(componentId2);
      expect(siblings.length).toBe(2);
    });

    it("finds siblings of a structural component (section)", () => {
      const docWithSection = insertComponent(doc, {
        type: "section",
        parentId: doc.rootSectionId,
        index: 0,
        props: { name: "New Section", fullWidth: true },
      });

      const newSectionId = Object.keys(docWithSection.sections).find(
        (s) => s !== doc.rootSectionId
      )!;

      const siblings = findSiblingsDeep(docWithSection, newSectionId);
      expect(siblings).toContain(newSectionId);
      expect(siblings.length).toBeGreaterThan(1);
    });

    it("does not include the component itself in siblings for root section", () => {
      const siblings = findSiblingsDeep(doc, doc.rootSectionId);
      expect(siblings).toHaveLength(0);
    });
  });

  describe("removeComponent with structural components", () => {
    it("removes a section and its children", () => {
      const docWithSection = insertComponent(doc, {
        type: "section",
        parentId: doc.rootSectionId,
        index: 0,
        props: { name: "To Remove", fullWidth: true },
      });

      const newSectionId = Object.keys(docWithSection.sections).find(
        (s) => s !== doc.rootSectionId
      )!;
      const removedDoc = removeComponent(docWithSection, { componentId: newSectionId });

      expect(removedDoc.sections[newSectionId]).toBeUndefined();
    });

    it("removes a leaf component and cleans up parent children", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "To remove", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const removedDoc = removeComponent(docWithText, { componentId });

      expect(removedDoc.components[componentId]).toBeUndefined();
      expect(getChildren(removedDoc, columnId)).not.toContain(componentId);
    });
  });

  describe("OutlineEditor", () => {
    it("renders the correct tree structure", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Outline Test", format: "plain" },
        style: { fontSize: 16 },
      });

      const componentId = Object.keys(docWithText.components)[0];

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: componentId,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      const node = document.querySelector(`[data-component-id="${componentId}"]`) as HTMLElement;
      expect(node).toBeTruthy();
      expect(node?.getAttribute("data-component-type")).toBe("text");
    });

    it("renders root section and its children", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Child Text", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: null,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      const rootNode = document.querySelector(`[data-component-id="${docWithText.rootSectionId}"]`);
      expect(rootNode).toBeTruthy();

      const childNode = document.querySelector(`[data-component-id="${componentId}"]`);
      expect(childNode).toBeTruthy();
    });

    it("calls onSelect when a node is clicked", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Clickable", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const onSelect = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: null,
          onSelect,
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      const node = document.querySelector(`[data-component-id="${componentId}"]`) as HTMLElement;
      expect(node).toBeTruthy();

      act(() => {
        node.focus();
        node.click();
      });

      expect(onSelect).toHaveBeenCalledWith(componentId);
    });

    it("navigates tree structure and displays component names", () => {
      const rowId = Object.keys(doc.rows)[0];
      const columnId = Object.keys(doc.columns)[0];

      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Visible Content", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: null,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      const rowNode = document.querySelector(`[data-component-id="${rowId}"]`);
      const colNode = document.querySelector(`[data-component-id="${columnId}"]`);
      const textNode = document.querySelector(`[data-component-id="${componentId}"]`);

      expect(rowNode).toBeTruthy();
      expect(colNode).toBeTruthy();
      expect(textNode).toBeTruthy();

      const def = getComponentDefinition("text");
      expect(textNode?.textContent).toContain(def?.label ?? "text");
    });
  });

  describe("Keyboard shortcuts", () => {
    it("Delete key triggers onDelete for focused component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Shortcut Delete", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const onDelete = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: componentId,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete,
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      act(() => {
        fireEvent.keyDown(document, { key: "Delete", bubbles: true });
      });

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(componentId);
    });

    it("Ctrl+D triggers onDuplicate for focused component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Shortcut Dup", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const onDuplicate = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: componentId,
          onSelect: vi.fn(),
          onDuplicate,
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      act(() => {
        fireEvent.keyDown(document, { key: "d", ctrlKey: true, bubbles: true });
      });

      expect(onDuplicate).toHaveBeenCalledTimes(1);
      expect(onDuplicate).toHaveBeenCalledWith(componentId);
    });

    it("Ctrl+ArrowDown triggers move down when siblings exist", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "First", format: "plain" },
      });
      const id1 = Object.keys(docWithText1.components)[0];

      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "Second", format: "plain" },
      });
      const id2 = Object.keys(docWithText2.components).find((id) => id !== id1)!;

      const onMove = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText2,
          selectedComponentId: id1,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove,
        })
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true, bubbles: true });
      });

      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+ArrowUp triggers move up when position allows", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "First", format: "plain" },
      });
      const id1 = Object.keys(docWithText1.components)[0];

      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "Second", format: "plain" },
      });
      const id2 = Object.keys(docWithText2.components).find((id) => id !== id1)!;

      const onMove = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText2,
          selectedComponentId: id2,
          onSelect: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove,
        })
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowUp", ctrlKey: true, bubbles: true });
      });

      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("Enter key selects the focused component", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "Enter Test", format: "plain" },
      });

      const componentId = Object.keys(docWithText.components)[0];
      const onSelect = vi.fn();

      render(
        React.createElement(OutlineEditor, {
          document: docWithText,
          selectedComponentId: componentId,
          onSelect,
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onVisibilityToggle: vi.fn(),
          onMove: vi.fn(),
        })
      );

      act(() => {
        fireEvent.keyDown(document, { key: "Enter", bubbles: true });
      });

      expect(onSelect).toHaveBeenCalledWith(componentId);
    });
  });

  describe("moveComponent", () => {
    it("moves a component to a new index within the same parent", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "A", format: "plain" },
      });
      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "B", format: "plain" },
      });
      const docWithText3 = insertComponent(docWithText2, {
        type: "text",
        parentId: columnId,
        index: 2,
        props: { content: "C", format: "plain" },
      });

      const allIds = Object.keys(docWithText3.components);
      const idA = allIds[0];
      const idB = allIds[1];
      const idC = allIds[2];

      const movedDoc = moveComponent(docWithText3, {
        componentId: idC,
        newParentId: columnId,
        newIndex: 0,
      });

      const siblings = getChildren(movedDoc, columnId);
      expect(siblings[0]).toBe(idC);
      expect(siblings).toContain(idA);
      expect(siblings).toContain(idB);
    });
  });

  describe("getSiblingIndex", () => {
    it("returns the correct index of a component among siblings", () => {
      const columnId = Object.keys(doc.columns)[0];
      const docWithText1 = insertComponent(doc, {
        type: "text",
        parentId: columnId,
        index: 0,
        props: { content: "A", format: "plain" },
      });
      const docWithText2 = insertComponent(docWithText1, {
        type: "text",
        parentId: columnId,
        index: 1,
        props: { content: "B", format: "plain" },
      });

      const allIds = Object.keys(docWithText2.components);
      const idB = allIds[1];

      const index = getSiblingIndex(docWithText2, idB);
      expect(index).toBe(1);
    });
  });

  describe("getComponentDefinition integration", () => {
    it("returns definition with defaultProps and defaultStyle", () => {
      const def = getComponentDefinition("text");
      expect(def).toBeDefined();
      expect(def?.defaultProps).toBeDefined();
      expect(def?.defaultStyle).toBeDefined();
      expect(def?.canHaveChildren).toBe(false);
    });

    it("returns definition for structural components", () => {
      const sectionDef = getComponentDefinition("section");
      const rowDef = getComponentDefinition("row");
      const columnDef = getComponentDefinition("column");

      expect(sectionDef?.canHaveChildren).toBe(true);
      expect(rowDef?.canHaveChildren).toBe(true);
      expect(columnDef?.canHaveChildren).toBe(true);
    });
  });
});
