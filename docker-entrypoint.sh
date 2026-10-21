#!/bin/sh
set -e

echo "Starting Universal Invoice Generator..."

cd /app

export NGINX_BACKEND_PORT=${PORT:-4000}

BACKEND_PID=""
NGINX_PID=""
EXIT_CODE=0

# Clean up on exit — ensure both processes are terminated
cleanup() {
  echo "Shutting down..."
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_PID" ]; then kill "$NGINX_PID" 2>/dev/null || true; fi
  if [ -n "$BACKEND_PID" ]; then wait "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_PID" ]; then wait "$NGINX_PID" 2>/dev/null || true; fi
  exit "$EXIT_CODE"
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

# Generate nginx config from template using envsubst
echo "Generating nginx configuration..."
envsubst '${NGINX_BACKEND_PORT}' < /app/nginx.conf.template > /tmp/nginx.conf
cp /tmp/nginx.conf /app/nginx.conf

# Start the backend API server
echo "Starting backend API server..."
node dist/index.js &
BACKEND_PID=$!

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
    cleanup
  fi
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "ERROR: Nginx process died."
    EXIT_CODE=1
    cleanup
  fi
  sleep 2
done
