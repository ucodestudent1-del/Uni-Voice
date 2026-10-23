import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronDown, Plus, Star, Layout as LayoutIcon } from "lucide-react";
import {
  getDocumentTemplates,
  createDocumentTemplate,
  deleteDocumentTemplate,
  setDefaultDocumentTemplate,
  getDocumentPresets,
  deleteDocumentPreset,
  setDefaultDocumentPreset,
  type ApiDocumentPreset,
} from "@/api/client";
import type { ApiTemplate } from "@/types/api";
import { useToast } from "@/components/ui";
import { Dialog } from "@/components/ui";
import type { DocumentType } from "./document-types";

export interface LayoutOption {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  source: "preset" | "template";
  data: Record<string, unknown>;
}

interface LayoutSelectorProps {
  docType: DocumentType;
  onApply: (data: Record<string, unknown>) => void;
  currentData: Record<string, unknown>;
  disabled?: boolean;
}

export function LayoutSelector({
  docType,
  onApply,
  currentData,
  disabled,
}: LayoutSelectorProps) {
  const { toast } = useToast();
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadLayouts = useCallback(async () => {
    setLoading(true);
    try {
      const [templateRes, presetRes] = await Promise.all([
        getDocumentTemplates({ limit: 50 }),
        getDocumentPresets({ documentType: docType, isActive: true }),
      ]);

      const allTemplates: ApiTemplate[] = templateRes.templates ?? [];
      const templates = allTemplates
        .filter(
          (t) =>
            (t.config?.documentType as string | undefined) === docType ||
            (t.config?.type as string | undefined) === "layout",
        )
        .map((t: ApiTemplate): LayoutOption => ({
          id: t.id,
          name: t.name,
          description: null,
          isDefault: t.is_default,
          source: "template",
          data: {
            config: t.config,
            ...(t.config?.data as Record<string, unknown> | undefined),
          },
        }));

      const presets = (presetRes.presets ?? []).map((p: ApiDocumentPreset): LayoutOption => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        isDefault: p.is_default,
        source: "preset",
        data: p.data,
      }));

      const allLayouts = [...presets, ...templates].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      setLayouts(allLayouts);
    } catch {
      setLayouts([]);
    } finally {
      setLoading(false);
    }
  }, [docType]);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = useCallback((layout: LayoutOption) => {
    onApply(layout.data);
    toast(`Applied layout: ${layout.name}`);
    setOpen(false);
  }, [onApply, toast]);

  const handleSaveAsLayout = useCallback(async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await createDocumentTemplate({
        name: saveName,
        description: saveDescription || undefined,
        document_type: docType,
        config: {
          type: "layout",
          data: currentData,
        },
      });
      toast(`Layout "${saveName}" saved`);
      setSaveDialogOpen(false);
      setSaveName("");
      setSaveDescription("");
      loadLayouts();
    } catch {
      toast("Failed to save layout", { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [docType, saveName, saveDescription, currentData, loadLayouts, toast]);

  const handleSetDefault = useCallback(async (layout: LayoutOption) => {
    try {
      if (layout.source === "preset") {
        await setDefaultDocumentPreset(layout.id, docType);
      } else {
        await setDefaultDocumentTemplate(layout.id);
      }
      toast(`${layout.name} set as default`);
      loadLayouts();
    } catch {
      toast("Failed to set default", { type: "error" });
    }
  }, [docType, loadLayouts, toast]);

  const handleDelete = useCallback(async (layout: LayoutOption) => {
    try {
      if (layout.source === "preset") {
        await deleteDocumentPreset(layout.id);
      } else {
        await deleteDocumentTemplate(layout.id);
      }
      toast(`Layout "${layout.name}" deleted`);
      loadLayouts();
    } catch {
      toast("Failed to delete layout", { type: "error" });
    }
  }, [loadLayouts, toast]);

  const handleSaveClick = useCallback(() => {
    setSaveName("");
    setSaveDescription("");
    setSaveDialogOpen(true);
  }, []);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary font-medium disabled:opacity-50"
        >
          <LayoutIcon className="h-4 w-4" />
          <span>Choose Layout</span>
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div className="dropdown-content max-h-80">
            {loading ? (
              <div className="p-3 text-sm text-tertiary">Loading layouts...</div>
            ) : layouts.length === 0 ? (
              <div className="p-3 text-sm text-tertiary text-center">
                No layouts saved yet. Save your current form as a layout to get started.
              </div>
            ) : (
              layouts.map((layout) => (
                <div
                  key={`${layout.source}-${layout.id}`}
                  className="p-3 border-b border-color-subtle last:border-b-0 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleApply(layout)}
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm text-primary">{layout.name}</p>
                        <span className="text-xs text-tertiary bg-tertiary-bg px-1.5 py-0.25 rounded">
                          {layout.source}
                        </span>
                      </div>
                      {layout.description && (
                        <p className="text-xs text-tertiary mt-0.5">{layout.description}</p>
                      )}
                      {layout.isDefault && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary-brand">
                          <Star className="h-3 w-3 fill-current" />
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!layout.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(layout)}
                          className="p-1 text-tertiary hover:text-primary rounded hover:bg-surface-alt"
                          title="Set as default"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(layout)}
                        className="p-1 text-tertiary hover:text-error rounded hover:bg-surface-alt"
                        title="Delete"
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 6h18M9 6V4a3 3 0 0 1 6 0v2M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {layouts.length > 0 && (
              <div
                className="p-3 text-sm text-primary-brand cursor-pointer hover:bg-primary-bg text-center border-t border-color-subtle flex items-center justify-center gap-1"
                onClick={handleSaveClick}
              >
                <Plus className="h-4 w-4" />
                Save current as layout
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        title="Save as Layout"
        description="Save your current form as a layout for future documents."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g., Standard Web Design Invoice"
              className="w-full px-3 py-2 border border-color rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Briefly describe when to use this layout"
              className="w-full px-3 py-2 border border-color rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSaveDialogOpen(false)}
              className="px-4 py-2 text-sm border border-color rounded-md hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAsLayout}
              disabled={saving || !saveName.trim()}
              className="px-4 py-2 text-sm bg-primary text-on-primary rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1"
            >
              {saving && (
                <div className="animate-spin rounded-full border-2 border-t-transparent border-current h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
