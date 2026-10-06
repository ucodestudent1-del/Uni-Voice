import { getClient, query } from "../db/pool.js";

export type AttachmentCategory = "attachment" | "before" | "after";

export interface InvoiceAttachment {
  id: string;
  businessId: string;
  invoiceId: string;
  category: AttachmentCategory;
  name: string;
  size: number;
  mimeType: string | null;
  dataUrl: string | null;
  createdAt: string;
}

export interface AttachmentInput {
  name: string;
  size: number;
  type?: string | null;
  category: AttachmentCategory;
  dataUrl?: string | null;
}

interface AttachmentRow {
  id: string;
  business_id: string;
  invoice_id: string;
  category: string;
  name: string;
  size: string | number;
  mime_type: string | null;
  data_url: string | null;
  created_at: string;
}

function rowToAttachment(r: AttachmentRow): InvoiceAttachment {
  return {
    id: r.id,
    businessId: r.business_id,
    invoiceId: r.invoice_id,
    category: r.category as AttachmentCategory,
    name: r.name,
    size: Number(r.size),
    mimeType: r.mime_type,
    dataUrl: r.data_url,
    createdAt: r.created_at,
  };
}

const LIST_SQL = `SELECT id, business_id, invoice_id, category, name, size, mime_type, data_url, created_at
  FROM invoice_attachments
  WHERE business_id = $1 AND invoice_id = $2
  ORDER BY created_at ASC, id ASC`;

export const invoiceAttachmentRepository = {
  async listByInvoice(businessId: string, invoiceId: string): Promise<InvoiceAttachment[]> {
    const res = await query(LIST_SQL, [businessId, invoiceId]);
    return res.rows.map(rowToAttachment);
  },

  async replaceAll(
    businessId: string,
    invoiceId: string,
    attachments: AttachmentInput[],
    client?: any
  ): Promise<void> {
    const ownsClient = !client;
    const c = client ?? (await getClient());
    try {
      if (ownsClient) await c.query("BEGIN");
      await c.query("DELETE FROM invoice_attachments WHERE business_id = $1 AND invoice_id = $2", [
        businessId,
        invoiceId,
      ]);
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        await c.query(
          `INSERT INTO invoice_attachments (id, business_id, invoice_id, category, name, size, mime_type, data_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crypto.randomUUID(),
            businessId,
            invoiceId,
            a.category,
            a.name,
            a.size,
            a.type ?? null,
            a.dataUrl ?? null,
            new Date().toISOString(),
          ]
        );
      }
      if (ownsClient) await c.query("COMMIT");
    } catch (e) {
      if (ownsClient) await c.query("ROLLBACK");
      throw e;
    } finally {
      if (ownsClient) c.release();
    }
  },

  async deleteByInvoice(invoiceId: string, client?: any): Promise<void> {
    const ownsClient = !client;
    const c = client ?? (await getClient());
    try {
      if (ownsClient) await c.query("BEGIN");
      await c.query("DELETE FROM invoice_attachments WHERE invoice_id = $1", [invoiceId]);
      if (ownsClient) await c.query("COMMIT");
    } catch (e) {
      if (ownsClient) await c.query("ROLLBACK");
      throw e;
    } finally {
      if (ownsClient) c.release();
    }
  },
};
