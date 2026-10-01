# Multi-stage Dockerfile
# Builds both the backend and frontend, serves via nginx with SPA fallback

# ————————————————————————————————————————
# Stage 1: Backend dependencies
# —————————————————————————……………………
FROM node:20-alpine AS backend-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# —————————————————————————……………………
# Stage 2: Backend build
# —————————…………………………………………
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY --from=backend-deps /app/node_modules/ ./node_modules/
COPY package*.json ./
COPY tsconfig.json tsconfig.typecheck.json ./
COPY src/ ./src/

# Build backend TypeScript → dist/
RUN npx tsc -p tsconfig.json && node scripts/copy-migrations.js

# —————————————————…………………………
# Stage 3: Frontend build
# —………………………………………………
FROM node:20-alpine AS frontend-builder

WORKDIR /app/webapp

COPY webapp/package*.json ./
RUN npm ci

COPY webapp/ ./

RUN npm run build

# —————————………………………………………………
# Stage 4: Runtime — Node backend only
# —……………………………………………………
FROM node:20-alpine AS backend

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S -G nodejs -h /home/nodejs nodejs

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=backend-builder --chown=nodejs:nodejs /app/dist/ ./dist/
# Migrations are already in dist/db/migrations/ from the build step

# Copy entrypoint
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nodejs

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]

# —————————………………………………………………
# Stage 5: Production image — nginx + backend
# —……………………………………………………
FROM nginx:stable-alpine AS production

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy frontend build
COPY --from=frontend-builder /app/webapp/dist/ /app/webapp/dist/

# Copy backend
COPY --from=backend /app/ /app/

# Create non-root user for nginx
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /app/webapp/dist && \
    chown -R appuser:appgroup /app && \
    chmod +x /app/docker-entrypoint.sh

# Start both nginx and the backend
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]
