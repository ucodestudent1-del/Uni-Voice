#!/bin/sh
set -e

echo "Starting Universal Invoice Generator..."

cd /app

# Run database migrations on startup with retry (handles DB not being ready yet)
echo "Running database migrations..."
MIGRATE_ATTEMPT=0
MIGRATE_MAX_ATTEMPTS=30
until node dist/db/migrate.js 2>/dev/null; do
  MIGRATE_ATTEMPT=$((MIGRATE_ATTEMPT + 1))
  if [ $MIGRATE_ATTEMPT -ge $MIGRATE_MAX_ATTEMPTS ]; then
    echo "ERROR: Database migrations failed after ${MIGRATE_MAX_ATTEMPTS} attempts."
    exit 1
  fi
  echo "Migrations failed (attempt $MIGRATE_ATTEMPT/$MIGRATE_MAX_ATTEMPTS), retrying in 2s..."
  sleep 2
done
echo "Migrations completed successfully."

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
    echo "Backend process exited unexpectedly."
    exit 1
  fi
  if curl -sf http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "Backend is ready."
    BACKEND_READY=true
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ "$BACKEND_READY" = false ]; then
  echo "ERROR: Backend did not become ready within ${MAX_WAIT} seconds."
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Start nginx (foreground mode, daemon off)
echo "Starting nginx..."
nginx -c /app/nginx.conf -g "daemon off;" &
NGINX_PID=$!

# Clean up on exit — ensure both processes are terminated
cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $NGINX_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  wait $NGINX_PID 2>/dev/null || true
  exit 1
}

trap cleanup INT TERM

# If either process dies, clean up and exit so the container restarts
wait $BACKEND_PID
cleanup

