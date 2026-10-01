#!/bin/sh
set -e

echo "Starting Universal Invoice Generator..."

# Run database migrations on startup (non-fatal if DB not yet ready)
echo "Running database migrations..."
cd /app
node dist/db/migrate.js || echo "Migrations skipped or already applied"

# If running as root, drop privileges for the backend
if [ "$(id -u)" = "0" ]; then
  echo "Starting backend API server as non-root user..."
  # Start the backend API server in the background as nodejs user
  su -s /bin/sh -c "node dist/index.js" nodejs &
  BACKEND_PID=$!
  sleep 2

  # Start nginx as nginx user (master process still needs root for binding port 80)
  echo "Starting nginx..."
  nginx -g "daemon off;" &
  NGINX_PID=$!
else
  # Non-root mode — start both directly
  echo "Starting backend API server..."
  node dist/index.js &
  BACKEND_PID=$!
  sleep 2

  echo "Starting nginx on port 8080..."
  nginx -g "daemon off; error_log /dev/stderr;" &
  NGINX_PID=$!
fi

# If either process dies, exit
wait -n $BACKEND_PID $NGINX_PID

# If we get here, a process died — clean up
kill $BACKEND_PID 2>/dev/null || true
kill $NGINX_PID 2>/dev/null || true
exit 1
