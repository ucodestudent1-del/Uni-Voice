import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Edit, Trash2, Save, ArrowLeft, Copy, Plus } from "lucide-react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getProprietaryEmailTemplates,
  getProprietaryEmailTemplateDefaults,
  getProprietaryEmailTemplate,
  createProprietaryEmailTemplate,
  updateProprietaryEmailTemplate,
  deleteProprietaryEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
} from "@/api/client";
import { useToast, Skeleton, Button, DataTable } from "@/components/ui";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ColumnDef } from "@/types/components";

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  quote: "Quote",
  reminder: "Payment Reminder",
  payment_receipt: "Payment Receipt",
  custom: "Custom",
};

const TEMPLATE_TYPE_OPTIONS = [
  "invoice",
  "quote",
  "reminder",
  "payment_receipt",
  "custom",
];

interface EditTemplateModalProps {
  open: boolean;
  templateId?: string;
  defaults: Record<string, { subject: string; body: string; name: string }>;
  onClose: () => void;
}

function EditTemplateModal({ open, templateId, defaults, onClose }: EditTemplateModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isNew = !templateId;

  const {
    data: existingData,
    isLoading: loading,
  } = useQuery({
    queryKey: ["proprietary-email-template", templateId],
    queryFn: () => getProprietaryEmailTemplate(templateId!),
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });

  const [formData, setFormData] = useState<EmailTemplateInput | null>(null);

  if (existingData?.template && !formData) {
    const t = existingData.template;
    setFormData({
      name: t.name,
      templateType: (t.template_type as EmailTemplateInput["templateType"]) ?? "custom",
      locale: t.locale,
      subjectTemplate: t.subject_template,
      bodyTemplate: t.body_template,
      isDefault: t.is_default,
      isActive: t.is_active,
    });
  }

  const saveMutation = useMutation({
    mutationFn: (data: EmailTemplateInput) =>
      isNew ? createProprietaryEmailTemplate(data) : updateProprietaryEmailTemplate(templateId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-email-templates"] });
      toast(isNew ? "Template created." : "Template updated.", {
        title: "Saved",
        type: "success",
      });
      onClose();
    },
    onError: () => {
      toast("Failed to save template.", { title: "Error", type: "error" });
    },
  });

  const handleReset = () => {
    const defaultKey = formData?.templateType ?? "custom";
    const def = defaults[defaultKey];
    if (def) {
      setFormData({
        name: def.name,
        templateType: formData?.templateType ?? "custom",
        locale: "en-US",
        subjectTemplate: def.subject,
        bodyTemplate: def.body,
        isDefault: false,
        isActive: true,
      });
    }
  };

  if (!open) return null;
  if (loading && !formData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Skeleton className="h-96 w-full max-w-3xl mx-4" />
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {isNew ? "New Email Template" : "Edit Email Template"}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Invoice"
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Template Type</label>
              <select
                value={formData.templateType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    templateType: e.target.value as EmailTemplateInput["templateType"],
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                {TEMPLATE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Locale</label>
              <input
                type="text"
                value={formData.locale}
                onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-secondary">Subject</label>
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={!defaults[formData.templateType]}>
                <Copy className="h-4 w-4 mr-1" />
                Use Default
              </Button>
            </div>
            <input
              type="text"
              value={formData.subjectTemplate}
              onChange={(e) => setFormData({ ...formData, subjectTemplate: e.target.value })}
              placeholder="Email subject with {{variables}}"
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Body (HTML supported)</label>
            <textarea
              value={formData.bodyTemplate}
              onChange={(e) => setFormData({ ...formData, bodyTemplate: e.target.value })}
              placeholder="Email body template with {{variables}}..."
              className="w-full px-3 py-2 border rounded-lg h-48 resize-none font-mono text-sm"
              required
            />
          </div>
          <p className="text-xs text-tertiary">
            Available variables: &#123;&#123;customer_name&#125;&#125;, &#123;&#123;invoice_number&#125;&#125;,
            &#123;&#123;quote_number&#125;&#125;, &#123;&#123;total_amount&#125;&#125;, &#123;&#123;currency&#125;&#125;,
            &#123;&#123;due_date&#125;&#125;, &#123;&#123;invoice_url&#125;&#125;, &#123;&#123;quote_url&#125;&#125;,
            &#123;&#123;payment_amount&#125;&#125;, &#123;&#123;payment_reference&#125;&#125;
          </p>
          <div className="flex items-center gap-2 pt-2 border-t">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive ?? true}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-input-border"
              />
              <span className="text-sm text-secondary">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isDefault ?? false}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded border-input-border"
              />
              <span className="text-sm text-secondary">Default for this type</span>
            </label>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => saveMutation.mutate(formData)}
            loading={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProprietaryEmailTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const {
    data: templatesData,
    isLoading,
  } = useQuery({
    queryKey: ["proprietary-email-templates", { type: typeFilter }],
    queryFn: () => getProprietaryEmailTemplates(typeFilter ? { type: typeFilter } : undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: defaultsData } = useQuery({
    queryKey: ["proprietary-email-template-defaults"],
    queryFn: () => getProprietaryEmailTemplateDefaults(),
    staleTime: 300_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProprietaryEmailTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-email-templates"] });
      toast("Template deleted.", { title: "Deleted", type: "success" });
    },
    onError: () => {
      toast("Failed to delete template.", { title: "Error", type: "error" });
    },
  });

  useMetaTags({
    title: "Email Templates — DocForge",
    description: "Configure email templates for invoices, quotes, and payment reminders.",
    noIndex: true,
  });

  const templates: EmailTemplate[] = templatesData?.templates ?? [];

  const columns: ColumnDef<EmailTemplate>[] = [
    {
      header: "Type",
      accessor: (row) => TEMPLATE_TYPE_LABELS[row.template_type] ?? row.template_type,
    },
    {
      header: "Name",
      accessor: (row) => (
        <Link
          to="#"
          onClick={() => setEditingTemplateId(row.id)}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Status",
      accessor: (row) => (row.is_active ? "Active" : "Inactive"),
    },
    {
      header: "Default",
      accessor: (row) => (row.is_default ? "Yes" : "—"),
    },
    {
      header: "",
      accessor: (row) => (
        <div className="flex gap-2 justify-end">
          {row.template_type !== "custom" && !row.is_default && (
            <button
              onClick={() => setEditingTemplateId(row.id)}
              className="text-secondary hover:text-primary p-1"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => deleteMutation.mutate(row.id)}
            className="text-red-600 hover:bg-red-50 rounded p-1"
            title="Delete"
            disabled={row.is_default}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-primary">Email Templates</h1>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-secondary">
          Configure the emails sent to customers for invoices, quotes, and payment events.
        </p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setEditingTemplateId("__new__")}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-secondary">Filter by type</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter("")}
            className={`px-3 py-1.5 text-sm rounded transition-all ${
              !typeFilter
                ? "bg-primary text-primary-foreground"
                : "text-secondary hover:text-primary border"
            }`}
          >
            All
          </button>
          {TEMPLATE_TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-sm rounded transition-all ${
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "text-secondary hover:text-primary border"
              }`}
            >
              {TEMPLATE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : templates.length === 0 ? (
        <p className="text-secondary text-sm">No templates found. Create one to get started.</p>
      ) : (
        <DataTable columns={columns} data={templates} rowKey="id" />
      )}

      {editingTemplateId && (
        <EditTemplateModal
          open={true}
          templateId={editingTemplateId === "__new__" ? undefined : editingTemplateId}
          defaults={defaultsData?.defaults ?? {}}
          onClose={() => {
            setEditingTemplateId(null);
            queryClient.invalidateQueries({ queryKey: ["proprietary-email-templates"] });
          }}
        />
      )}
    </div>
  );
}
