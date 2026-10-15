export const quoteEmailTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { padding: 32px; background: #4f46e5; color: white; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .content h2 { margin-top: 0; font-size: 20px; color: #1e293b; }
    .quote-info { background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .quote-info table { width: 100%; border-collapse: collapse; }
    .quote-info td { padding: 4px 8px; }
    .quote-info td:first-child { font-weight: 600; color: #64748b; }
    .message { line-height: 1.6; margin: 20px 0; white-space: pre-wrap; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; font-size: 12px; color: #94a3b8; }
    .btn { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quote from {{businessName}}</h1>
    </div>
    <div class="content">
      <h2>Hi {{#if customer}}{{customer.name}}{{else}}there{{/if}},</h2>

      <div class="quote-info">
        <table>
          <tr>
            <td>Quote #</td>
            <td>{{quote.quote_number}}</td>
          </tr>
          {{#if quote.total}}
          <tr>
            <td>Total</td>
            <td>{{quote.currency}} {{#each ../../formatMoney as |fm|}}{{fm quote.total}}{{/each}}</td>
          </tr>
          {{/if}}
        </table>
      </div>

      {{#if customMessage}}
      <div class="message">{{customMessage}}</div>
      {{/if}}

      <p style="text-align: center; margin-top: 32px;">
        <a href="{{{appBaseUrl}}}/quotes/{{quote.id}}" class="btn">View Quote</a>
      </p>
    </div>
    <div class="footer">
      <p>{{businessName}}</p>
      {{#if business.email}}
      <p>{{business.email}}</p>
      {{/if}}
    </div>
  </div>
</body>
</html>`;
