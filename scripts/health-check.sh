#!/bin/bash
set -e

SERVICE=$1
PORT=$2
URL="http://$DEPLOY_HOST:$PORT/health"
MAX_RETRIES=15
RETRY_INTERVAL=10

echo "Polling $URL ..."
for i in $(seq 1 $MAX_RETRIES); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)
  echo "Attempt $i — HTTP $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "✅ $SERVICE is healthy"
    exit 0
  fi
  sleep $RETRY_INTERVAL
done

echo "❌ $SERVICE health check failed after $MAX_RETRIES attempts"
exit 1