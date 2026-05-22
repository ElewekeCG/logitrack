#!/bin/bash
set -e

SERVICE=$1

# Retag the currently running image as :stable on Docker Hub
CURRENT=$(docker inspect $SERVICE \
  --format='{{index .Config.Image}}' 2>/dev/null || echo "none")

if [ "$CURRENT" = "none" ] || [ -z "$CURRENT" ]; then
  echo "No running container found for $SERVICE, skipping stable tag"
  exit 0
fi

echo "Tagging $CURRENT as stable for $SERVICE"
docker tag $CURRENT $DOCKER_USERNAME/$SERVICE:stable
docker push $DOCKER_USERNAME/$SERVICE:stable

echo "Stable tag updated for $SERVICE"