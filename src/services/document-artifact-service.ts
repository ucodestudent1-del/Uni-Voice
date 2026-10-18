import crypto from "node:crypto";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/index.js";

export interface ArtifactInput {
  businessId: string;
  documentId: string;
  documentType: string;
  outputFormat: string;
  data: string | Buffer;
  metadata?: Record<string, unknown>;
  generatedBy?: string;
  expiresAt?: Date | null;
}

export interface DocumentArtifact {
  id: string;
  businessId: string;
  documentId: string;
  documentType: string;
  outputFormat: string;
  filePath: string;
  fileUrl: string | null;
  sha256: string;
  fileSizeBytes: number;
  generatedBy: string | null;
  generatedAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

export class DocumentArtifactService {
  async store(input: ArtifactInput): Promise<DocumentArtifact> {
    const dataBuffer = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data);
    const sha256 = crypto.createHash("sha256").update(dataBuffer).digest("hex");
    const fileSizeBytes = dataBuffer.length;

    const filePath = `artifacts/${input.documentType}/${input.documentId}/${input.outputFormat}.bin`;
    const fileUrl = `${env.APP_PUBLIC_BASE_URL}/api/documents/${input.documentId}/artifacts/${sha256}`;

    const metadata = input.metadata ?? {};
    metadata.sha256 = sha256;
    metadata.fileSizeBytes = fileSizeBytes;

    const res = await query(
      `INSERT INTO document_artifacts
        (business_id, document_id, document_type, output_format, file_path, file_url, sha256, file_size_bytes, generated_by, generated_at, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)
       ON CONFLICT (business_id, document_id, document_type, output_format)
       DO UPDATE SET
         file_path = EXCLUDED.file_path,
         file_url = EXCLUDED.file_url,
         sha256 = EXCLUDED.sha256,
         file_size_bytes = EXCLUDED.file_size_bytes,
         generated_by = EXCLUDED.generated_by,
         generated_at = NOW(),
         expires_at = EXCLUDED.expires_at,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        input.businessId,
        input.documentId,
        input.documentType,
        input.outputFormat,
        filePath,
        fileUrl,
        sha256,
        fileSizeBytes,
        input.generatedBy ?? null,
        input.expiresAt ?? null,
        JSON.stringify(metadata),
      ]
    );

    const artifact = this.mapRow(res.rows[0]);
    logger.info(`Stored document artifact for ${input.documentType}:${input.documentId} (${input.outputFormat})`);
    return artifact;
  }

  async getByKey(
    businessId: string,
    documentId: string,
    documentType: string,
    outputFormat: string,
  ): Promise<DocumentArtifact | null> {
    const res = await query(
      `SELECT * FROM document_artifacts
       WHERE business_id = $1 AND document_id = $2 AND document_type = $3 AND output_format = $4`,
      [businessId, documentId, documentType, outputFormat]
    );
    if (!res.rows.length) return null;
    return this.mapRow(res.rows[0]);
  }

  async getByHash(businessId: string, sha256: string): Promise<DocumentArtifact | null> {
    const res = await query(
      `SELECT * FROM document_artifacts
       WHERE business_id = $1 AND sha256 = $2`,
      [businessId, sha256]
    );
    if (!res.rows.length) return null;
    return this.mapRow(res.rows[0]);
  }

  async list(businessId: string, documentId: string, documentType?: string): Promise<DocumentArtifact[]> {
    let res;
    if (documentType) {
      res = await query(
        `SELECT * FROM document_artifacts
         WHERE business_id = $1 AND document_id = $2 AND document_type = $3
         ORDER BY generated_at DESC`,
        [businessId, documentId, documentType]
      );
    } else {
      res = await query(
        `SELECT * FROM document_artifacts
         WHERE business_id = $1 AND document_id = $2
         ORDER BY generated_at DESC`,
        [businessId, documentId]
      );
    }
    return res.rows.map((row) => this.mapRow(row));
  }

  async cleanupExpired(): Promise<number> {
    const res = await query(
      `DELETE FROM document_artifacts
       WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );
    logger.info(`Cleaned up ${res.rowCount ?? 0} expired document artifacts`);
    return res.rowCount ?? 0;
  }

  async getWithData(
    businessId: string,
    documentId: string,
    documentType: string,
    outputFormat: string,
  ): Promise<{ artifact: DocumentArtifact; data: Buffer } | null> {
    const artifact = await this.getByKey(businessId, documentId, documentType, outputFormat);
    if (!artifact) return null;
    const dataBuffer = Buffer.isBuffer(artifact.filePath) ? artifact.filePath : null;
    return { artifact, data: dataBuffer ?? Buffer.alloc(0) };
  }

  private mapRow(row: Record<string, any>): DocumentArtifact {
    return {
      id: row.id,
      businessId: row.business_id,
      documentId: row.document_id,
      documentType: row.document_type,
      outputFormat: row.output_format,
      filePath: row.file_path,
      fileUrl: row.file_url,
      sha256: row.sha256,
      fileSizeBytes: Number(row.file_size_bytes),
      generatedBy: row.generated_by,
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    };
  }
}

export const documentArtifactService = new DocumentArtifactService();
