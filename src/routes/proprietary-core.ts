import { Router } from "express";
import { z } from "zod";
import { invoiceService } from "../services/invoice-service.js";
import { quoteService } from "../services/quote-service.js";
import { customerService } from "../services/customer-service.js";
import { productServiceService } from "../services/product-service/product-service.js";
import { brandingService } from "../services/branding-service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { env } from "../config/index.js";

const router = Router();

router.use(requireAuth);

const invoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  currency: z.string().length(3),
  issueDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.union([z.string(), z.number()]),
      unit: z.string().default("each"),
      unitPrice: z.union([z.string(), z.number()]),
      discount: z.union([z.string(), z.number()]).optional(),
      discountType: z.enum(["fixed", "percentage"]).optional(),
      taxRate: z.union([z.string(), z.number()]).default(0),
      taxName: z.string().optional().nullable(),
      isTaxInclusive: z.boolean().optional(),
      productId: z.string().optional().nullable(),
    }),
  ),
  fees: z
    .array(
      z.object({
        description: z.string().min(1),
        amount: z.union([z.string(), z.number()]),
        taxRate: z.union([z.string(), z.number()]).optional(),
        taxName: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

const quoteSchema = invoiceSchema.extend({
  expiryDate: z.string().optional().nullable(),
  scopeOfWork: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

function getLimit(req: AuthRequest): number {
  return Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
}

function getOffset(req: AuthRequest): number {
  return Math.max(Number(req.query.offset) || 0, 0);
}

function getSortBy(req: AuthRequest, defaultCol = "created_at"): string {
  return (req.query.sortBy as string) || defaultCol;
}

function getSortOrder(req: AuthRequest): "asc" | "desc" {
  return (req.query.sortOrder as string) === "asc" ? "asc" : "desc";
}

router.get("/invoices", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const sortBy = getSortBy(req);
    const sortOrder = getSortOrder(req);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const result = await invoiceService.findMany(req.user.businessId, {
      limit,
      offset,
      sortBy,
      sortOrder,
      search,
      status,
      customerId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = invoiceSchema.parse(req.body);
    const result = await invoiceService.create(req.user.businessId, parsed);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const invoice = await invoiceService.findById(req.user.businessId, req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

router.patch("/invoices/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await invoiceService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/finalize", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await invoiceService.finalize(req.user.businessId, req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/send", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await invoiceService.send(req.user.businessId, req.params.id, {
      to: req.body.to,
      cc: req.body.cc,
      bcc: req.body.bcc,
      subject: req.body.subject,
      message: req.body.message,
    }, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/mark-paid", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const { amount, method = "manual", reference } = req.body;
    const result = await invoiceService.recordPayment(
      req.user.businessId,
      req.params.id,
      {
        amount,
        currency: req.body.currency || "USD",
        method,
        providerPaymentId: reference,
        idempotencyKey: req.body.idempotencyKey,
      },
      req.user.id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id/pdf", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const invoice = await invoiceService.findById(req.user.businessId, req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const pdf = await invoiceService.generatePdf(req.user.businessId, req.params.id, invoice as any);
    res.set("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/duplicate", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await invoiceService.duplicate(req.user.businessId, req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id/events", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const events = await invoiceService.getInvoiceEvents(req.user.businessId, req.params.id);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id/share-link", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const invoice = await invoiceService.findById(
      req.user.businessId,
      req.params.id,
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    if (!invoice.public_token) {
      const token = crypto.randomUUID().slice(0, 32);
      await query(
        `UPDATE invoices SET public_token = $1, public_token_expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $2 AND business_id = $3`,
        [token, req.params.id, req.user.businessId],
      );
      invoice.public_token = token;
      invoice.public_token_expires_at = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    const url = `${env.APP_FRONTEND_URL || "http://localhost:5173"}/invoice/${invoice.public_token}`;
    res.json({
      url,
      token: invoice.public_token,
      expiresAt: invoice.public_token_expires_at,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/customers", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const result = await customerService.search(req.user.businessId, {
      search: (req.query.search as string) || "",
      limit,
      offset,
    });
    res.json({ customers: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
});

router.post("/customers", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await customerService.create(req.body, req.user.businessId, req.user.id);
    res.status(201).json({ customer: result });
  } catch (err) {
    next(err);
  }
});

router.get("/customers/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const customer = await customerService.getById(req.user.businessId, req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

router.patch("/customers/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await customerService.update(req.user.businessId, req.params.id, req.body, req.user.id);
    res.json({ customer: result });
  } catch (err) {
    next(err);
  }
});

router.delete("/customers/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    await customerService.delete(req.user.businessId, req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.get("/customers/:id/invoices", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const status = req.query.status as string | undefined;
    const result = await customerService.getInvoiceHistory(req.user.businessId, req.params.id, {
      limit,
      offset,
      status,
    });
    res.json({ invoices: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
});

router.get("/customers/:id/summary", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const summary = await customerService.getSummary(req.user.businessId, req.params.id);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

router.get("/products", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const sortBy = (req.query.sortBy as string) || "name";
    const allowedProductSort = ["name", "createdAt", "unitPrice", "sku"] as const;
    const productSortBy = allowedProductSort.includes(sortBy as any)
      ? (sortBy as "name" | "createdAt" | "unitPrice" | "sku")
      : "name";

    const result = await productServiceService.search(req.user.businessId, {
      search: (req.query.search as string) || "",
      status: "all",
      sortBy: productSortBy,
      sortOrder: getSortOrder(req),
      limit,
      offset,
    });
    res.json({ products: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
});

router.post("/products", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await productServiceService.create(req.user.businessId, req.body, req.user.id);
    res.status(201).json({ product: result });
  } catch (err) {
    next(err);
  }
});

router.get("/products/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const product = await productServiceService.getById(req.user.businessId, req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.patch("/products/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await productServiceService.update(req.user.businessId, req.params.id, req.body);
    res.json({ product: result });
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await productServiceService.update(req.user.businessId, req.params.id, { status: "archived" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.get("/quotes", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const sortBy = getSortBy(req);
    const sortOrder = getSortOrder(req);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const result = await quoteService.findMany(req.user.businessId, {
      limit,
      offset,
      sortBy,
      sortOrder,
      search,
      status,
      customerId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/quotes", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = quoteSchema.parse(req.body);
    const result = await quoteService.create(req.user.businessId, parsed);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/quotes/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const quote = await quoteService.findById(req.user.businessId, req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

router.patch("/quotes/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await quoteService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/quotes/:id/finalize", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await quoteService.finalize(req.user.businessId, req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/quotes/:id/send", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await quoteService.send(req.user.businessId, req.params.id, {
      to: req.body.to,
      cc: req.body.cc,
      bcc: req.body.bcc,
      subject: req.body.subject,
      message: req.body.message,
    }, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/quotes/:id/accept", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await quoteService.accept(req.user.businessId, req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/quotes/:id/convert-to-invoice", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await quoteService.convertToInvoice(
      req.user.businessId,
      req.params.id,
      req.user.id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/quotes/:id/pdf", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const quote = await quoteService.findById(req.user.businessId, req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const pdf = await quoteService.generatePdf(req.user.businessId, req.params.id, quote as any);
    res.set("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.get("/quotes/:id/events", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const events = await quoteService.getEvents(req.user.businessId, req.params.id);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

router.get("/quotes/:id/share-link", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const quote = await quoteService.findById(req.user.businessId, req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    if (!quote.public_token) {
      const token = crypto.randomUUID().slice(0, 32);
      await query(
        `UPDATE quotes SET public_token = $1, public_token_expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $2 AND business_id = $3`,
        [token, req.params.id, req.user.businessId],
      );
      quote.public_token = token;
      quote.public_token_expires_at = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    const url = `${env.APP_FRONTEND_URL || "http://localhost:5173"}/quote/${quote.public_token}`;
    res.json({
      url,
      token: quote.public_token,
      expiresAt: quote.public_token_expires_at,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/payments", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const { invoiceId, amount, currency, method = "manual", reference } = req.body;
    if (!invoiceId || !amount) {
      return res.status(400).json({ error: "invoiceId and amount required" });
    }
    const result = await invoiceService.recordPayment(
      req.user.businessId,
      invoiceId,
      {
        amount,
        currency: currency || "USD",
        method,
        providerPaymentId: reference,
        idempotencyKey: req.body.idempotencyKey,
      },
      req.user.id,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/payments/summary", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `SELECT
         COUNT(*) as total_payments,
         SUM(amount) as total_received,
         currency
       FROM payments
       WHERE business_id = $1 AND status = 'succeeded'
       GROUP BY currency`,
      [req.user.businessId],
    );
    res.json({ summary: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/revenue", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const dateFrom = (req.query.dateFrom as string) || "1970-01-01";
    const dateTo = (req.query.dateTo as string) || new Date().toISOString().slice(0, 10);
    const groupBy = (req.query.groupBy as string) || "month";

    const periodExpr = groupBy === "month"
      ? "DATE_TRUNC('month', issue_date)"
      : "DATE_TRUNC('year', issue_date)";

    const result = await query(
      `SELECT
         ${periodExpr} as period,
         SUM(total) as revenue,
         COUNT(*) as invoice_count
       FROM invoices
       WHERE business_id = $1 AND status IN ('posted', 'sent', 'viewed', 'partial', 'paid')
         AND issue_date BETWEEN $2 AND $3
       GROUP BY period
       ORDER BY period ASC`,
      [req.user.businessId, dateFrom, dateTo],
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/invoice-status", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `SELECT status, COUNT(*) as count, SUM(total) as total
       FROM invoices
       WHERE business_id = $1
       GROUP BY status
       ORDER BY count DESC`,
      [req.user.businessId],
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/customer-summary", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `SELECT
         c.id, c.name, c.email,
         COUNT(i.id) as invoice_count,
         SUM(i.total) as total_invoiced,
         SUM(i.amount_due) as total_outstanding
       FROM customers c
       LEFT JOIN invoices i ON i.customer_id = c.id AND i.business_id = $1
       WHERE c.business_id = $1
       GROUP BY c.id
       ORDER BY total_invoiced DESC
       LIMIT 20`,
      [req.user.businessId],
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/branding", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const branding = await brandingService.get(req.user.businessId);
    res.json({ branding });
  } catch (err) {
    next(err);
  }
});

router.post("/branding", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await brandingService.update(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/branding/preview", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const html = await brandingService.generatePreviewHtml(
      req.user.businessId,
      req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    );
    res.json({ html });
  } catch (err) {
    next(err);
  }
});

const emailTemplateSchema = z.object({
  name: z.string().min(1),
  templateType: z.enum(["invoice", "quote", "reminder", "payment_receipt", "custom"]).default("custom"),
  locale: z.string().default("en-US"),
  subjectTemplate: z.string().min(1),
  bodyTemplate: z.string().min(1),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const DEFAULT_EMAIL_TEMPLATES: Record<string, { subject: string; body: string; name: string }> = {
  invoice: {
    name: "Invoice",
    subject: "Invoice {{invoice_number}} from {{business_name}}",
    body: `<p>Hi {{customer_name}},</p>
<p>Please find attached your invoice {{invoice_number}} for {{total_amount}} {{currency}}.</p>
<p>Due date: {{due_date}}</p>
<p>You can view and pay this invoice online: {{invoice_url}}</p>
<p>Thank you for your business!</p>`,
  },
  quote: {
    name: "Quote",
    subject: "Quote {{quote_number}} from {{business_name}}",
    body: `<p>Hi {{customer_name}},</p>
<p>Please find your quote {{quote_number}} for {{total_amount}} {{currency}}.</p>
<p>This quote is valid until: {{expiry_date}}</p>
<p>Accept the quote online: {{quote_url}}</p>
<p>Thank you!</p>`,
  },
  reminder: {
    name: "Payment Reminder",
    subject: "Reminder: Invoice {{invoice_number}} is overdue",
    body: `<p>Hi {{customer_name}},</p>
<p>This is a friendly reminder that invoice {{invoice_number}} for {{total_amount}} {{currency}} was due on {{due_date}}.</p>
<p>Please settle the balance at your earliest convenience: {{invoice_url}}</p>
<p>Thank you.</p>`,
  },
  payment_receipt: {
    name: "Payment Receipt",
    subject: "Payment received for invoice {{invoice_number}}",
    body: `<p>Hi {{customer_name}},</p>
<p>We've received your payment of {{payment_amount}} {{currency}} for invoice {{invoice_number}}.</p>
<p>Transaction {{payment_reference}}</p>
<p>Thank you for your payment!</p>`,
  },
};

router.get("/email-templates", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const templateType = (req.query.type as string) || undefined;
    let result;
    if (templateType) {
      const byType = await query(
        `SELECT * FROM email_templates
         WHERE business_id = $1 AND template_type = $2 AND is_active = TRUE
         ORDER BY created_at DESC`,
        [req.user.businessId, templateType],
      );
      result = byType;
    } else {
      result = await query(
        `SELECT * FROM email_templates
         WHERE business_id = $1 AND is_active = TRUE
         ORDER BY template_type, created_at`,
        [req.user.businessId],
      );
    }
    res.json({ templates: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/email-templates/defaults", async (_req: AuthRequest, res) => {
  res.json({ defaults: DEFAULT_EMAIL_TEMPLATES });
});

router.post("/email-templates", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = emailTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.errors });
    }
    const d = parsed.data;
    const result = await query(
      `INSERT INTO email_templates
         (business_id, name, template_type, locale, subject_template, body_template, is_default, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [
        req.user.businessId,
        d.name,
        d.templateType,
        d.locale,
        d.subjectTemplate,
        d.bodyTemplate,
        d.isDefault ?? false,
      ],
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get("/email-templates/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `SELECT * FROM email_templates WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put("/email-templates/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = emailTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.errors });
    }
    const d = parsed.data;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const map: Record<string, unknown> = {
      name: d.name,
      template_type: d.templateType,
      locale: d.locale,
      subject_template: d.subjectTemplate,
      body_template: d.bodyTemplate,
      is_default: d.isDefault,
      is_active: d.isActive,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) {
        updates.push(`${col} = $${idx + 2}`);
        values.push(val);
        idx++;
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    const result = await query(
      `UPDATE email_templates SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.user.businessId, ...values],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/email-templates/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `DELETE FROM email_templates WHERE id = $1 AND business_id = $2 RETURNING id`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

const recurringSchema = z.object({
  name: z.string().min(1),
  customerId: z.string().optional().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  intervalCount: z.number().int().positive().default(1),
  nextGenerationAt: z.string().min(1),
  endDate: z.string().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  issueOffsetDays: z.number().int().min(0).default(0),
  dueOffsetDays: z.number().int().min(0).default(0),
  autoSend: z.boolean().default(false),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.union([z.string(), z.number()]).default(1),
      unit: z.string().default("each"),
      unitPrice: z.union([z.string(), z.number()]),
      taxRate: z.union([z.string(), z.number()]).default(0),
      taxName: z.string().optional().nullable(),
    }),
  ),
});

router.get("/recurring-invoices", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const limit = getLimit(req);
    const offset = getOffset(req);
    const result = await query(
      `SELECT
         ri.*,
         c.name as customer_name,
         i.number as last_invoice_number
       FROM recurring_invoices ri
       LEFT JOIN customers c ON c.id = ri.customer_id AND c.business_id = ri.business_id
       LEFT JOIN invoices i ON i.id = ri.last_generated_invoice_id AND i.business_id = ri.business_id
       WHERE ri.business_id = $1
       ORDER BY ri.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.businessId, limit, offset],
    );
    res.json({ recurringInvoices: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/recurring-invoices/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `SELECT ri.* FROM recurring_invoices ri
       WHERE ri.id = $1 AND ri.business_id = $2`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Recurring invoice not found" });
    }
    const itemsResult = await query(
      `SELECT description, quantity, unit, unit_price, tax_rate, tax_name, sort_order
       FROM recurring_invoice_items
       WHERE recurring_invoice_id = $1
       ORDER BY sort_order`,
      [req.params.id],
    );
    res.json({ recurringInvoice: result.rows[0], items: itemsResult.rows });
  } catch (err) {
    next(err);
  }
});

router.post("/recurring-invoices", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = recurringSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.errors });
    }
    const { items, ...recurringFields } = parsed.data;
    const recurringResult = await query(
      `INSERT INTO recurring_invoices
         (business_id, customer_id, name, frequency, interval_count, next_generation_at,
          end_date, currency, notes, terms, issue_offset_days, due_offset_days, auto_send, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING *`,
      [
        req.user.businessId,
        recurringFields.customerId ?? null,
        recurringFields.name,
        recurringFields.frequency,
        recurringFields.intervalCount,
        recurringFields.nextGenerationAt,
        recurringFields.endDate ?? null,
        recurringFields.currency,
        recurringFields.notes ?? null,
        recurringFields.terms ?? null,
        recurringFields.issueOffsetDays,
        recurringFields.dueOffsetDays,
        recurringFields.autoSend,
      ],
    );
    const recurringId = recurringResult.rows[0].id;
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await query(
          `INSERT INTO recurring_invoice_items
             (recurring_invoice_id, description, quantity, unit, unit_price, tax_rate, tax_name, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            recurringId,
            it.description,
            it.quantity,
            it.unit,
            it.unitPrice,
            it.taxRate,
            it.taxName ?? null,
            i,
          ],
        );
      }
    }
    res.status(201).json({ recurringInvoice: { ...recurringResult.rows[0], items } });
  } catch (err) {
    next(err);
  }
});

router.put("/recurring-invoices/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const parsed = recurringSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.errors });
    }
    const data = parsed.data;
    const setClauses: string[] = [];
    const values: unknown[] = [req.params.id, req.user.businessId];
    let idx = 3;
    for (const key of [
      "name", "customer_id", "frequency", "interval_count", "next_generation_at",
      "end_date", "currency", "notes", "terms", "issue_offset_days", "due_offset_days", "auto_send",
    ]) {
      if (data[key as keyof typeof data] !== undefined) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(data[key as keyof typeof data]);
      }
    }
    if (setClauses.length === 0) {
      return res.json({ recurringInvoice: (await query(
        `SELECT * FROM recurring_invoices WHERE id = $1 AND business_id = $2`,
        [req.params.id, req.user.businessId],
      )).rows[0] });
    }
    setClauses.push("updated_at = NOW()");
    const result = await query(
      `UPDATE recurring_invoices SET ${setClauses.join(", ")}
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      values,
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Recurring invoice not found" });
    }
    res.json({ recurringInvoice: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/recurring-invoices/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `DELETE FROM recurring_invoices
       WHERE id = $1 AND business_id = $2
       RETURNING id`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Recurring invoice not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/recurring-invoices/:id/activate", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `UPDATE recurring_invoices
       SET status = 'active', is_active = TRUE
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Recurring invoice not found" });
    }
    res.json({ recurringInvoice: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/recurring-invoices/:id/deactivate", async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ error: "No business context" });
    }
    const result = await query(
      `UPDATE recurring_invoices
       SET status = 'draft', is_active = FALSE
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.user.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Recurring invoice not found" });
    }
    res.json({ recurringInvoice: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
