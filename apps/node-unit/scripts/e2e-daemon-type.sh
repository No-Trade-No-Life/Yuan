#!/usr/bin/env bash
set -euo pipefail

# Check for Docker availability
if ! command -v docker &>/dev/null || ! docker info &>/dev/null; then
	echo "[e2e] ❌ Docker is not available. Please ensure Docker is running."
	echo "[e2e] This test requires Docker to start a TimescaleDB container."
	exit 1
fi

NODE_UNIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "${NODE_UNIT_DIR}/../.." && pwd)"
WORK_DIR="${REPO_DIR}/.tmp/node-unit-daemon-e2e"
CONTAINER_NAME="yuan-postgres-daemon-e2e"
POSTGRES_URI="postgres://postgres:postgres@localhost:5432/yuan"
HOST_URL="ws://localhost:8888"
TIMESCALE_IMAGE="${TIMESCALE_IMAGE:-timescale/timescaledb:latest-pg17}"
DEPLOYMENT_PACKAGE_NAME="${DEPLOYMENT_PACKAGE_NAME:-@yuants/app-http-proxy}"
DEPLOYMENT_PACKAGE_VERSION="${DEPLOYMENT_PACKAGE_VERSION:-latest}"
DAEMON_TYPE="${DAEMON_TYPE:-daemon}"
DEPLOYMENT_COMMAND="${DEPLOYMENT_COMMAND:-}"
DEPLOYMENT_ARGS_JSON="${DEPLOYMENT_ARGS_JSON:-[]}"
DEPLOYMENT_SELECTOR="${DEPLOYMENT_SELECTOR:-}"
NODE_UNIT_ASSIGNMENT_FEATURE_FLAG="${NODE_UNIT_ASSIGNMENT_FEATURE_FLAG:-false}"
NODE_UNIT_ASSIGNMENT_GENERATION="${NODE_UNIT_ASSIGNMENT_GENERATION:-0}"
ENABLE_CUSTOM_COMMAND="${ENABLE_CUSTOM_COMMAND:-false}"
EXPECT_ASSIGNMENT_HEARTBEAT="${EXPECT_ASSIGNMENT_HEARTBEAT:-false}"
POSTGRES_READY_RETRIES="${POSTGRES_READY_RETRIES:-60}"

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

run_psql() {
	docker exec -i "${CONTAINER_NAME}" psql -U postgres -d yuan "$@"
}

trap cleanup EXIT

mkdir -p "${WORK_DIR}"

echo "[e2e] Starting TimescaleDB container..."
echo "[e2e] Using image: ${TIMESCALE_IMAGE}"
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d --name "${CONTAINER_NAME}" \
	-e POSTGRES_PASSWORD=postgres \
	-e POSTGRES_DB=yuan \
	-p 5432:5432 \
	"${TIMESCALE_IMAGE}" >/dev/null

for _ in $(seq 1 "${POSTGRES_READY_RETRIES}"); do
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
	node "${REPO_DIR}/apps/host/lib/cli.js" >"${WORK_DIR}/host.log" 2>&1 &
HOST_PID=$!

sleep 2

echo "[e2e] Starting postgres-storage..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" POSTGRES_URI="${POSTGRES_URI}" TERMINAL_ID="postgres-storage" \
	node "${REPO_DIR}/apps/postgres-storage/lib/cli.js" >"${WORK_DIR}/postgres-storage.log" 2>&1 &
PG_STORAGE_PID=$!

sleep 2

echo "[e2e] Running SQL migrations..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" TERMINAL_ID="sql-migration" \
	node "${REPO_DIR}/tools/sql-migration/lib/cli.js"

sleep 2

echo "[e2e] Starting node-unit instances..."
env -i PATH="$PATH" HOST_URL="${HOST_URL}" NODE_UNIT_NAME="node-unit-1" NODE_UNIT_PASSWORD="node-unit-1" POSTGRES_URI="" \
	NODE_UNIT_ASSIGNMENT_FEATURE_FLAG="${NODE_UNIT_ASSIGNMENT_FEATURE_FLAG}" NODE_UNIT_ASSIGNMENT_GENERATION="${NODE_UNIT_ASSIGNMENT_GENERATION}" \
	ENABLE_CUSTOM_COMMAND="${ENABLE_CUSTOM_COMMAND}" \
	node "${NODE_UNIT_DIR}/lib/cli.js" >"${WORK_DIR}/node-unit-1.log" 2>&1 &
NODE_UNIT_1_PID=$!

env -i PATH="$PATH" HOST_URL="${HOST_URL}" NODE_UNIT_NAME="node-unit-2" NODE_UNIT_PASSWORD="node-unit-2" POSTGRES_URI="" \
	NODE_UNIT_ASSIGNMENT_FEATURE_FLAG="${NODE_UNIT_ASSIGNMENT_FEATURE_FLAG}" NODE_UNIT_ASSIGNMENT_GENERATION="${NODE_UNIT_ASSIGNMENT_GENERATION}" \
	ENABLE_CUSTOM_COMMAND="${ENABLE_CUSTOM_COMMAND}" \
	node "${NODE_UNIT_DIR}/lib/cli.js" >"${WORK_DIR}/node-unit-2.log" 2>&1 &
NODE_UNIT_2_PID=$!

echo "[e2e] Waiting for node-units to register..."
sleep 6

echo "[e2e] Inserting daemon deployment for ${DEPLOYMENT_PACKAGE_NAME}@${DEPLOYMENT_PACKAGE_VERSION} (type=${DAEMON_TYPE})..."
run_psql -c \
	"insert into deployment (package_name, package_version, command, args, enabled, type, selector) values ('${DEPLOYMENT_PACKAGE_NAME}', '${DEPLOYMENT_PACKAGE_VERSION}', '${DEPLOYMENT_COMMAND}', '${DEPLOYMENT_ARGS_JSON}'::jsonb, true, '${DAEMON_TYPE}', '${DEPLOYMENT_SELECTOR}');"

echo "[e2e] Deployment inserted. Waiting for daemon startup..."
sleep 10

echo "[e2e] Checking daemon deployment status..."
run_psql -c \
	"select id, package_name, package_version, type, address, enabled from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}';"

if [[ "${NODE_UNIT_ASSIGNMENT_FEATURE_FLAG}" == "true" ]]; then
	echo ""
	echo "[e2e] === Checking deployment assignments ==="
	run_psql -c \
		"select assignment_id, deployment_id, node_id, state, lease_holder, heartbeat_at is not null as has_heartbeat, exit_reason from deployment_assignment where deployment_id in (select id from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}') order by assignment_id;"
fi

echo ""
echo "[e2e] === Node Unit 1 Logs (looking for daemon startup) ==="
grep -E "(DeploymentStart|DeploymentAddChildKey|Daemon|app-http-proxy)" "${WORK_DIR}/node-unit-1.log" | tail -20 || echo "[e2e] No matching logs found in node-unit-1"

echo ""
echo "[e2e] === Node Unit 2 Logs (looking for daemon startup) ==="
grep -E "(DeploymentStart|DeploymentAddChildKey|Daemon|app-http-proxy)" "${WORK_DIR}/node-unit-2.log" | tail -20 || echo "[e2e] No matching logs found in node-unit-2"

echo ""
echo "[e2e] === Checking for running http-proxy processes ==="
if pgrep -f "app-http-proxy" >/dev/null 2>&1; then
	echo "[e2e] Found running http-proxy processes:"
	pgrep -af "app-http-proxy" || true
else
	echo "[e2e] WARNING: No http-proxy processes found"
fi

echo ""
echo "[e2e] === Verifying both node-units have spawned the daemon ==="
NODE_UNIT_1_DAEMON=$(grep -c "DeploymentStart.*app-http-proxy\|DeploymentAddChildKey.*app-http-proxy" "${WORK_DIR}/node-unit-1.log" 2>/dev/null || echo "0")
NODE_UNIT_2_DAEMON=$(grep -c "DeploymentStart.*app-http-proxy\|DeploymentAddChildKey.*app-http-proxy" "${WORK_DIR}/node-unit-2.log" 2>/dev/null || echo "0")

# Clean up any whitespace/newlines
NODE_UNIT_1_DAEMON=$(echo "${NODE_UNIT_1_DAEMON}" | tr -dc '0-9')
NODE_UNIT_2_DAEMON=$(echo "${NODE_UNIT_2_DAEMON}" | tr -dc '0-9')

echo "[e2e] Node Unit 1 daemon spawn count: ${NODE_UNIT_1_DAEMON}"
echo "[e2e] Node Unit 2 daemon spawn count: ${NODE_UNIT_2_DAEMON}"

if [[ "${NODE_UNIT_1_DAEMON}" -gt "0" ]] && [[ "${NODE_UNIT_2_DAEMON}" -gt "0" ]]; then
	if [[ "${NODE_UNIT_ASSIGNMENT_FEATURE_FLAG}" == "true" ]]; then
		ASSIGNMENT_COUNT=$(run_psql -t -A -c "select count(*) from deployment_assignment where deployment_id in (select id from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}');" | tr -dc '0-9')
		echo "[e2e] Assignment row count: ${ASSIGNMENT_COUNT}"
		if [[ -z "${ASSIGNMENT_COUNT}" || "${ASSIGNMENT_COUNT}" -lt "2" ]]; then
			echo "[e2e] ❌ FAILURE: Expected at least 2 assignment rows in assignment mode"
			exit 1
		fi

		if [[ "${EXPECT_ASSIGNMENT_HEARTBEAT}" == "true" ]]; then
			HEARTBEAT_COUNT=$(run_psql -t -A -c "select count(*) from deployment_assignment where deployment_id in (select id from deployment where package_name = '${DEPLOYMENT_PACKAGE_NAME}') and heartbeat_at is not null;" | tr -dc '0-9')
			echo "[e2e] Assignment heartbeat count: ${HEARTBEAT_COUNT}"
			if [[ -z "${HEARTBEAT_COUNT}" || "${HEARTBEAT_COUNT}" -lt "2" ]]; then
				echo "[e2e] ❌ FAILURE: Expected assignment heartbeats from both node-units"
				exit 1
			fi
		fi
	fi

	echo ""
	echo "[e2e] ✅ SUCCESS: Both node-units have spawned the daemon!"
	exit 0
else
	echo ""
	echo "[e2e] ❌ FAILURE: Not all node-units spawned the daemon"
	echo "[e2e] Node Unit 1: ${NODE_UNIT_1_DAEMON} daemon spawns"
	echo "[e2e] Node Unit 2: ${NODE_UNIT_2_DAEMON} daemon spawns"
	exit 1
fi
