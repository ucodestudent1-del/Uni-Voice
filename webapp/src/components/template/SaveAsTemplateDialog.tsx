import { useState } from "react";
import { Button, FormField } from "@/components/ui";
import { Dialog } from "@/components/ui";
import { createDocumentTemplate, getDocumentTemplates } from "@/api/client";
import type { DocumentState, DocumentType } from "@/components/document/document-types";
import { TemplateConfigBuilder, defaultTemplateConfig, type TemplateLayoutConfig } from "./TemplateConfigBuilder";
import { useToast } from "@/components/ui";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  docType: DocumentType;
  currentState: DocumentState;
}

export function SaveAsTemplateDialog({
  open,
  onClose,
  docType,
  currentState,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<TemplateLayoutConfig>(defaultTemplateConfig());
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Template name is required", { type: "error" });
      return;
    }

    setIsSaving(true);
    try {
      await createDocumentTemplate({
        name: name.trim(),
        description: description || undefined,
        document_type: mapDocTypeForBackend(docType),
        document: {},
        config: {
          layout: config,
          lineItems: config.lineItems,
          style: config.style,
          sections: config.sections,
        },
        is_default: false,
        is_active: true,
      });

      toast(`Template "${name}" saved successfully`, { type: "success" });
      setName("");
      setDescription("");
      onClose();
    } catch {
      toast("Failed to save template", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save as Custom Template"
      description="Save current document layout and settings as a reusable template."
      size="lg"
    >
      <div className="space-y-4">
        <FormField
          label="Template Name"
          placeholder="e.g. Client Invoice - Professional"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormField
          label="Description"
          placeholder="Optional description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <TemplateConfigBuilder config={config} onChange={setConfig} />
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-color">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
          Save Template
        </Button>
      </div>
    </Dialog>
  );
}

function mapDocTypeForBackend(docType: DocumentType): string {
  const map: Record<DocumentType, string> = {
    "invoice": "invoice",
    "quote": "quote",
    "credit-note": "credit_note",
    "debit-note": "debit_note",
    "payment-voucher": "payment_voucher",
    "receipt": "receipt",
    "purchase-order": "purchase_order",
  };
  return map[docType] ?? docType;
}
