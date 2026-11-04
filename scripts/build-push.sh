#!/usr/bin/env bash
set -euo pipefail

# Usage: DOCKERHUB_USER=yourname bash scripts/build-push.sh v1
#        DOCKERHUB_USER=yourname bash scripts/build-push.sh v2
VERSION="${1:-}"
if [[ "$VERSION" != "v1" && "$VERSION" != "v2" ]]; then
  echo 'Usage: DOCKERHUB_USER=yourname bash scripts/build-push.sh v1|v2'
  exit 1
fi
if [[ -z "${DOCKERHUB_USER:-}" ]]; then
  echo 'Missing DOCKERHUB_USER. Example: DOCKERHUB_USER=alice bash scripts/build-push.sh v1'
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker Desktop on Mac M2 supports emulated amd64 builds and native arm64 builds.
# Cloud VM nodes commonly use amd64; multi-arch images work on both architectures.
for COMPONENT in backend frontend; do
  IMAGE="${DOCKERHUB_USER}/davs-${COMPONENT}:${VERSION}"
  echo "Building and pushing ${IMAGE} (linux/amd64 + linux/arm64)"
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg APP_VERSION="$VERSION" \
    -t "$IMAGE" \
    --push \
    "$PROJECT_DIR/$COMPONENT"
done

echo "Published:"
echo "${DOCKERHUB_USER}/davs-frontend:${VERSION}"
echo "${DOCKERHUB_USER}/davs-backend:${VERSION}"
