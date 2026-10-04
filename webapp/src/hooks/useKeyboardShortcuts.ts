import { useEffect, useCallback, useMemo } from "react";

export type KeyboardAction =
  | "save"
  | "finalize"
  | "send"
  | "duplicate"
  | "add-item"
  | "add-fee"
  | "focus-search"
  | "toggle-preview"
  | "next-field"
  | "prev-field"
  | "cancel"
  | "delete";

export interface KeyboardShortcutsConfig {
  enabled?: boolean;
  onSave?: () => void;
  onFinalize?: () => void;
  onSend?: () => void;
  onDuplicate?: () => void;
  onAddItem?: () => void;
  onAddFee?: () => void;
  onFocusSearch?: () => void;
  onTogglePreview?: () => void;
  onNextField?: () => void;
  onPrevField?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

const SHORTCUTS: Record<string, KeyboardAction> = {
  "Control+s": "save",
  "Control+Shift+S": "save",
  "Meta+s": "save",
  "Meta+Shift+S": "save",
  "Control+Enter": "finalize",
  "Meta+Enter": "finalize",
  "Control+Shift+Enter": "send",
  "Meta+Shift+Enter": "send",
  "Control+d": "duplicate",
  "Meta+d": "duplicate",
  "Control+n": "add-item",
  "Meta+n": "add-item",
  "Control+Shift+F": "add-fee",
  "Meta+Shift+F": "add-fee",
  "/": "focus-search",
  "Control+/": "focus-search",
  "Meta+/": "focus-search",
  "p": "toggle-preview",
  "Control+p": "toggle-preview",
  "Meta+p": "toggle-preview",
  Tab: "next-field",
  "Shift+Tab": "prev-field",
  Escape: "cancel",
  Delete: "delete",
  Backspace: "delete",
};

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    enabled = true,
    onSave,
    onFinalize,
    onSend,
    onDuplicate,
    onAddItem,
    onAddFee,
    onFocusSearch,
    onTogglePreview,
    onNextField,
    onPrevField,
    onCancel,
    onDelete,
  } = config;

  const handlers = useMemo<Record<KeyboardAction, (() => void) | undefined>>(
    () => ({
      save: onSave,
      finalize: onFinalize,
      send: onSend,
      duplicate: onDuplicate,
      "add-item": onAddItem,
      "add-fee": onAddFee,
      "focus-search": onFocusSearch,
      "toggle-preview": onTogglePreview,
      "next-field": onNextField,
      "prev-field": onPrevField,
      cancel: onCancel,
      delete: onDelete,
    }),
    [onSave, onFinalize, onSend, onDuplicate, onAddItem, onAddFee, onFocusSearch, onTogglePreview, onNextField, onPrevField, onCancel, onDelete],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      const isFormElement =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const keyCombo = buildKeyCombo(e);

      if (keyCombo === "/" && !isFormElement) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlers["focus-search"]?.();
        return;
      }

      const action = getAction(keyCombo);
      if (action && handlers[action]) {
        if (isFormElement && !["Tab", "Shift+Tab", "Escape", "Delete", "Backspace"].includes(keyCombo)) {
          if (keyCombo !== "/") {
            return;
          }
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        const handler = handlers[action];
        if (handler) {
          handler();
        }
      }
    },
    [enabled, handlers],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, handleKeyDown]);

  return { handlers, enabled };
}

export function buildKeyComboFn(e: KeyboardEvent): string {
  return buildKeyCombo(e);
}

export function getActionFn(keyCombo: string): KeyboardAction | undefined {
  return getAction(keyCombo);
}

function buildKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const key = e.key;
  if (/^[a-zA-Z0-9]$/.test(key) || key === "/" || key === "." || key === ",") {
    parts.push(key.toUpperCase());
  } else if (key === "Enter" || key === "Tab" || key === "Escape" || key === "Delete" || key === "Backspace") {
    parts.push(key);
  } else {
    parts.push(key);
  }

  return parts.join("+");
}

const SHORTCUT_ENTRIES = Object.entries(SHORTCUTS).map(([k, v]) => [
  k.toLowerCase(),
  k.toUpperCase(),
  k,
  v,
] as const);

function getAction(keyCombo: string): KeyboardAction | undefined {
  const key = keyCombo.toLowerCase();
  for (const [lower, upper, original, action] of SHORTCUT_ENTRIES) {
    if (lower === key || upper === keyCombo) {
      return action;
    }
  }
  return SHORTCUTS[keyCombo];
}

export function getShortcutsHelp(): Array<{ keys: string; action: KeyboardAction; description: string }> {
  return [
    { keys: "Ctrl+S", action: "save", description: "Save draft" },
    { keys: "Ctrl+Enter", action: "finalize", description: "Finalize invoice" },
    { keys: "Ctrl+Shift+Enter", action: "send", description: "Send invoice" },
    { keys: "Ctrl+D", action: "duplicate", description: "Duplicate" },
    { keys: "Ctrl+N", action: "add-item", description: "Add line item" },
    { keys: "Ctrl+Shift+F", action: "add-fee", description: "Add fee" },
    { keys: "/", action: "focus-search", description: "Search" },
    { keys: "P", action: "toggle-preview", description: "Toggle preview" },
    { keys: "Ctrl+P", action: "toggle-preview", description: "Toggle preview" },
    { keys: "Tab", action: "next-field", description: "Next field" },
    { keys: "Shift+Tab", action: "prev-field", description: "Previous field" },
    { keys: "Esc", action: "cancel", description: "Cancel" },
  ];
}
