#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CTP_DIR="${PROJECT_DIR}/ctp"
KERNEL_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"

if [[ "${KERNEL_NAME}" != "linux" ]]; then
  echo "Skipping native CTP build: requires linux, current platform is ${KERNEL_NAME}."
  exit 0
fi

docker buildx build \
  --target build_env \
  -t build-env \
  -f "${PROJECT_DIR}/build/Dockerfile" \
  "${PROJECT_DIR}" \
  2>/dev/null

docker run --rm \
  -v "${CTP_DIR}":/app \
  -w /app \
  --user "$(id -u):$(id -g)" \
  build-env \
  /bin/bash /app/scripts/build-variants.sh
