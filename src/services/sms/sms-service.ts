import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

export interface SmsRecipient {
  to: string;
  name?: string;
}

export interface SmsMessage {
  recipient: SmsRecipient;
  message: string;
}

export type SmsStatus = "sent" | "failed";

export interface SmsProvider {
  readonly name: string;
  send(sms: { to: string; message: string }): Promise<{ messageId: string; status: SmsStatus }>;
  verifyConnection?(): Promise<boolean>;
}

/**
 * Stub provider — logs the SMS instead of sending it.
 * Default in development and test environments.
 */
export class StubSmsProvider implements SmsProvider {
  readonly name = "stub";

  async send(sms: { to: string; message: string }): Promise<{ messageId: string; status: SmsStatus }> {
    const messageId = `stub-sms-${Date.now()}`;
    logger.info(`[StubSmsProvider] (not sent) to=${sms.to} message="${sms.message}" msgId=${messageId}`);
    return { messageId, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }
}

/**
 * Twilio provider — sends SMS via the Twilio REST API using
 * the environment's fetch (no additional SDK dependency).
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.fromNumber = env.TWILIO_PHONE_NUMBER ?? "";
  }

  private get configured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async send(sms: { to: string; message: string }): Promise<{ messageId: string; status: SmsStatus }> {
    if (!this.configured) {
      throw new Error("Twilio SMS provider is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: sms.to,
      From: this.fromNumber,
      Body: sms.message,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      logger.error({ status: res.status, errorText, to: sms.to }, "Twilio SMS send failed");
      return { messageId: `twilio-failed-${Date.now()}`, status: "failed" };
    }

    const data = (await res.json()) as { sid?: string };
    return { messageId: data.sid ?? `twilio-${Date.now()}`, status: "sent" };
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.configured) return false;
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

function createProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "twilio":
      return new TwilioSmsProvider();
    case "stub":
    default:
      return new StubSmsProvider();
  }
}

export const smsService = {
  provider: createProvider(),

  async send(to: string, message: string): Promise<{ messageId: string; status: SmsStatus }> {
    return this.provider.send({ to, message });
  },

  async verifyConnection(): Promise<boolean> {
    return this.provider.verifyConnection?.() ?? true;
  },
};

/**
 * Builds the payment-link SMS body for an invoice.
 * Kept short to fit comfortably within the 160-character
 * single-segment SMS budget when possible.
 */
export function buildPaymentLinkSms(options: {
  businessName: string;
  invoiceNumber?: string | null;
  amountDue: string;
  currency: string;
  paymentUrl: string;
}): string {
  const { businessName, invoiceNumber, amountDue, currency, paymentUrl } = options;
  const ref = invoiceNumber ? `inv ${invoiceNumber}` : "your invoice";
  return `${businessName}: ${ref} for ${currency} ${amountDue} is due. Pay here: ${paymentUrl}`;
}
