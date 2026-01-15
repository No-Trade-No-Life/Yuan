#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="${ROOT_DIR}/.tmp/node-unit-e2e"
CONTAINER_NAME="yuan-postgres-e2e"
POSTGRES_URI="postgres://postgres:postgres@localhost:5432/yuan"
HOST_URL="ws://localhost:8888"
DEPLOYMENT_PACKAGE_NAME="${DEPLOYMENT_PACKAGE_NAME:-@yuants/app-portal}"
DEPLOYMENT_PACKAGE_VERSION="${DEPLOYMENT_PACKAGE_VERSION:-0.2.26}"
DEPLOYMENT_COUNT="${DEPLOYMENT_COUNT:-5}"

HOST_PID=""
PG_STORAGE_PID=""
NODE_UNIT_1_PID=""
NODE_UNIT_2_PID=""

cleanup() {
  if [[ -n "${NODE_UNIT_2_PID}" ]] && kill -0 "${NODE_UNIT_2_PID}" 2>/dev/null; then
    kill "${NODE_UNIT_2_PID}" || true
  fi
  if [[ -n "${NODE_UNIT_1_PID}" ]] && kill -0 "${NODE_UNIT_1_PID}" 2>/dev/null; then
    kill "${NODE_UNIT_1_PID}" || true
  fi
  if [[ -n "${PG_STORAGE_PID}" ]] && kill -0 "${PG_STORAGE_PID}" 2>/dev/null; then
    kill "${PG_STORAGE_PID}" || true
  fi
  if [[ -n "${HOST_PID}" ]] && kill -0 "${HOST_PID}" 2>/dev/null; then
    kill "${HOST_PID}" || true
  fi
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

mkdir -p "${WORK_DIR}"

echo "[e2e] Starting TimescaleDB container..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=yuan \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15 >/dev/null

for _ in {1..20}; do
  if docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
  echo "[e2e] TimescaleDB not ready"
  exit 1
fi

echo "[e2e] Starting host..."
env -i PATH="$PATH" PORT=8888 HOST_TOKEN= \
  node "${ROOT_DIR}/apps/host/lib/cli.js" > "${WORK_DIR}/host.log" 2>&1 &
HOST_PID=$!

sleep 2

echo "[e2e] Starting postgres-storage..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" POSTGRES_URI="${POSTGRES_URI}" TERMINAL_ID="postgres-storage" \
  node "${ROOT_DIR}/apps/postgres-storage/lib/cli.js" > "${WORK_DIR}/postgres-storage.log" 2>&1 &
PG_STORAGE_PID=$!

sleep 2

echo "[e2e] Running SQL migrations..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" TERMINAL_ID="sql-migration" \
  node "${ROOT_DIR}/tools/sql-migration/lib/cli.js"

sleep 2

echo "[e2e] Starting node-unit instances..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" NODE_UNIT_NAME="node-unit-1" NODE_UNIT_PASSWORD="node-unit-1" POSTGRES_URI="" \
  node "${ROOT_DIR}/apps/node-unit/lib/cli.js" > "${WORK_DIR}/node-unit-1.log" 2>&1 &
NODE_UNIT_1_PID=$!

env -i PATH="$PATH" HOST_URL="${HOST_URL}" NODE_UNIT_NAME="node-unit-2" NODE_UNIT_PASSWORD="node-unit-2" POSTGRES_URI="" \
  node "${ROOT_DIR}/apps/node-unit/lib/cli.js" > "${WORK_DIR}/node-unit-2.log" 2>&1 &
NODE_UNIT_2_PID=$!

sleep 6

echo "[e2e] Inserting ${DEPLOYMENT_COUNT} deployments for ${DEPLOYMENT_PACKAGE_NAME}@${DEPLOYMENT_PACKAGE_VERSION}..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -c \
  "insert into deployment (package_name, package_version, enabled) select '${DEPLOYMENT_PACKAGE_NAME}', '${DEPLOYMENT_PACKAGE_VERSION}', true from generate_series(1, ${DEPLOYMENT_COUNT});"

sleep 6

echo "[e2e] Deployment addresses after initial claim:"
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -c \
  "select id, address from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}' order by created_at asc;"

echo "[e2e] Deployment address distribution:"
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -c \
  "select address, count(*) from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}' group by address order by count(*) desc;"

sleep 6

echo "[e2e] Deployment address distribution after another cycle:"
docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -c \
  "select address, count(*) from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}' group by address order by count(*) desc;"

for attempt in {1..10}; do
  remaining=$(docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -t -A -c \
    "select count(*) from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}' and address = '';" | tr -d '[:space:]')
  if [[ "${remaining}" == "0" ]]; then
    break
  fi
  echo "[e2e] Waiting for claims, remaining unassigned: ${remaining}"
  sleep 5
  docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan -c \
    "select address, count(*) from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}' group by address order by count(*) desc;"
done

echo "[e2e] Done. Logs in ${WORK_DIR}"
