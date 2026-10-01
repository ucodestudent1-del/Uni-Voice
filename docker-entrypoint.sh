#!/bin/sh
set -e

echo "Starting Universal Invoice Generator..."

cd /app

# Run database migrations on startup (non-fatal if DB not yet ready)
echo "Running database migrations..."
node dist/db/migrate.js || echo "Migrations skipped or already applied"

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
  if curl -s http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
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

# Start nginx
echo "Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

# If either process dies, exit
wait -n $BACKEND_PID $NGINX_PID

# If we get here, a process died — clean up
kill $BACKEND_PID 2>/dev/null || true
kill $NGINX_PID 2>/dev/null || true
exit 1
