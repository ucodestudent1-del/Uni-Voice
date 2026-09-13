FROM node:22-bookworm-slim

WORKDIR /app

# Install system dependencies FIRST (needed by Puppeteer/chrome at runtime and during build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    fonts-liberation \
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
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies (skip Puppeteer browser download during npm install to prevent build failures)
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install
ENV PUPPETEER_SKIP_DOWNLOAD=false

# Download Chrome separately for Puppeteer (works reliably in Docker build environment)
RUN npx puppeteer browsers install chrome

# Install frontend dependencies
COPY webapp/package*.json webapp/
RUN cd webapp && npm install

# Copy source and build (npm run build already includes the webapp build step)
COPY . .
RUN npm run build

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

EXPOSE 4000

CMD ["node", "dist/index.js"]
