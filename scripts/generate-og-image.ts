import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const PUBLIC_DIR = resolve("webapp/public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");

mkdirSync(ICONS_DIR, { recursive: true });

const svg = readFileSync(resolve(PUBLIC_DIR, "favicon.svg"), "utf-8");

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${svg.replace(/<svg[^>]*>|<\/svg>/g, "")}</svg>`;

for (const size of sizes) {
  const png = await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(resolve(ICONS_DIR, `icon-${size}x${size}.png`), png);
}

// Also generate og-image.png
const ogSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="120" y="120" width="180" height="180" rx="24" fill="#2563eb"/>
  <path d="M160 200h100M160 260h60M160 320 h30" stroke="white" stroke-width="8" stroke-linecap="round"/>
  <text x="340" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="white">InvoiceFlow</text>
  <text x="340" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#94a3b8">Professional Invoice Generator</text>
  <text x="340" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#94a3b8">Create, send, and track invoices in seconds. Free plan available.</text>
  <text x="340" y="380" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#60a5fb">invoiceflow.app</text>
</svg>
`);

writeFileSync(resolve(PUBLIC_DIR, "og-image.png"), await sharp(ogSvg).png().toBuffer());
console.log("Generated og-image.png (1200x630) and PWA icons");
