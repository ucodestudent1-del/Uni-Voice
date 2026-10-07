import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
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
  documentType?: "invoice" | "quote";
  quoteId?: string;
}

export interface CreditNoteEmailData {
  creditNoteId: string;
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

export class SendGridEmailProvider implements EmailProvider {
  readonly name = "sendgrid";
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (env.SENDGRID_API_KEY) {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
      this.initialized = true;
    }
  }

  async send(email: { to: EmailRecipient; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<{ messageId: string; status: EmailStatus }> {
    if (!this.initialized) {
      throw new Error("SendGrid API key not configured (SENDGRID_API_KEY)");
    }
    const msg: sgMail.MailDataRequired = {
      to: email.to.email,
      from: env.EMAIL_FROM,
      subject: email.subject,
      html: email.html,
    };
    if (email.to.name) {
      msg.dynamicTemplateData = { name: email.to.name };
    }
    if (email.attachments?.length) {
      msg.attachments = email.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        type: "application/octet-stream",
        disposition: "attachment",
      }));
    }
    const [response] = await sgMail.send(msg);
    const messageId = typeof response?.headers?.["x-message-id"] === "string"
      ? response.headers["x-message-id"]
      : `sg-${Date.now()}@sendgrid.net`;
    return { messageId, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const [resp] = await sgMail.send({
        to: env.EMAIL_FROM,
        from: env.EMAIL_FROM,
        subject: "Connection test — ignore",
        html: "<p>Connection test — ignore</p>",
      });
      return resp.statusCode >= 200 && resp.statusCode < 300;
    } catch {
      return false;
    }
  }
}

export class SesEmailProvider implements EmailProvider {
  readonly name = "ses";
  private ses: import("@aws-sdk/client-ses").SES | null = null;
  private initialized = false;

  constructor() {
    if (env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY) {
      this.init();
    }
  }

  private async init() {
    const mod = await import("@aws-sdk/client-ses");
    const ses = new mod.SES({
      region: env.AWS_SES_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: env.AWS_SES_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY!,
      },
    });
    this.ses = ses;
    this.initialized = true;
  }

  async send(email: { to: EmailRecipient; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<{ messageId: string; status: EmailStatus }> {
    if (!this.initialized) {
      await this.init();
    }
    const params: any = {
      Source: env.EMAIL_FROM,
      Destination: {
        ToAddresses: [email.to.email],
      },
      Message: {
        Subject: { Data: email.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: email.html, Charset: "UTF-8" },
        },
      },
    };
    if (email.attachments?.length) {
      params.Attachments = email.attachments.map((a) => ({
        Filename: a.filename,
        Content: a.content.toString("base64"),
        ContentType: "application/octet-stream",
      }));
    }
    const result: any = await this.ses!.send(params);
    return { messageId: result.MessageId ?? `ses-${Date.now()}`, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }
    try {
      const mod = await import("@aws-sdk/client-ses");
      await this.ses!.send(new mod.ListIdentitiesCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}

export class EmailService {
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? EmailService.createProvider(env.EMAIL_PROVIDER);
  }

  static createProvider(type: string): EmailProvider {
    switch (type) {
      case "smtp":
        return new SmtpEmailProvider();
      case "sendgrid":
        return new SendGridEmailProvider();
      case "ses":
        return new SesEmailProvider();
      default:
        return new StubEmailProvider();
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async sendInvoiceEmail(data: InvoiceEmailData): Promise<{ messageId: string; status: EmailStatus }> {
    const documentType: "invoice" | "quote" = data.documentType ?? "invoice";
    const quoteId = data.documentType === "quote" ? data.quoteId : undefined;
    const invoiceId = documentType === "invoice" ? data.invoiceId : null;

    if (data.idempotencyKey) {
      const existing = await query(
        `SELECT message_id, status FROM email_log
         WHERE idempotency_key = $1 AND document_type = $2
         AND (${documentType === "invoice" ? "invoice_id = $3" : "quote_id = $3"})`,
        [data.idempotencyKey, documentType, documentType === "invoice" ? data.invoiceId : quoteId]
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
      `INSERT INTO email_log (invoice_id, quote_id, document_type, business_id, provider, status, recipient, subject, message_id, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
      [
        invoiceId, quoteId, documentType, data.businessId, this.provider.name, result.status,
        data.recipient.email, data.subject, result.messageId, data.idempotencyKey ?? null,
      ]
    );

    logger.info(`Email sent: to=${data.recipient.email} ${documentType}=${documentType === "invoice" ? data.invoiceId : quoteId} msgId=${result.messageId}`);
    return result;
  }

  async sendCreditNoteEmail(data: CreditNoteEmailData): Promise<{ messageId: string; status: EmailStatus }> {
    if (data.idempotencyKey) {
      const existing = await query(
        `SELECT message_id, status FROM email_log
         WHERE idempotency_key = $1 AND credit_note_id = $2`,
        [data.idempotencyKey, data.creditNoteId]
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
      `INSERT INTO email_log (credit_note_id, business_id, provider, status, recipient, subject, message_id, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
      [
        data.creditNoteId, data.businessId, this.provider.name, result.status,
        data.recipient.email, data.subject, result.messageId, data.idempotencyKey ?? null,
      ]
    );

    logger.info(`Credit note email sent: to=${data.recipient.email} creditNoteId=${data.creditNoteId} msgId=${result.messageId}`);
    return result;
  }

  async updateDeliveryState(messageId: string, status: EmailStatus, metadata: Record<string, string> = {}): Promise<void> {
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