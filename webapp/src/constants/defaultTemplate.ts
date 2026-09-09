export const DEFAULT_INVOICE_TEMPLATE = `<!DOCTYPE html>
<html lang="\{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Invoice \{{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Invoice</h1>
      <h2 style="margin:0; font-size: 22px;">\{{invoice.invoiceNumber}}</h2>
      {{#if invoice.notes}}<p class="muted">{{{invoice.notes}}}</p>{{/if}}
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>
  <div class="grid">
    <div>
      <h3 style="margin:0;font-size:13px; text-transform:uppercase;">Bill To</h3>
      <p style="margin:0;font-weight:600">{{customer.name}}</p>
    </div>
    <div style="text-align:right">
      <p class="muted">Issue: {{invoice.issueDate}}</p>
      <p class="muted">Due: {{invoice.dueDate}}</p>
      <p class="muted">Currency: {{invoice.currency}}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{add @index 1}}</td><td>{{description}}</td>
        <td>{{quantity}} {{unit}}</td>
        <td>{{formatMoney unitPrice}}</td>
        <td>{{formatMoney lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Subtotal</td><td>{{formatMoney totals.subtotal}}</td></tr>
      <tr><td>Tax</td><td>{{formatMoney totals.taxTotal}}</td></tr>
      <tr class="big-total"><td>Total</td><td>{{formatMoney totals.total}}</td></tr>
    </table>
  </div>
</body>
</html>`;
