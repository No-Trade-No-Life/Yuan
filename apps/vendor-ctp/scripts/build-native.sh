#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CTP_DIR="${PROJECT_DIR}/ctp"

# Build native binaries for all environments inside the build-env container.
docker run --rm \
  -v "${CTP_DIR}":/app \
  -w /app \
  --user "$(id -u):$(id -g)" \
  build-env \
  /bin/bash /app/scripts/build-variants.sh
