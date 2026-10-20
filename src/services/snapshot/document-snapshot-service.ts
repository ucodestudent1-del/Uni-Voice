import crypto from "node:crypto";
import { query } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";
import { NotFoundError } from "../../domain/errors.js";
import type { DocumentTypeKey } from "../numbering/document-numbering-service.js";

export interface SnapshotData {
  documentId: string;
  businessId: string;
  documentType: DocumentTypeKey;
  snapshot: Record<string, unknown>;
  templateId?: string | null;
  templateSchemaVersion?: string | null;
  templateRevision?: number | null;
  renderedHtml?: string | null;
  pdfHash?: string | null;
  createdBy?: string | null;
}

export interface DocumentSnapshot {
  id: string;
  documentType: string;
  documentId: string;
  businessId: string;
  snapshot: Record<string, unknown>;
  snapshotHash: string;
  revision: number;
  templateId: string | null;
  templateSchemaVersion: string | null;
  templateRevision: number | null;
  renderedHtml: string | null;
  pdfStored: boolean;
  pdfHash: string | null;
  createdAt: Date;
  createdBy: string | null;
}

export class DocumentSnapshotService {
  /**
   * Builds and stores an immutable snapshot of a finalized document.
   * The snapshot captures the full state (business, customer, items, totals, etc.)
   * so that future renders (PDF, email) always reproduce the document as it was at finalization.
   */
  async createSnapshot(data: SnapshotData): Promise<DocumentSnapshot> {
    const snapshotJson = JSON.stringify(data.snapshot);
    const snapshotHash = crypto.createHash("sha256").update(snapshotJson).digest("hex");

    const result = await query(
      `INSERT INTO document_snapshots
         (document_type, document_id, business_id, snapshot, snapshot_hash,
          template_id, template_schema_version, template_revision,
          rendered_html, pdf_stored, pdf_hash, created_by, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, FALSE, $10, $11, NOW())
       ON CONFLICT (document_type, document_id) DO UPDATE SET
         snapshot = EXCLUDED.snapshot,
         snapshot_hash = EXCLUDED.snapshot_hash,
         template_id = EXCLUDED.template_id,
         template_schema_version = EXCLUDED.template_schema_version,
         template_revision = EXCLUDED.template_revision,
         rendered_html = EXCLUDED.rendered_html,
         pdf_hash = EXCLUDED.pdf_hash,
         created_by = EXCLUDED.created_by,
         created_at = NOW()
       RETURNING *`,
      [
        data.documentType,
        data.documentId,
        data.businessId,
        data.snapshot,
        snapshotHash,
        data.templateId ?? null,
        data.templateSchemaVersion ?? null,
        data.templateRevision ?? null,
        data.renderedHtml ?? null,
        data.pdfHash ?? null,
        data.createdBy ?? null,
      ]
    );

    logger.info(
      `Created snapshot for ${data.documentType} ${data.documentId} (hash: ${snapshotHash.slice(0, 16)}...)`
    );

    return this.rowToModel(result.rows[0]);
  }

  /**
   * Retrieves a snapshot by document type and ID.
   */
  async findByDocument(
    businessId: string,
    documentType: DocumentTypeKey,
    documentId: string
  ): Promise<DocumentSnapshot | null> {
    const result = await query(
      `SELECT * FROM document_snapshots
       WHERE document_type = $1 AND document_id = $2 AND business_id = $3`,
      [documentType, documentId, businessId]
    );

    if (!result.rows.length) return null;
    return this.rowToModel(result.rows[0]);
  }

  /**
   * Verifies a snapshot's integrity by recomputing the hash.
   * Returns true if the snapshot matches (is immutable and untampered).
   */
  async verify(documentType: DocumentTypeKey, documentId: string): Promise<boolean> {
    const result = await query(
      `SELECT snapshot, snapshot_hash
       FROM document_snapshots
       WHERE document_type = $1 AND document_id = $2`,
      [documentType, documentId]
    );

    if (!result.rows.length) {
      throw new NotFoundError(
        `Snapshot not found for ${documentType} ${documentId}`
      );
    }

    const { snapshot, snapshot_hash } = result.rows[0];
    const computedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");

    return computedHash === snapshot_hash;
  }

  /**
   * Updates the PDF hash on a snapshot after PDF generation.
   */
  async updatePdfHash(
    businessId: string,
    documentType: DocumentTypeKey,
    documentId: string,
    pdfHash: string
  ): Promise<void> {
    await query(
      `UPDATE document_snapshots
       SET pdf_stored = TRUE, pdf_hash = $4
       WHERE document_type = $1 AND document_id = $2 AND business_id = $3`,
      [documentType, documentId, businessId, pdfHash]
    );
  }

  private rowToModel(row: Record<string, unknown>): DocumentSnapshot {
    return {
      id: row.id as string,
      documentType: row.document_type as string,
      documentId: row.document_id as string,
      businessId: row.business_id as string,
      snapshot: row.snapshot as Record<string, unknown>,
      snapshotHash: row.snapshot_hash as string,
      revision: Number(row.revision ?? 1),
      templateId: (row.template_id as string) ?? null,
      templateSchemaVersion: (row.template_schema_version as string) ?? null,
      templateRevision: row.template_revision ? Number(row.template_revision) : null,
      renderedHtml: (row.rendered_html as string) ?? null,
      pdfStored: Boolean(row.pdf_stored),
      pdfHash: (row.pdf_hash as string) ?? null,
      createdAt: new Date(row.created_at as string),
      createdBy: (row.created_by as string) ?? null,
    };
  }
}

export const documentSnapshotService = new DocumentSnapshotService();

/**
 * Helper: compute SHA-256 hash of a JSON object (for client-side verification).
 */
export function computeSnapshotHash(data: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * Helper: verify a snapshot against its hash.
 */
export function verifySnapshot(snapshot: Record<string, unknown>, expectedHash: string): boolean {
  const computedHash = computeSnapshotHash(snapshot);
  return computedHash === expectedHash;
}
