export const DEFAULT_INVOICE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice {{invoice.invoiceNumber}}</title>
  <style>
    body { margin: 0; padding: 0; color: #1e293b; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.5; }
    .page { max-width: 900px; margin: 0 auto; padding: 56px 40px; }
    :root {
      --color-bg: #ffffff;
      --color-surface: #f8fafc;
      --color-border: #e2e8f0;
      --color-text-primary: #0f172a;
      --color-text-secondary: #475569;
      --color-text-tertiary: #94a3a5;
      --color-brand: #2563eb;
    }
    .header-section { padding-bottom: 24px; border-bottom: 3px solid var(--color-brand); }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 80px; max-width: 240px; object-contain; }
    h1 { margin: 0; font-size: 28px; color: var(--color-text-primary); font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 20px; color: var(--color-text-primary); font-weight: 700; }
    h3 { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); }
    .muted { color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
    .tertiary { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.4; }
    .highlight { color: var(--color-brand); font-weight: 600; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
    .meta-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
    .divider { height: 1px; background: var(--color-border); margin: 32px 0; }
    .section { padding: 32px 0; border-bottom: 1px solid var(--color-border); }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-tertiary); margin-bottom: 16px; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: var(--color-surface); padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); border-bottom: 2px solid var(--color-border); }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 13px; line-height: 1.5; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    .totals-table { width: 100%; max-width: 380px; margin-left: auto; border-collapse: collapse; }
    .totals-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid var(--color-border); }
    .totals-label { color: var(--color-text-tertiary); font-weight: 500; }
    .totals-value { color: var(--color-text-primary); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .big-total-row td { font-weight: 700; font-size: 16px; }
    .big-total-label { color: var(--color-text-tertiary); }
    .big-total-value { color: var(--color-brand); }
    .paid-amount { color: #065f46; font-weight: 600; }
    .balance-due { color: var(--color-brand); font-weight: 700; font-size: 18px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .info-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px 20px; }
    .footer { padding: 24px 0; font-size: 12px; color: var(--color-text-tertiary); border-top: 1px solid var(--color-border); }
    .thank-you { font-size: 14px; font-weight: 500; color: var(--color-text-secondary); }
    @media (max-width: 600px) {
      .page { padding: 24px 16px; }
      .header-grid { grid-template-columns: 1fr; }
      .business-col { text-align: left; }
      .meta-grid { grid-template-columns: 1fr; }
      .totals-table { max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header: Business info + Invoice details -->
  <div class="header-section">
    <div class="header-grid">
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <div style="margin-top: 8px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 700;">{{business.name}}</h3>
          {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
          {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
          {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
          {{#if business.taxId}}<p class="tertiary">Tax ID: {{business.taxId}}</p>{{/if}}
          {{#if business.address}}
          <p class="muted" style="margin: 4px 0 0; white-space: pre-line;">
            {{business.address.addressLine1}}<br />
            {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br />{{/if}}
            {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br />
            {{business.address.countryCode}}
          </p>
          {{/if}}
        </div>
      </div>
      <div class="business-col">
        <h1>{{invoice.title}}</h1>
        <div class="meta-grid" style="justify-items: end;">
          <div class="meta-item"><span class="meta-label">Invoice #</span><span class="meta-value">{{invoice.invoiceNumber}}</span></div>
          <div class="meta-item"><span class="meta-label">Issue Date</span><span class="meta-value">{{invoice.issueDate}}</span></div>
          <div class="meta-item"><span class="meta-label">Due Date</span><span class="meta-value">{{invoice.dueDate}}</span></div>
          {{#if invoice.poNumber}}
          <div class="meta-item"><span class="meta-label">P.O. #</span><span class="meta-value">{{invoice.poNumber}}</span></div>
          {{/if}}
          <div class="meta-item"><span class="meta-label">Currency</span><span class="meta-value">{{meta.code}}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bill To -->
  {{#if customer}}
  <div class="section">
    <h3>Bill To</h3>
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Customer</span><span class="meta-value">{{customer.name}}</span></div>
      {{#if customer.companyName}}
      <div class="meta-item"><span class="meta-label">Company</span><span class="meta-value">{{customer.companyName}}</span></div>
      {{/if}}
      {{#if customer.email}}
      <div class="meta-item"><span class="meta-label">Email</span><span class="meta-value highlight">{{customer.email}}</span></div>
      {{/if}}
      {{#if customer.address}}
      <div class="meta-item"><span class="meta-label">Address</span><span class="meta-value" style="white-space: pre-line;">{{customer.address.addressLine1}}<br />{{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}{{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />{{customer.address.countryCode}}</span></div>
      {{/if}}
    </div>
  </div>
  {{/if}}

  <!-- Line Items -->
  <div class="section">
    <div class="section-title">Line Items</div>
    {{#if lineItems.length}}
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th>
          <th class="text-right">Tax</th><th class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">{{add @index 1}}</td>
          <td class="align-top">{{{nl2br description}}}</td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{/if}}
  </div>

  <!-- Fees -->
  {{#if fees.length}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Additional Fees</div>
    <table class="items-table">
      <thead><tr><th>Description</th><th class="text-right">Amount</th><th class="text-right">Tax</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        {{#each fees}}
        <tr><td>{{description}}</td><td class="text-right">{{formatMoney amount}}</td><td class="text-right">{{formatRate taxRate}}</td><td class="text-right">{{formatMoney (add amount (default 0 taxAmount))}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <!-- Financial Summary -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Financial Summary</div>
    <table class="totals-table">
      <tr><td class="totals-label">Subtotal</td><td class="totals-value">{{formatMoney totals.subtotal}}</td></tr>
      {{#if totals.discountTotal}}
      <tr><td class="totals-label">Discount</td><td class="totals-value" style="color: #065f46;">−{{formatMoney totals.discountTotal}}</td></tr>
      {{/if}}
      <tr><td class="totals-label">Tax</td><td class="totals-value">{{formatMoney totals.taxTotal}}</td></tr>
      {{#if fees.length}}
      <tr><td class="totals-label">Fees</td><td class="totals-value">{{formatMoney totals.feeTotal}}</td></tr>
      {{/if}}
      <tr class="big-total-row"><td class="big-total-label">Total</td><td class="big-total-value">{{formatMoney totals.total}}</td></tr>
      {{#if totals.amountPaid}}
      <tr><td class="totals-label">Amount Paid</td><td class="totals-value paid-amount">+{{formatMoney totals.amountPaid}}</td></tr>
      {{/if}}
      <tr><td class="totals-label balance-due-label">Balance Due</td><td class="totals-value balance-due">{{formatMoney totals.amountDue}}</td></tr>
    </table>
  </div>

  <!-- Payment Instructions -->
  {{#if invoice.paymentInstructions}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Payment Instructions</div>
    <div class="info-box">{{{nl2br invoice.paymentInstructions}}}</div>
  </div>
  {{/if}}

  <!-- Notes -->
  {{#if invoice.notes}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Notes</div>
    <div class="info-box">{{{nl2br invoice.notes}}}</div>
  </div>
  {{/if}}

  <!-- Terms & Conditions -->
  {{#if invoice.terms}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="info-box">{{{nl2br invoice.terms}}}</div>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    {{#if invoice.isFinalized}}
    <p>Invoice #{{invoice.invoiceNumber}} — {{business.name}}</p>
    {{#if business.email}}<p>Contact: {{business.email}}</p>{{/if}}
    {{else}}
    <p>This is a draft invoice. Not yet finalized.</p>
    {{/if}}
    <p class="thank-you">Thank you for your business.</p>
  </div>

</div>
</body>
</html>`;
