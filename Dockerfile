FROM node:22-alpine AS base
WORKDIR /app

# --- Dependencies layer (production only) -------------------------------------
FROM base AS deps
# Install build tools for native modules (argon2, bcrypt, puppeteer)
RUN apk add --no-cache python3 make g++ cairo jpeg pango musl-dev
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
# Install puppeteer's browser (Chromium) for PDF generation
RUN npx puppeteer browsers install --browser=chromium 2>/dev/null || true

# --- Backend build layer -----------------------------------------------------
FROM base AS backend-builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json tsconfig.typecheck.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm ci
RUN npx tsc -p tsconfig.json
# Copy migrations next to the compiled db/migrate.js so loadMigrations() finds them
RUN node scripts/copy-migrations.js

# --- Frontend build layer ----------------------------------------------------
FROM base AS frontend-builder
WORKDIR /app
COPY webapp/package.json webapp/package-lock.json* /app/webapp/
WORKDIR /app/webapp
RUN npm ci
COPY webapp/ /app/webapp/
# Build the frontend (tsc type-checks then vite builds)
RUN npm run build

# --- Runtime image -----------------------------------------------------------
FROM base AS runtime
WORKDIR /app

# Install system dependencies needed for puppeteer/chromium at runtime
RUN apk add --no-cache \
    cairo jpeg pango \
    nss freetype harfbuzz fribidi woff2 ttf-freefont \
    nodejs

# Copy production dependencies (native modules already compiled in deps layer)
COPY --from=deps /app/node_modules ./node_modules
# Copy backend build output
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package.json ./package.json
# Copy backend migrations
COPY --from=backend-builder /app/scripts ./scripts
# Copy frontend build output
COPY --from=frontend-builder /app/webapp/dist ./webapp/dist

# Create non-root user
RUN addgroup -S invoice && adduser -S -G invoice invoice
USER invoice

EXPOSE 4000

# Health check — hits the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:4000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
