import nodemailer from "nodemailer";
import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { query } from "../../db/pool.js";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface InvoiceEmailData {
  invoiceId: string;
  businessId: string;
  recipient: EmailRecipient;
  subject: string;
  htmlBody: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  idempotencyKey?: string;
}

export type EmailStatus = "pending" | "sent" | "delivered" | "opened" | "failed";

export interface EmailProvider {
  readonly name: string;
  send(email: {
    to: EmailRecipient;
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<{ messageId: string; status: EmailStatus }>;
  verifyConnection?(): Promise<boolean>;
}

export class StubEmailProvider implements EmailProvider {
  readonly name = "stub";

  async send(email: { to: EmailRecipient; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<{ messageId: string; status: EmailStatus }> {
    const messageId = `stub-${Date.now()}@example.com`;
    logger.info(`[StubEmailProvider] (not sent) to=${email.to.email} subject="${email.subject}" msgId=${messageId}`);
    logger.debug(`[StubEmailProvider] html preview: ${(email.html || "").slice(0, 200)}...`);
    if (email.attachments?.length) {
      logger.debug(`[StubEmailProvider] ${email.attachments.length} attachment(s) (${email.attachments.map((a) => a.filename).join(", ")})`);
    }
    return { messageId, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  async send(email: { to: EmailRecipient; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<{ messageId: string; status: EmailStatus }> {
    const info = await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email.to.name ? `"${email.to.name}" <${email.to.email}>` : email.to.email,
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    });
    return { messageId: info.messageId ?? `msg-${Date.now()}@example.com`, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    return this.transporter.verify().then(() => true).catch(() => false);
  }
}

export class EmailService {
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? EmailService.createProvider(env.EMAIL_PROVIDER);
  }

  static createProvider(type: string): EmailProvider {
    if (type === "smtp") return new SmtpEmailProvider();
    return new StubEmailProvider();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async sendInvoiceEmail(data: InvoiceEmailData): Promise<{ messageId: string; status: EmailStatus }> {
    if (data.idempotencyKey) {
      const existing = await query(
        `SELECT message_id, status FROM email_log WHERE idempotency_key = $1 AND invoice_id = $2`,
        [data.idempotencyKey, data.invoiceId]
      );
      if (existing.rows.length) {
        logger.info(`Email already sent (idempotent), msgId=${existing.rows[0].message_id}`);
        return { messageId: existing.rows[0].message_id, status: existing.rows[0].status };
      }
    }

    const result = await this.provider.send({
      to: data.recipient,
      subject: data.subject,
      html: data.htmlBody,
      attachments: data.attachments,
    });

    await query(
      `INSERT INTO email_log (invoice_id, business_id, provider, status, recipient, subject, message_id, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
      [
        data.invoiceId, data.businessId, this.provider.name, result.status,
        data.recipient.email, data.subject, result.messageId, data.idempotencyKey ?? null,
      ]
    );

    logger.info(`Email sent: to=${data.recipient.email} invoice=${data.invoiceId} msgId=${result.messageId}`);
    return result;
  }

  async updateDeliveryState(messageId: string, status: EmailStatus, metadata: Record<string, unknown> = {}): Promise<void> {
    await query(
      `UPDATE email_log SET status = $2, metadata = metadata || $3::jsonb, updated_at = NOW()
       WHERE message_id = $1`,
      [messageId, status, JSON.stringify(metadata)]
    );
    logger.info(`Email delivery state updated: ${messageId} -> ${status}`);
  }

  async verifyConnection(): Promise<boolean> {
    return this.provider.verifyConnection ? this.provider.verifyConnection() : true;
  }
}

export const emailService = new EmailService();