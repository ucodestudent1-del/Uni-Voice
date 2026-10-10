import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getCreditNote,
  getCreditNotePdf,
  finalizeCreditNote,
  cancelCreditNote,
  sendCreditNote,
  type CreditNoteSearchParams,
} from "../api/client";
import { getBusiness } from "../api/client";
import { formatCurrency } from "../utils/format";
import type { ApiCreditNote, ApiBusiness, ApiCustomer } from "../types/api";
import { Button } from "@/components/ui/Button";
import {
  Download,
  Send,
  Copy,
  AlertCircle,
  ArrowLeft,
  Clock,
} from "lucide-react";
import CreditNoteDisplay, { type CreditNoteDesign } from "@/components/CreditNoteDisplay";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PageHeader from "@/components/ui/PageHeader";

function businessAddressString(b: ApiBusiness | null): string | undefined {
  if (!b) return undefined;
  const parts = [
    b.addressLine1,
    b.addressLine2,
    b.city,
    b.stateOrRegion,
    [b.postalCode, b.countryCode].filter(Boolean).join(" "),
    b.taxId ? `Tax ID: ${b.taxId}` : undefined,
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function customerAddressString(c: ApiCustomer | null): string | undefined {
  if (!c?.address) return undefined;
  const a = c.address;
  const parts = [
    a.addressLine1,
    a.addressLine2,
    a.city,
    a.stateOrRegion,
    [a.postalCode, a.countryCode].filter(Boolean).join(" "),
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function buildCreditNoteDesign(
  cn: ApiCreditNote,
  business: ApiBusiness | null,
  customer: ApiCustomer | null
): CreditNoteDesign {
  return {
    businessName: business?.name || business?.legalName || "Untitled Business",
    businessLegalName: business?.legalName ?? null,
    businessEmail: business?.email ?? undefined,
    businessPhone: business?.phone ?? undefined,
    businessWebsite: business?.website ?? undefined,
    businessAddress: businessAddressString(business),
    businessLogo: business?.logoUrl ?? null,
    businessTaxId: business?.taxId ?? undefined,
    businessRegistrationNumber: business?.registrationNumber ?? null,

    creditNoteNumber: cn.credit_note_number ?? "",
    issueDate: cn.issue_date ?? undefined,
    currency: cn.currency,
    status: cn.status,

    customerName: cn.customer_name ?? customer?.name ?? undefined,
    customerCompanyName: customer?.companyName ?? undefined,
    customerEmail: cn.customer_email ?? customer?.email ?? undefined,
    customerAddress: customerAddressString(customer) ?? cn.customer_address ?? undefined,
    customerPhone: cn.customer_phone ?? customer?.phone ?? undefined,
    customerTaxId: cn.customer_tax_id ?? customer?.taxId ?? undefined,

    referenceInvoiceNumber: cn.reference_invoice_number ?? undefined,
    referenceInvoiceDate: cn.issue_date ?? undefined,

    reason: cn.reason,
    notes: cn.notes,
    terms: cn.terms,

    items: (cn.items ?? []).map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unit_price,
      discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
      discountType: it.discount_type,
      taxRate: it.tax_rate,
      tax_name: it.tax_name ?? null,
      isTaxInclusive: it.is_tax_inclusive ?? false,
    })),
    fees: (cn.fees ?? []).map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.tax_rate,
      tax_name: f.tax_name ?? null,
      tax_amount: f.tax_amount ?? null,
    })),
    subtotal: cn.subtotal,
    discountTotal: cn.discount_total,
    taxTotal: cn.tax_total,
    feeTotal: cn.fee_total,
    total: cn.total,
    appliedTotal: cn.applied_total,
    amountDue: cn.amount_due,
    applications: (cn.applications ?? []).map((app) => ({
      amount: app.amount,
      invoiceNumber: app.invoice_id ?? undefined,
      invoiceId: app.invoice_id,
      appliedAt: app.applied_at,
    })),

    isFinalized: cn.is_finalized,
    notesForCustomer: cn.notes ?? undefined,
  };
}

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadCreditNote();
  }, [id]);

  async function loadCreditNote() {
    if (!id) return;
    setLoading(true);
    try {
      const [cnRes, bizRes] = await Promise.allSettled([
        getCreditNote(id),
        getBusiness(),
      ]);
      if (cnRes.status === "fulfilled") setCreditNote(cnRes.value.creditNote);
      if (bizRes.status === "fulfilled")
        setBusiness(bizRes.value.business ?? null);
    } catch {
      // error handled below
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const design = useMemo(() => {
    if (!creditNote) return null;
    return buildCreditNoteDesign(creditNote, business, null);
  }, [creditNote, business]);

  async function handleDownloadPdf() {
  if (!id) return;
    try {
      const blob = await getCreditNotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-note-${creditNote?.credit_note_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to download PDF"
      );
    }
  }

  async function handleFinalize() {
  if (!id) return;
    try {
      await finalizeCreditNote(id);
      await loadCreditNote();
      setActionMessage("Credit note finalized successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to finalize credit note"
      );
    }
  }

  async function handleCancel() {
  if (!id) return;
    const reason = prompt("Enter a reason for cancellation:");
    if (!reason) return;
    try {
      await cancelCreditNote(id, reason);
      await loadCreditNote();
      setActionMessage("Credit note cancelled successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to cancel credit note"
      );
    }
  }

  async function handleSend() {
  if (!id) return;
    try {
      await sendCreditNote(id);
      await loadCreditNote();
      setActionMessage("Credit note sent successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to send credit note"
      );
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-secondary">
        Loading credit note…
      </div>
    );
  }

  if (!creditNote || !design) {
    return (
      <div className="text-center py-20 text-secondary">
        Credit note not found.
      </div>
    );
  }

  const canFinalize = creditNote.status === "draft";
  const canCancel = creditNote.status === "finalized";
  const canSend = creditNote.status === "finalized";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/app/credit-notes"
          className="text-sm text-secondary hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Credit Notes
        </Link>
      </div>

      {actionMessage && (
        <div className="p-3 status-info-bg border status-info-border rounded-lg">
          <p className="text-sm status-info-text">{actionMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <PageHeader
          title={creditNote.credit_note_number || "Credit Note"}
          breadcrumbs={[
            { label: "Home", to: "/app" },
            { label: "Credit Notes", to: "/app/credit-notes" },
            { label: creditNote.credit_note_number || "View" },
          ]}
          description={creditNote.reason ?? undefined}
        />

        <div className="flex gap-2 print:hidden">
          {canFinalize && (
            <Button variant="secondary" size="sm" onClick={handleFinalize}>
              Finalize
            </Button>
          )}
          {canSend && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Send className="w-4 h-4" />}
              onClick={handleSend}
            >
              Send
            </Button>
          )}
          {canCancel && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <CreditNoteDisplay
        design={design}
        showActions={false}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
}
