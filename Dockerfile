# Multi-stage Dockerfile
# Builds both the backend and frontend
# Express serves the frontend SPA and API on port 4000

# —………………………………
# Stage 1: Install dependencies + system libs
# —………………………………
FROM node:22-bookworm-slim AS deps

# Install system dependencies FIRST (needed by Puppeteer/chrome at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    fonts-liberation \
    unzip \
    libasound2 \
    libatk1.0-0 \
    libatomic1 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies (skip Puppeteer browser download during npm install)
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci
ENV PUPPETEER_SKIP_DOWNLOAD=false

# Download Chrome separately for Puppeteer
RUN npx puppeteer browsers install chrome

# —………………………………
# Stage 2: Backend build
# —………………………………
FROM node:22-bookworm-slim AS backend-builder

WORKDIR /app

COPY --from=deps /app/node_modules/ ./node_modules/
COPY --from=deps /root/.cache/ /root/.cache/
COPY package*.json ./
COPY tsconfig.json tsconfig.typecheck.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build backend TypeScript → dist/
RUN npx tsc -p tsconfig.json && node scripts/copy-migrations.js

# —………………………………
# Stage 3: Frontend build
# —………………………………
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/webapp

COPY webapp/package*.json ./
RUN npm ci

COPY webapp/ ./

RUN npm run build

# —………………………………
# Stage 4: Production image
# —………………………………
FROM node:22-bookworm-slim AS production

# Copy system libraries needed at runtime (Chrome/Puppeteer)
# Reinstall the specific libs needed at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend compiled output
COPY --from=backend-builder /app/dist/ /app/dist/
COPY --from=backend-builder /app/node_modules/ /app/node_modules/
COPY --from=backend-builder /root/.cache/ /root/.cache/

# Copy frontend build
COPY --from=frontend-builder /app/webapp/dist/ /app/webapp/dist/

# Copy migrations
COPY --from=backend-builder /app/dist/db/migrations/ /app/dist/db/migrations/

WORKDIR /app

# Production environment variables
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=4000
ENV APP_PUBLIC_BASE_URL=https://uni-voice-production.up.railway.app
ENV EMAIL_FROM=noreply@example.com
ENV EMAIL_PROVIDER=stub
ENV PDF_PROVIDER=html
ENV PAYMENT_PROVIDER=stub
ENV TAX_PROVIDER=manual
ENV AI_PROVIDER=stub
ENV AUTH_MODE=dev
ENV AUTH_JWT_SECRET=dev-secret-change-me
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invoice_dev

EXPOSE 4000

CMD ["node", "dist/index.js"]
