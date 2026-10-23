import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronDown, Plus, Star } from "lucide-react";
import {
  getDocumentPresets,
  getDefaultDocumentPreset,
  createDocumentPreset,
  updateDocumentPreset,
  deleteDocumentPreset,
  setDefaultDocumentPreset,
  type ApiDocumentPreset,
} from "@/api/client";
import { useToast } from "@/components/ui";
import { Dialog } from "@/components/ui";
import type { DocumentState } from "./document-types";

interface PresetSelectorProps {
  docType: string;
  onApply: (data: Record<string, unknown>) => void;
  currentData: DocumentState | Record<string, unknown>;
  disabled?: boolean;
}

export default function PresetSelector({
  docType,
  onApply,
  currentData,
  disabled,
}: PresetSelectorProps) {
  const { toast } = useToast();
  const [presets, setPresets] = useState<ApiDocumentPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const defaultPreset = await getDefaultDocumentPreset(docType);
      const data = await getDocumentPresets({ documentType: docType, isActive: true });
      const allPresets = defaultPreset.preset ? [defaultPreset.preset, ...data.presets.filter((p) => p.id !== defaultPreset.preset?.id)] : data.presets;
      setPresets(allPresets);
    } catch {
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, [docType]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = useCallback((preset: ApiDocumentPreset) => {
    onApply(preset.data);
      toast(`Applied preset: ${preset.name}`);
    setOpen(false);
  }, [onApply, toast]);

  const handleSaveAsPreset = useCallback(async () => {
    setSaving(true);
    try {
      const existing = await getDocumentPresets({ documentType: docType, isActive: true });
      const existingName = existing.presets.find((p) => p.name === saveName);
      const dataToSave = currentData as Record<string, unknown>;

      if (existingName) {
        await updateDocumentPreset(existingName.id, {
          description: saveDescription || undefined,
          data: dataToSave,
        });
      } else {
        await createDocumentPreset({
          name: saveName,
          description: saveDescription || undefined,
          documentType: docType,
          data: dataToSave,
        });
      }
      toast(`Preset "${saveName}" saved`);
      setSaveDialogOpen(false);
      setSaveName("");
      setSaveDescription("");
      loadPresets();
    } catch {
      toast(`Failed to save preset`, { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [docType, saveName, saveDescription, currentData, loadPresets, toast]);

  const handleSetDefault = useCallback((preset: ApiDocumentPreset) => {
    void (async () => {
      try {
        await setDefaultDocumentPreset(preset.id, docType);
        toast(`${preset.name} set as default`);
        loadPresets();
      } catch {
        toast(`Failed to set default preset`, { type: "error" });
      }
    })();
  }, [docType, loadPresets, toast]);

  const handleDelete = useCallback((preset: ApiDocumentPreset) => {
    void (async () => {
      try {
        await deleteDocumentPreset(preset.id);
        toast(`Preset "${preset.name}" deleted`);
        loadPresets();
      } catch {
        toast(`Failed to delete preset`, { type: "error" });
      }
    })();
  }, [loadPresets, toast]);

  const handleSaveClick = useCallback(() => {
    setSaveName("");
    setSaveDescription("");
    setSaveDialogOpen(true);
  }, []);

  return (
    <>
      <div ref={containerRef} className="relative">
        <div
          className="dropdown-toggle"
          onClick={() => !disabled && setOpen(!open)}
          style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        >
          <span>Choose template preset</span>
          <ChevronDown className="dropdown-chevron" />
        </div>

        {open && (
          <div className="dropdown-content max-h-80">
            {loading ? (
              <div className="p-3 text-sm text-tertiary">Loading presets...</div>
            ) : (
              <>
                {presets.length === 0 && (
                  <div className="p-3 text-sm text-tertiary text-center">
                    No presets saved yet. Save your current form as a preset to get started.
                  </div>
                )}

                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 border-b border-color-subtle last:border-b-0 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => handleApply(preset)}>
                        <p className="font-medium text-sm text-primary">{preset.name}</p>
                        {preset.description && (
                          <p className="text-xs text-tertiary mt-0.5">{preset.description}</p>
                        )}
                        {preset.is_default && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary-brand">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!preset.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(preset)}
                            className="p-1 text-tertiary hover:text-primary rounded hover:bg-surface-alt"
                            title="Set as default"
                          >
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(preset)}
                          className="p-1 text-tertiary hover:text-error rounded hover:bg-surface-alt"
                          title="Delete"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M9 6V4a3 3 0 0 1 6 0v2M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div
                  className="p-3 text-sm text-primary-brand cursor-pointer hover:bg-primary-bg text-center border-t border-color-subtle flex items-center justify-center gap-1"
                  onClick={handleSaveClick}
                >
                  <Plus className="h-4 w-4" />
                  Save current as preset
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        title="Save as Template Preset"
        description="Save your current form as a template for future documents."
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
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Briefly describe when to use this preset"
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
              onClick={handleSaveAsPreset}
              disabled={saving || !saveName.trim()}
              className="px-4 py-2 text-sm bg-primary text-on-primary rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1"
            >
              {saving && <div className="animate-spin rounded-full border-2 border-t-transparent border-current h-3 w-3" />}
              Save
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
