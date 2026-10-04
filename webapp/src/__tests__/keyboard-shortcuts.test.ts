import { describe, it, expect } from "vitest";

import {
  buildKeyComboFn,
  getActionFn,
  getShortcutsHelp,
} from "../hooks/useKeyboardShortcuts";

function makeKeyboardEvent(props: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const eventInit: Record<string, unknown> = {
    bubbles: true,
    cancelable: true,
    ...props,
  };
  return new KeyboardEvent("keydown", eventInit);
}

describe("useKeyboardShortcuts helpers", () => {
  describe("buildKeyComboFn", () => {
    it("builds a combo with Control key", () => {
      const e = makeKeyboardEvent({ ctrlKey: true, key: "s" });
      expect(buildKeyComboFn(e)).toBe("Control+S");
    });

    it("builds a combo with Meta key", () => {
      const e = makeKeyboardEvent({ metaKey: true, key: "s" });
      expect(buildKeyComboFn(e)).toBe("Meta+S");
    });

    it("builds a combo with Shift key", () => {
      const e = makeKeyboardEvent({ shiftKey: true, key: "S" });
      expect(buildKeyComboFn(e)).toBe("Shift+S");
    });

    it("builds a combo with Alt key", () => {
      const e = makeKeyboardEvent({ altKey: true, key: "f" });
      expect(buildKeyComboFn(e)).toBe("Alt+F");
    });

    it("builds a combo with multiple modifiers", () => {
      const e = makeKeyboardEvent({ ctrlKey: true, shiftKey: true, key: "S" });
      expect(buildKeyComboFn(e)).toBe("Control+Shift+S");
    });

    it("builds a combo with Meta and Shift", () => {
      const e = makeKeyboardEvent({ metaKey: true, shiftKey: true, key: "S" });
      expect(buildKeyComboFn(e)).toBe("Meta+Shift+S");
    });

    it("handles special keys", () => {
      const enter = makeKeyboardEvent({ key: "Enter" });
      expect(buildKeyComboFn(enter)).toBe("Enter");

      const tab = makeKeyboardEvent({ key: "Tab" });
      expect(buildKeyComboFn(tab)).toBe("Tab");

      const escape = makeKeyboardEvent({ key: "Escape" });
      expect(buildKeyComboFn(escape)).toBe("Escape");

      const del = makeKeyboardEvent({ key: "Delete" });
      expect(buildKeyComboFn(del)).toBe("Delete");
    });

    it("handles slash key (search shortcut)", () => {
      const e = makeKeyboardEvent({ key: "/" });
      expect(buildKeyComboFn(e)).toBe("/");
    });

    it("handles period key", () => {
      const e = makeKeyboardEvent({ key: "." });
      expect(buildKeyComboFn(e)).toBe(".");
    });

    it("lowercases letter keys without modifiers", () => {
      const e = makeKeyboardEvent({ key: "p" });
      expect(buildKeyComboFn(e)).toBe("P");
    });

    it("handles Backspace key", () => {
      const e = makeKeyboardEvent({ key: "Backspace" });
      expect(buildKeyComboFn(e)).toBe("Backspace");
    });
  });

  describe("getActionFn", () => {
    it("returns 'save' for Control+S", () => {
      expect(getActionFn("Control+S")).toBe("save");
    });

    it("returns 'save' for Meta+S", () => {
      expect(getActionFn("Meta+S")).toBe("save");
    });

    it("returns 'finalize' for Control+Enter", () => {
      expect(getActionFn("Control+Enter")).toBe("finalize");
    });

    it("returns 'send' for Control+Shift+Enter", () => {
      expect(getActionFn("Control+Shift+Enter")).toBe("send");
    });

    it("returns 'duplicate' for Control+D", () => {
      expect(getActionFn("Control+D")).toBe("duplicate");
    });

    it("returns 'add-item' for Control+N", () => {
      expect(getActionFn("Control+N")).toBe("add-item");
    });

    it("returns 'add-fee' for Control+Shift+F", () => {
      expect(getActionFn("Control+Shift+F")).toBe("add-fee");
    });

    it("returns 'focus-search' for slash", () => {
      expect(getActionFn("/")).toBe("focus-search");
    });

    it("returns 'toggle-preview' for p or Control+P", () => {
      expect(getActionFn("P")).toBe("toggle-preview");
      expect(getActionFn("Control+P")).toBe("toggle-preview");
    });

    it("returns 'next-field' for Tab", () => {
      expect(getActionFn("Tab")).toBe("next-field");
    });

    it("returns 'prev-field' for Shift+Tab", () => {
      expect(getActionFn("Shift+Tab")).toBe("prev-field");
    });

    it("returns 'cancel' for Escape", () => {
      expect(getActionFn("Escape")).toBe("cancel");
    });

    it("returns 'delete' for Delete", () => {
      expect(getActionFn("Delete")).toBe("delete");
    });

    it("returns undefined for unrecognized shortcut", () => {
      expect(getActionFn("Control+X")).toBeUndefined();
    });

    it("handles lowercase shortcut lookup", () => {
      expect(getActionFn("control+s")).toBe("save");
    });

    it("handles uppercase shortcut lookup", () => {
      expect(getActionFn("CONTROL+S")).toBe("save");
    });
  });

  describe("getShortcutsHelp", () => {
    it("returns an array of shortcut descriptions", () => {
      const help = getShortcutsHelp();
      expect(Array.isArray(help)).toBe(true);
      expect(help.length).toBeGreaterThan(0);
    });

    it("includes expected actions", () => {
      const help = getShortcutsHelp();
      const actions = help.map((h) => h.action);
      expect(actions).toContain("save");
      expect(actions).toContain("finalize");
      expect(actions).toContain("send");
      expect(actions).toContain("duplicate");
      expect(actions).toContain("add-item");
      expect(actions).toContain("add-fee");
      expect(actions).toContain("focus-search");
      expect(actions).toContain("toggle-preview");
      expect(actions).toContain("next-field");
      expect(actions).toContain("prev-field");
      expect(actions).toContain("cancel");
    });

    it("each entry has keys, action, and description", () => {
      const help = getShortcutsHelp();
      help.forEach((entry) => {
        expect(entry).toHaveProperty("keys");
        expect(entry).toHaveProperty("action");
        expect(entry).toHaveProperty("description");
        expect(typeof entry.keys).toBe("string");
        expect(typeof entry.action).toBe("string");
        expect(typeof entry.description).toBe("string");
      });
    });
  });
});
