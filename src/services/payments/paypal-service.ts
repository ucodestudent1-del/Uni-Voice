import { BusinessLogicError } from "../../domain/errors.js";
import { env } from "../../config/index.js";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "live";
  webhookSecret?: string;
}

export interface CreatePaymentSessionInput {
  invoiceId: string;
  businessId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  invoiceNumber?: string;
  successUrl: string;
  cancelUrl: string;
  paypalConfig?: Partial<PayPalConfig>;
}

export interface CreatePaymentSessionResult {
  paymentId: string;
  url: string;
  approveUrl?: string;
  token: string;
}

export interface PayPalCaptureResult {
  paymentId: string;
  captureId: string;
  status: "completed" | "pending" | "failed" | "denied";
  amount: string;
  currency: string;
  payerEmail?: string;
}

import { createHmac, timingSafeEqual } from "node:crypto";

export class PayPalService {
  private config: PayPalConfig;

  constructor(config?: Partial<PayPalConfig>) {
    if (config) {
      this.config = {
        clientId: config.clientId ?? env.PAYPAL_CLIENT_ID ?? "",
        clientSecret: config.clientSecret ?? env.PAYPAL_CLIENT_SECRET ?? "",
        environment: (config.environment ?? env.PAYPAL_ENVIRONMENT ?? "sandbox") as "sandbox" | "live",
        webhookSecret: config.webhookSecret ?? env.PAYPAL_WEBHOOK_SECRET,
      };
    } else {
      this.config = {
        clientId: env.PAYPAL_CLIENT_ID ?? "",
        clientSecret: env.PAYPAL_CLIENT_SECRET ?? "",
        environment: (env.PAYPAL_ENVIRONMENT ?? "sandbox") as "sandbox" | "live",
        webhookSecret: env.PAYPAL_WEBHOOK_SECRET,
      };
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new BusinessLogicError(
        "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
        "PAYPAL_NOT_CONFIGURED",
      );
    }
  }

  private getBaseUrl(): string {
    return this.config.environment === "live"
      ? "https://api.paypal.com"
      : "https://api.sandbox.paypal.com";
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const res = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new BusinessLogicError(
        `PayPal authentication failed: ${res.status} ${res.statusText}`,
        "PAYPAL_AUTH_FAILED",
      );
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token as string;
  }

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult> {
    const accessToken = await this.getAccessToken();

    const orderRes = await fetch(`${this.getBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Invoice Payment",
              locale: "en-US",
              return_url: input.successUrl,
              cancel_url: input.cancelUrl,
            },
            email_address: input.customerEmail,
            name: input.customerName ? {
              given_name: input.customerName.split(" ")[0] ?? "",
              surname: input.customerName.split(" ").slice(1).join(" ") ?? "",
            } : undefined,
          },
        },
        purchase_units: [
          {
            reference_id: input.invoiceId,
            description: input.invoiceNumber
              ? `Payment for Invoice ${input.invoiceNumber}`
              : "Invoice Payment",
            amount: {
              currency_code: input.currency.toUpperCase(),
              value: input.amount.toFixed(2),
            },
          },
        ],
      }),
    });

    if (!orderRes.ok) {
      throw new BusinessLogicError(
        `PayPal order creation failed: ${orderRes.status} ${orderRes.statusText}`,
        "PAYPAL_ORDER_FAILED",
      );
    }

    const order = (await orderRes.json()) as {
      id: string;
      links?: Array<{ rel: string; href: string }>;
    };
    const paymentId = order.id;
    const approveUrl = order.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;

    if (!approveUrl) {
      throw new BusinessLogicError("PayPal did not return an approval URL", "PAYPAL_NO_APPROVE_URL");
    }

    return {
      paymentId,
      url: approveUrl,
      approveUrl,
      token: paymentId,
    };
  }

  async capturePayment(orderId: string): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken();

    const res = await fetch(`${this.getBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new BusinessLogicError(
        `PayPal capture failed: ${res.status} ${res.statusText}`,
        "PAYPAL_CAPTURE_FAILED",
      );
    }

    const order = (await res.json()) as {
      id: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            amount: { value: string; currency_code: string };
            payer?: { email_address?: string };
          }>;
        };
      }>;
    };
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

    if (!capture) {
      throw new BusinessLogicError("No capture data in PayPal order", "PAYPAL_NO_CAPTURE");
    }

    return {
      paymentId: order.id,
      captureId: capture.id,
      status: capture.status.toLowerCase() as PayPalCaptureResult["status"],
      amount: capture.amount.value,
      currency: capture.amount.currency_code,
      payerEmail: capture.payer?.email_address,
    };
  }

  async getOrderDetails(orderId: string): Promise<Record<string, unknown>> {
    const accessToken = await this.getAccessToken();

    const res = await fetch(`${this.getBaseUrl()}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new BusinessLogicError(
        `PayPal order lookup failed: ${res.status} ${res.statusText}`,
        "PAYPAL_LOOKUP_FAILED",
      );
    }

     return (await res.json()) as Record<string, unknown>;
  }

  verifyWebhookSignature(payload: string, signature: string, _webhookId?: string): boolean {
    if (!this.config.webhookSecret) {
      return true;
    }

    const expectedSig = createHmac("sha256", this.config.webhookSecret)
      .update(payload, "utf8")
      .digest("hex");

    const expected = `sha256=${expectedSig}`;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  getConfig(): Pick<PayPalConfig, "environment"> {
    return { environment: this.config.environment };
  }
}

export const paypalService = new PayPalService();
