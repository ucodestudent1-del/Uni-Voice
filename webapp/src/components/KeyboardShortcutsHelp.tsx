import { useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { getShortcutsHelp, type KeyboardAction } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  save: "Saving",
  finalize: "Document Actions",
  send: "Document Actions",
  duplicate: "Document Actions",
  "add-item": "Editing",
  "add-fee": "Editing",
  "focus-search": "Navigation",
  "toggle-preview": "Navigation",
  "next-field": "Navigation",
  "prev-field": "Navigation",
  cancel: "Navigation",
  delete: "Editing",
};

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  if (!open) return null;

  const shortcuts = getShortcutsHelp();

  const sections: Record<string, { keys: string; action: KeyboardAction; description: string }[]> = {};
  shortcuts.forEach((s) => {
    const section = SECTION_LABELS[s.action] ?? "General";
    if (!sections[section]) sections[section] = [];
    sections[section].push(s);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full rounded-xl border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close shortcuts help"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(sections).map(([sectionName, items]) => (
            <div key={sectionName}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-2">
                {sectionName}
              </h3>
              <table className="w-full">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.action}>
                      <td className="py-1.5 text-sm">
                        <kbd className="inline-flex items-center rounded-md bg-surface-alt px-2 py-1 text-xs font-medium text-tertiary">
                          {item.keys}
                        </kbd>
                      </td>
                      <td className="py-1.5 pl-4 text-sm text-secondary">
                        {item.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-color-subtle pt-3">
          <p className="text-xs text-tertiary">
            Press <kbd className="bg-surface-alt px-1.5 py-0.5 rounded text-xs">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;
