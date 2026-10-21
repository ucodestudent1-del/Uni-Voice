import { logger } from "../utils/logger.js";
import { query } from "../db/pool.js";
import { emailService } from "./email/email-service.js";
import { invoiceService } from "./invoice-service.js";
import { isSchedulerAvailable, registerHandler, scheduleRepeatableJob } from "./scheduler.js";

const REMINDER_QUEUE = "reminders";

interface ReminderRuleRow {
  id: string;
  business_id: string;
  name: string;
  trigger_type: "before_due" | "after_due" | "manual";
  offset_days: number;
  min_status: string;
  max_send_count: number;
  subject_template: string;
  message_template: string;
  is_active: boolean;
  repeat_every_days: number;
  email_template_id: string | null;
  include_pdf: boolean;
}

interface InvoiceRow {
  id: string;
  business_id: string;
  customer_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_address_line_1: string | null;
  customer_address_line_2: string | null;
  customer_city: string | null;
  customer_state_or_region: string | null;
  customer_postal_code: string | null;
  customer_country_code: string | null;
  status: string;
  due_date: string | null;
  issue_date: string | null;
  total: string;
  amount_due: string;
  amount_paid: string;
  currency: string;
  notes: string | null;
  terms: string | null;
  payment_instructions: string | null;
  is_finalized: boolean;
}

interface EmailTemplateRow {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  is_default: boolean;
}

export interface ReminderTier {
  triggerType: "before_due" | "after_due";
  offsetDays: number;
  maxSendCount: number;
  subjectTemplate: string;
  messageTemplate: string;
}

export const DEFAULT_REMINDER_TIERS: ReminderTier[] = [
  {
    triggerType: "before_due",
    offsetDays: 3,
    maxSendCount: 1,
    subjectTemplate: "Reminder: Invoice {{invoice_number}} is due in 3 days",
    messageTemplate: "This is a friendly reminder that invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.",
  },
  {
    triggerType: "before_due",
    offsetDays: 0,
    maxSendCount: 1,
    subjectTemplate: "Reminder: Invoice {{invoice_number}} is due today",
    messageTemplate: "This is a reminder that invoice {{invoice_number}} for {{amount_due}} is due today.",
  },
  {
    triggerType: "after_due",
    offsetDays: 3,
    maxSendCount: 1,
    subjectTemplate: "Overdue: Invoice {{invoice_number}} is past due",
    messageTemplate: "Invoice {{invoice_number}} for {{amount_due}} was due on {{due_date}} and is now overdue. Please pay at your earliest convenience.",
  },
];

function compileTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

export class ReminderSchedulerService {
  async processDueReminders(): Promise<{ processed: number; sent: number; errors: number }> {
    if (!isSchedulerAvailable()) {
      logger.info("Scheduler not available — skipping reminder processing");
      return { processed: 0, sent: 0, errors: 0 };
    }

    const rules = await this.getActiveRules();
    let sent = 0;
    let errors = 0;

    for (const rule of rules.rows) {
      try {
        const result = await this.evaluateRule(rule);
        sent += result.sent;
        errors += result.errors;
      } catch (err) {
        errors++;
        logger.error({ err, ruleId: rule.id }, "Failed to evaluate reminder rule");
      }
    }

    return { processed: rules.rows.length, sent, errors };
  }

  private async getActiveRules(): Promise<{ rows: ReminderRuleRow[] }> {
    const result = await query(
      `SELECT id, business_id, name, trigger_type, offset_days, min_status,
              max_send_count, subject_template, message_template, is_active,
              repeat_every_days, email_template_id, include_pdf
       FROM invoice_reminder_rules
       WHERE is_active = TRUE
       ORDER BY offset_days ASC, trigger_type ASC`,
    );
    return { rows: result.rows as ReminderRuleRow[] };
  }

  private async evaluateRule(rule: ReminderRuleRow): Promise<{ sent: number; errors: number }> {
    const targetDate = this.calculateTargetDate(rule);
    if (!targetDate) {
      return { sent: 0, errors: 0 };
    }

    const invoices = await this.findTargetInvoices(rule, targetDate);
    let sent = 0;
    let errors = 0;

    for (const invoice of invoices.rows) {
      const idempotencyKey = `reminder:invoice:${invoice.id}:rule:${rule.id}:date:${targetDate}`;
      const alreadySent = await this.checkReminderSent(invoice.id, rule.id, targetDate);

      if (alreadySent) {
        continue;
      }

      try {
        const result = await this.sendReminderEmail(rule, invoice, idempotencyKey);
        if (result.success) {
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
        logger.error({ err, invoiceId: invoice.id, ruleId: rule.id }, "Failed to send reminder email");
      }
    }

    return { sent, errors };
  }

  private calculateTargetDate(rule: ReminderRuleRow): string | null {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (rule.trigger_type === "before_due") {
      const target = new Date(now);
      target.setDate(target.getDate() + rule.offset_days);
      return target.toISOString().split("T")[0];
    }

    if (rule.trigger_type === "after_due") {
      const target = new Date(now);
      target.setDate(target.getDate() - rule.offset_days);
      return target.toISOString().split("T")[0];
    }

    return null;
  }

  private async findTargetInvoices(
    rule: ReminderRuleRow,
    targetDate: string,
  ): Promise<{ rows: InvoiceRow[] }> {
    const conditions: string[] = [
      "i.business_id = $1",
      "i.is_finalized = TRUE",
      "i.amount_due > 0",
    ];
    const values: unknown[] = [rule.business_id];
    let paramIdx = 2;

    const statusList = rule.min_status ? rule.min_status.split(",") : ["sent", "viewed", "partially_paid"];
    const statusValues = Array.isArray(statusList) ? statusList : [statusList];
    conditions.push(`i.status IN (${statusValues.map((s) => `$${paramIdx + statusValues.indexOf(s)}`).join(",")})`);
    statusValues.forEach((s) => values.push(s));
    paramIdx += statusValues.length;

    if (rule.trigger_type === "before_due") {
      conditions.push(`(i.due_date = $${paramIdx} OR (i.due_date = $${paramIdx} AND i.status != 'paid'))`);
      values.push(targetDate, targetDate);
      paramIdx++;
    } else if (rule.trigger_type === "after_due") {
      conditions.push(`i.due_date <= $${paramIdx}`);
      values.push(targetDate);
      paramIdx++;
    }

    const result = await query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.address_line_1 as customer_address_line_1,
              c.address_line_2 as customer_address_line_2, c.city as customer_city,
              c.state_or_region as customer_state_or_region, c.postal_code as customer_postal_code,
              c.country_code as customer_country_code
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id AND c.business_id = i.business_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.created_at ASC
       LIMIT 200`,
       values,
    );
    return { rows: result.rows as InvoiceRow[] };
  }

  private async checkReminderSent(invoiceId: string, ruleId: string, scheduledFor: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM invoice_reminders
       WHERE invoice_id = $1 AND rule_id = $2 AND DATE(sent_at) = $3
       LIMIT 1`,
      [invoiceId, ruleId, scheduledFor],
    );
    return result.rows.length > 0;
  }

  private async sendReminderEmail(
    rule: ReminderRuleRow,
    invoice: InvoiceRow,
    idempotencyKey: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const recipientEmail = invoice.customer_email;
    if (!recipientEmail) {
      logger.warn({ invoiceId: invoice.id, ruleId: rule.id }, "No customer email — skipping reminder");
      return { success: false };
    }

    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A";
    const amountDue = invoice.amount_due ?? invoice.total ?? "0";

    const variables: Record<string, string> = {
      invoice_number: invoice.invoice_number ?? invoice.id ?? "",
      customer_name: invoice.customer_name ?? "",
      amount_due: amountDue,
      due_date: dueDate,
      total: invoice.total ?? "0",
    };

    const subject = compileTemplate(rule.subject_template, variables);
    const message = compileTemplate(rule.message_template, variables);

    let htmlBody: string;
    let attachments: Array<{ filename: string; content: Buffer }> | undefined;

    if (rule.include_pdf) {
      try {
        const pdf = await invoiceService.generatePdf(
          invoice.business_id,
          invoice.id,
           invoice as unknown as Record<string, unknown>,
        );
        attachments = [{ filename: `Invoice-${invoice.invoice_number ?? invoice.id}.pdf`, content: pdf }];
      } catch (err) {
        logger.warn({ err, invoiceId: invoice.id }, "Failed to generate PDF for reminder attachment");
      }
    }

    if (rule.email_template_id) {
      const template = await this.getEmailTemplate(rule.email_template_id, rule.business_id);
      if (template) {
        htmlBody = this.renderEmailTemplate(template, variables, message);
      } else {
        htmlBody = this.renderDefaultReminderHtml(variables, message, subject);
      }
    } else {
      htmlBody = this.renderDefaultReminderHtml(variables, message, subject);
    }

    const result = await emailService.sendInvoiceEmail({
      invoiceId: invoice.id,
      businessId: invoice.business_id,
      recipient: { email: recipientEmail, name: invoice.customer_name ?? undefined },
      subject,
      htmlBody,
      attachments,
      idempotencyKey,
    });

    await query(
      `INSERT INTO invoice_reminders
       (invoice_id, business_id, rule_id, email_log_id, sent_at, recipient_email, subject, send_count)
       VALUES ($1, $2, $3, NULL, NOW(), $4, $5, 1)`,
      [invoice.id, invoice.business_id, rule.id, recipientEmail, subject],
    );

    logger.info({ invoiceId: invoice.id, ruleId: rule.id }, "Reminder email sent");
    return { success: true, messageId: result.messageId };
  }

  private async getEmailTemplate(templateId: string, businessId: string): Promise<EmailTemplateRow | null> {
    const result = await query(
      `SELECT id, name, subject_template, body_template, is_default
       FROM email_templates
       WHERE id = $1 AND business_id = $2`,
      [templateId, businessId],
    );
    return result.rows[0] as EmailTemplateRow | null ?? null;
  }

  private renderEmailTemplate(template: EmailTemplateRow, variables: Record<string, string>, _fallbackMessage: string): string {
    let html = template.body_template;
    for (const [key, value] of Object.entries(variables)) {
      html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
    return html;
  }

  private renderDefaultReminderHtml(
    variables: Record<string, string>,
    message: string,
    subject: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #333;">
        <h1 style="color: #2563eb; margin-top: 0;">${subject}</h1>
        <p>${message}</p>
        ${variables.due_date ? `<p><strong>Due Date:</strong> ${variables.due_date}</p>` : ""}
        ${variables.amount_due ? `<p><strong>Amount Due:</strong> ${variables.amount_due}</p>` : ""}
        <p>If you have already paid, please disregard this reminder. Thank you.</p>
      </body>
      </html>
    `;
  }

  async scheduleReminderJob(): Promise<void> {
    await scheduleRepeatableJob(REMINDER_QUEUE, "process-due-reminders", {}, { cron: "0 9 * * *" });
  }
}

registerHandler(REMINDER_QUEUE, async (_job) => {
  const service = new ReminderSchedulerService();
  await service.processDueReminders();
});

export const reminderSchedulerService = new ReminderSchedulerService();
