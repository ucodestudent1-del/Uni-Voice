import Stripe from "stripe";
import { env } from "../../config/index.js";
import { BusinessLogicError } from "../../domain/errors.js";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BusinessLogicError("Stripe is not configured. Set STRIPE_SECRET_KEY.", "STRIPE_NOT_CONFIGURED");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export interface CreateCheckoutSessionInput {
  planId: string;
  planCode: string;
  planName: string;
  price: number;
  currency: string;
  businessId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string;
}

export class StripeService {
  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: {
              name: `${input.planName} Plan`,
              description: `Universal Invoice Generator ${input.planName}`,
            },
            unit_amount: Math.round(input.price * 100),
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        businessId: input.businessId,
        planId: input.planId,
        planCode: input.planCode,
      },
    });

    if (!session.url) {
      throw new BusinessLogicError("Failed to create Stripe checkout session", "STRIPE_ERROR");
    }

    return { sessionId: session.id, url: session.url };
  }

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const stripe = getStripe();
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BusinessLogicError("Stripe webhook secret is not configured", "STRIPE_NOT_CONFIGURED");
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = getStripe();
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = getStripe();
    return stripe.subscriptions.cancel(subscriptionId);
  }

  async getSubscriptionInvoices(subscriptionId: string): Promise<any[]> {
    const stripe = getStripe();
    const invoices: any[] = [];
    const params: Stripe.InvoiceListParams = {
      subscription: subscriptionId,
      limit: 100,
    };
    const result = await stripe.invoices.list(params);
    for (const inv of result.data) {
      invoices.push({
        id: inv.id,
        amount: inv.total,
        currency: inv.currency.toUpperCase(),
        status: inv.status ?? "open",
        created: inv.created,
        invoiceNumber: inv.number,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
      });
    }
    return invoices;
  }

  async getPaymentMethods(customerId: string): Promise<any[]> {
    const stripe = getStripe();
    const result = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    return result.data.map((pm) => ({
      id: pm.id,
      type: "card",
      card: {
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      },
      isDefault: false,
    }));
  }
}

export const stripeService = new StripeService();
