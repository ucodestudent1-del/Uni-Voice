import { query } from "../db/pool.js";

export type DocumentTypeForRelation = "invoice" | "quote" | "credit-note" | "debit-note" | "payment-voucher" | "receipt" | "purchase-order" | "recurring-invoice" | "delivery-note" | "packing-slip" | "pro-forma-invoice" | "estimate";

export interface RelatedDocument {
  id: string;
  docType: DocumentTypeForRelation;
  docNumber: string | null;
  status: string;
  total: string;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  isFinalized: boolean;
  relationType: string;
  relationDirection: "source" | "target";
  createdAt: string;
}

export interface DocumentRelation {
  id: string;
  businessId: string;
  sourceDocType: string;
  sourceDocId: string;
  targetDocType: string;
  targetDocId: string;
  relationType: string;
  createdAt: Date;
  createdBy: string | null;
}

export class DocumentRelationRepository {
  async createRelation(
    businessId: string,
    sourceDocType: string,
    sourceDocId: string,
    targetDocType: string,
    targetDocId: string,
    relationType: string,
    createdBy?: string
  ): Promise<DocumentRelation> {
    const res = await query(
      `INSERT INTO document_relations
         (business_id, source_doc_type, source_doc_id, target_doc_type, target_doc_id, relation_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (business_id, source_doc_type, source_doc_id, target_doc_type, target_doc_id, relation_type)
       DO NOTHING
       RETURNING id, business_id, source_doc_type, source_doc_id, target_doc_type, target_doc_id, relation_type, created_at, created_by`,
      [businessId, sourceDocType, sourceDocId, targetDocType, targetDocId, relationType, createdBy ?? null]
    );
    if (!res.rows.length) {
      return {
        id: "",
        businessId,
        sourceDocType,
        sourceDocId,
        targetDocType,
        targetDocId,
        relationType,
        createdAt: new Date(),
        createdBy: createdBy ?? null,
      };
    }
    return this.rowToModel(res.rows[0]);
  }

  async deleteRelation(
    businessId: string,
    sourceDocType: string,
    sourceDocId: string,
    targetDocType: string,
    targetDocId: string,
    relationType: string
  ): Promise<void> {
    await query(
      `DELETE FROM document_relations
       WHERE business_id = $1 AND source_doc_type = $2 AND source_doc_id = $3
         AND target_doc_type = $4 AND target_doc_id = $5 AND relation_type = $6`,
      [businessId, sourceDocType, sourceDocId, targetDocType, targetDocId, relationType]
    );
  }

  async findRelatedDocuments(
    businessId: string,
    docType: string,
    docId: string
  ): Promise<RelatedDocument[]> {
    const results: RelatedDocument[] = [];

    const sourceRelations = await query(
      `SELECT * FROM document_relations
       WHERE business_id = $1 AND source_doc_type = $2 AND source_doc_id = $3`,
      [businessId, docType, docId]
    );

    for (const rel of sourceRelations.rows) {
      const doc = await this.fetchDocumentInfo(businessId, rel.target_doc_type, rel.target_doc_id);
      if (doc) {
        results.push({
          ...doc,
          relationType: rel.relation_type,
          relationDirection: "source",
          createdAt: rel.created_at,
        });
      }
    }

    const targetRelations = await query(
      `SELECT * FROM document_relations
       WHERE business_id = $1 AND target_doc_type = $2 AND target_doc_id = $3`,
      [businessId, docType, docId]
    );

    for (const rel of targetRelations.rows) {
      const doc = await this.fetchDocumentInfo(businessId, rel.source_doc_type, rel.source_doc_id);
      if (doc) {
        results.push({
          ...doc,
          relationType: rel.relation_type,
          relationDirection: "target",
          createdAt: rel.created_at,
        });
      }
    }

    return results.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }

  async findRelatedByInvoice(
    businessId: string,
    invoiceId: string
  ): Promise<RelatedDocument[]> {
    const results: RelatedDocument[] = [];

    const creditNotes = await query(
      `SELECT id, credit_note_number as doc_number, status, total, currency, issue_date, due_date, is_finalized, finalized_at
       FROM credit_notes
       WHERE business_id = $1 AND reference_invoice_id = $2`,
      [businessId, invoiceId]
    );
    for (const cn of creditNotes.rows) {
      const doc = await this.fetchDocumentInfo(businessId, "invoice", invoiceId);
      if (doc) {
        results.push({
          id: cn.id as string,
          docType: "credit-note",
          docNumber: cn.doc_number as string | null,
          status: cn.status as string,
          total: (cn.total as number).toFixed(2),
          currency: cn.currency as string,
          issueDate: cn.issue_date as string | null,
          dueDate: cn.due_date as string | null,
          isFinalized: Boolean(cn.is_finalized),
          relationType: "credit_note",
          relationDirection: "target",
          createdAt: (cn.finalized_at || cn.created_at) as string,
        });
      }
    }

    const debitNotes = await query(
      `SELECT id, debit_note_number as doc_number, status, total, currency, issue_date, due_date, is_finalized, finalized_at, reference_invoice_id
       FROM debit_notes
       WHERE business_id = $1 AND reference_invoice_id = $2`,
      [businessId, invoiceId]
    );
    for (const dn of debitNotes.rows) {
      results.push({
        id: dn.id as string,
        docType: "debit-note",
        docNumber: dn.doc_number as string | null,
        status: dn.status as string,
        total: (dn.total as number).toFixed(2),
        currency: dn.currency as string,
        issueDate: dn.issue_date as string | null,
        dueDate: dn.due_date as string | null,
        isFinalized: Boolean(dn.is_finalized),
        relationType: "debit_note",
        relationDirection: "target",
        createdAt: (dn.finalized_at || dn.created_at) as string,
      });
    }

    const receipts = await query(
      `SELECT id, receipt_number as doc_number, status, amount as total, currency, issued_at as issue_date, NULL as due_date, TRUE as is_finalized, issued_at as finalized_at
       FROM receipts
       WHERE business_id = $1 AND invoice_id = $2`,
      [businessId, invoiceId]
    );
    for (const r of receipts.rows) {
      results.push({
        id: r.id as string,
        docType: "receipt",
        docNumber: r.doc_number as string | null,
        status: r.status as string,
        total: (r.total as number).toFixed(2),
        currency: r.currency as string,
        issueDate: r.issue_date as string | null,
        dueDate: r.due_date as string | null,
        isFinalized: Boolean(r.is_finalized),
        relationType: "receipt",
        relationDirection: "target",
        createdAt: r.finalized_at as string,
      });
    }

    const relations = await this.findRelatedDocuments(businessId, "invoice", invoiceId);
    results.push(...relations);

    return results.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }

  private async fetchDocumentInfo(
    businessId: string,
    docType: string,
    docId: string
  ): Promise<Omit<RelatedDocument, "relationType" | "relationDirection" | "createdAt"> | null> {
    const tableMap: Record<string, string> = {
      "invoice": "invoices",
      "quote": "quotes",
      "credit-note": "credit_notes",
      "debit-note": "debit_notes",
      "payment-voucher": "payment_vouchers",
      "receipt": "receipts",
      "purchase-order": "purchase_orders",
      "recurring-invoice": "recurring_invoices",
      "delivery-note": "delivery_notes",
      "packing-slip": "packing_slips",
      "pro-forma-invoice": "pro_forma_invoices",
      "estimate": "estimates",
    };

    const table = tableMap[docType];
    if (!table) return null;

    let numberField = "id";
    let statusField = "status";
    let totalField = "total";
    let finalizedField = "is_finalized";
    let createdAtField = "created_at";
    let issueDateField = "issue_date";
    let dueDateField = "due_date";

    if (docType === "receipt") {
      numberField = "receipt_number";
      totalField = "amount";
      issueDateField = "issued_at";
    }
    if (docType === "credit-note" || docType === "debit-note") {
      numberField = docType === "credit-note" ? "credit_note_number" : "debit_note_number";
    }
    if (docType === "quote") {
      numberField = "quote_number";
    }
    if (docType === "payment-voucher") {
      numberField = "payment_voucher_number";
    }
    if (docType === "purchase-order") {
      numberField = "purchase_order_number";
    }

    const safeTable = table;
    const safeNumberField = numberField;
    const safeStatusField = statusField;
    const safeTotalField = totalField;
    const safeFinalizedField = finalizedField;
    const safeCreatedAtField = createdAtField;
    const safeIssueDateField = issueDateField;
    const safeDueDateField = dueDateField;

    try {
      const res = await query(
        `SELECT id, ${safeNumberField} as doc_number, ${safeStatusField} as status,
                ${safeTotalField} as total, currency, ${safeIssueDateField} as issue_date,
                ${safeDueDateField} as due_date, ${safeFinalizedField} as is_finalized,
                ${safeCreatedAtField} as created_at
         FROM ${safeTable}
         WHERE id = $1 AND business_id = $2`,
        [docId, businessId]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0];
      return {
        id: row.id as string,
        docType: docType as DocumentTypeForRelation,
        docNumber: row.doc_number as string | null,
        status: row.status as string,
        total: typeof row.total === "string" ? row.total : (row.total as number).toFixed(2),
        currency: row.currency as string,
        issueDate: row.issue_date as string | null,
        dueDate: row.due_date as string | null,
        isFinalized: Boolean(row.is_finalized),
      };
    } catch {
      return null;
    }
  }

  private rowToModel(r: Record<string, unknown>): DocumentRelation {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      sourceDocType: r.source_doc_type as string,
      sourceDocId: r.source_doc_id as string,
      targetDocType: r.target_doc_type as string,
      targetDocId: r.target_doc_id as string,
      relationType: r.relation_type as string,
      createdAt: new Date(r.created_at as string),
      createdBy: r.created_by as string | null,
    };
  }
}

export const documentRelationRepository = new DocumentRelationRepository();
