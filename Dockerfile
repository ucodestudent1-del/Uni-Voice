FROM node:22-alpine AS base
WORKDIR /app

# --- Dependencies layer (production only) -------------------------------------
FROM base AS deps
# Install build tools for native modules (argon2, bcrypt) and puppeteer deps
RUN apk add --no-cache python3 make g++ cairo jpeg pango musl-dev
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
# Install puppeteer's browser (Chromium) for PDF generation
RUN npx puppeteer browsers install --browser=chromium 2>/dev/null || true

# --- Backend build layer -----------------------------------------------------
# Force fresh build to pick up migration fixes (cache invalidation)
# Docker layer cache fix for migration SQL syntax (075, 076, 061)
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
WORKDIR /app/webapp
COPY webapp/package.json webapp/package-lock.json* ./
RUN npm ci
COPY webapp/ /app/webapp/
# Build the frontend (tsc type-checks then vite builds)
RUN npm run build

# --- Runtime image -----------------------------------------------------------
FROM base AS runtime
WORKDIR /app

# Install nginx (for serving frontend + reverse proxy to API)
# and system dependencies for puppeteer/chromium at runtime
# Install nginx and system dependencies
RUN apk add --no-cache \
    nginx \
    curl \
    gettext \
    cairo jpeg pango \
    nss freetype harfbuzz fribidi woff2 ttf-freefont \
    netcat-openbsd \
    redis

# Copy production dependencies (native modules already compiled in deps layer)
COPY --from=deps /app/node_modules ./node_modules
# Copy backend build output
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package.json ./package.json
# Copy backend migrations
COPY --from=backend-builder /app/scripts ./scripts
# Copy frontend build output
COPY --from=frontend-builder /app/webapp/dist ./webapp/dist

# Copy nginx config template and entrypoint script
COPY nginx.conf.template /app/nginx.conf.template
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create non-root user
RUN addgroup -S invoice && adduser -S -G invoice invoice

# nginx needs to write to log, pid, and temp directories
# Create both /var/lib/nginx/tmp/* (default nginx) and /tmp/nginx-* (custom config paths)
RUN mkdir -p /var/log/nginx /tmp /tmp/nginx-client-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi /var/lib/nginx/tmp /var/lib/nginx/tmp/client_body /var/lib/nginx/tmp/proxy /var/lib/nginx/tmp/fastcgi /var/lib/nginx/tmp/uwsgi /var/lib/nginx/tmp/scgi

# Ensure all files are owned by the invoice user
RUN chown -R invoice:invoice /var/log/nginx /tmp /var/lib/nginx /app

USER invoice

EXPOSE 8080 4000

# Health check — probes through nginx (port 8080) to verify the full stack (nginx + backend) is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1 || node --input-type=module -e "import('http').then(h=>{const p=process.env.PORT||4000;h.get('http://127.0.0.1:'+p+'/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))}).catch(()=>process.exit(1))"

# Use the entrypoint script that starts both nginx and the backend API
ENTRYPOINT ["/app/docker-entrypoint.sh"]
