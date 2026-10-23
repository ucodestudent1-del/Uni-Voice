#!/bin/sh
set -e

echo "Starting Universal Invoice Generator..."

cd /app

export NGINX_BACKEND_PORT=${PORT:-4000}

BACKEND_PID=""
NGINX_PID=""
EXIT_CODE=0

# Clean up on exit — ensure both processes are terminated
CLEANING_UP=false

cleanup() {
  if [ "$CLEANING_UP" = true ]; then return; fi
  CLEANING_UP=true
  echo "Shutting down..."
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_PID" ]; then kill "$NGINX_PID" 2>/dev/null || true; fi
  if [ -n "$BACKEND_PID" ]; then wait "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_PID" ]; then wait "$NGINX_PID" 2>/dev/null || true; fi
}

trap cleanup INT TERM EXIT

# Run database migrations on startup with retry (handles DB not being ready yet)
echo "Running database migrations..."
MIGRATE_ATTEMPT=0
MIGRATE_MAX_ATTEMPTS=30
until node dist/db/migrate.js 2>&1; do
  MIGRATE_ATTEMPT=$((MIGRATE_ATTEMPT + 1))
  if [ $MIGRATE_ATTEMPT -ge $MIGRATE_MAX_ATTEMPTS ]; then
    echo "ERROR: Database migrations failed after ${MIGRATE_MAX_ATTEMPTS} attempts."
    EXIT_CODE=1
    exit 1
  fi
  echo "Migrations failed (attempt $MIGRATE_ATTEMPT/$MIGRATE_MAX_ATTEMPTS), retrying in 2s..."
  sleep 2
done
echo "Migrations completed successfully."

# Wait for Redis to be ready (if REDIS_URL is set)
if [ -n "$REDIS_URL" ]; then
  echo "Waiting for Redis to be ready..."
  REDIS_WAIT=0
  REDIS_MAX_WAIT=30
  # Extract host:port from REDIS_URL (handles redis://hostname:port format)
  REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's|redis://||p' | sed 's/:.*//' | sed 's/\/.*//' 2>/dev/null || echo "redis")
  REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's|redis://||p' | sed 's/.*://' | sed 's/\/.*//' | sed 's/[^0-9].*//' 2>/dev/null || echo "")
  REDIS_PORT=${REDIS_PORT:-6379}
  echo "Redis target: ${REDIS_HOST}:${REDIS_PORT}"
  while [ $REDIS_WAIT -lt $REDIS_MAX_WAIT ]; do
    if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null && redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
      echo "Redis is ready."
      break
    fi
    REDIS_WAIT=$((REDIS_WAIT + 1))
    echo "Redis not ready (attempt $REDIS_WAIT/$REDIS_MAX_WAIT), retrying in 1s..."
    sleep 1
  done
  if [ "$REDIS_WAIT" -ge "$REDIS_MAX_WAIT" ]; then
    echo "WARNING: Redis not ready after ${REDIS_MAX_WAIT}s — backend will start but Redis-dependent features may fail."
  fi
fi

# Generate nginx config from template using envsubst
echo "Generating nginx configuration..."
envsubst '${NGINX_BACKEND_PORT}' < /app/nginx.conf.template > /tmp/nginx.conf
cp /tmp/nginx.conf /app/nginx.conf

# Start the backend API server
echo "Starting backend API server..."
node dist/index.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
MAX_WAIT=30
WAITED=0
BACKEND_READY=false
while [ $WAITED -lt $MAX_WAIT ]; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend process exited unexpectedly during startup."
    EXIT_CODE=1
    exit 1
  fi
  HEALTH_PORT=${PORT:-4000}
  if curl -sf "http://127.0.0.1:${HEALTH_PORT}/api/health" >/dev/null 2>&1; then
    echo "Backend is ready."
    BACKEND_READY=true
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ "$BACKEND_READY" = false ]; then
  echo "ERROR: Backend did not become ready within ${MAX_WAIT} seconds."
  EXIT_CODE=1
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Test nginx config before starting
echo "Validating nginx configuration..."
if ! nginx -t -c /app/nginx.conf 2>&1; then
  echo "ERROR: nginx configuration test failed."
  EXIT_CODE=1
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Start nginx (foreground mode, daemon off)
echo "Starting nginx..."
nginx -c /app/nginx.conf -g "daemon off;" &
NGINX_PID=$!

# Wait briefly and verify nginx is running
sleep 1
if ! kill -0 $NGINX_PID 2>/dev/null; then
  echo "ERROR: Nginx failed to start. Check /var/log/nginx/error.log for details."
  cat /var/log/nginx/error.log 2>/dev/null || true
  EXIT_CODE=1
  exit 1
fi
echo "Nginx is running (PID: $NGINX_PID)."

# Monitor both processes; if either dies, shut down and exit so the container restarts
while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend process died."
    EXIT_CODE=1
    exit 1
  fi
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "ERROR: Nginx process died."
    EXIT_CODE=1
    exit 1
  fi
  sleep 2
done
