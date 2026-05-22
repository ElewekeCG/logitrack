#!/bin/bash
set -e

SERVICE=$1
PORT=$2

echo "⏪ Rolling back $SERVICE to :stable"
docker pull $DOCKER_USERNAME/$SERVICE:stable

docker stop $SERVICE || true
docker rm   $SERVICE || true
docker run -d \
  --name $SERVICE \
  --restart unless-stopped \
  -p $PORT:$PORT \
  -e NODE_ENV=production \
  $DOCKER_USERNAME/$SERVICE:stable

echo "✅ Rollback of $SERVICE complete"