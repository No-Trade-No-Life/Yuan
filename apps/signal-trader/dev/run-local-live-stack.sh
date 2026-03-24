#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(dirname "$SCRIPT_DIR")
REPO_ROOT=$(dirname "$(dirname "$APP_DIR")")
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.live-okx.yml"
STATE_ROOT="${TMPDIR:-/tmp}/yuants-signal-trader-live-stack"
LOG_DIR="$STATE_ROOT/logs"

HOST_PORT="${HOST_PORT:-8888}"
POSTGRES_PORT="${POSTGRES_PORT:-54329}"
POSTGRES_DB="${POSTGRES_DB:-yuan}"
POSTGRES_USER="${POSTGRES_USER:-yuants}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-yuants}"
POSTGRES_URI="${POSTGRES_URI:-postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}}"
AUTO_UPSERT_RUNTIME="${AUTO_UPSERT_RUNTIME:-0}"
HOST_WS_DISPLAY="ws://127.0.0.1:${HOST_PORT}"

mkdir -p "$LOG_DIR"

encode_uri_component() {
	node -e "process.stdout.write(encodeURIComponent(process.argv[1] || ''))" "$1"
}

if [[ -n "${HOST_TOKEN:-}" ]]; then
	HOST_TOKEN_ENCODED=$(encode_uri_component "$HOST_TOKEN")
	HOST_URL="ws://127.0.0.1:${HOST_PORT}?host_token=${HOST_TOKEN_ENCODED}"
	WS_HOST_URL_DOCKER="ws://host:${HOST_PORT}?host_token=${HOST_TOKEN_ENCODED}"
else
	HOST_URL="ws://127.0.0.1:${HOST_PORT}"
	WS_HOST_URL_DOCKER='ws://host:8888'
	if [[ "$HOST_PORT" != '8888' ]]; then
		WS_HOST_URL_DOCKER="ws://host:${HOST_PORT}"
	fi
fi

export WS_HOST_URL_DOCKER

docker_compose() {
	if command -v docker-compose >/dev/null 2>&1; then
		docker-compose -f "$COMPOSE_FILE" "$@"
	else
		docker compose -f "$COMPOSE_FILE" "$@"
	fi
}

wait_for_tcp() {
	local host="$1"
	local port="$2"
	local name="$3"
	for _ in $(seq 1 60); do
		if node -e "const net=require('net');const socket=net.connect({host:process.argv[1],port:Number(process.argv[2])},()=>{socket.end();process.exit(0)});socket.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),500);" "$host" "$port"; then
			return 0
		fi
		sleep 1
	done
	echo "等待 ${name} 就绪超时 (${host}:${port})" >&2
	return 1
}

wait_for_postgres() {
	for _ in $(seq 1 60); do
		if docker_compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
			return 0
		fi
		sleep 1
	done
	echo '等待 postgres healthcheck 超时' >&2
	return 1
}

request_service() {
	local method="$1"
	local request_json="$2"
	local body
	body=$(node -e "const [method, req]=process.argv.slice(1); process.stdout.write(JSON.stringify({ method, req: JSON.parse(req) }));" "$method" "$request_json")
	if [[ -n "${HOST_TOKEN:-}" ]]; then
		curl -fsS -N -X POST "http://127.0.0.1:${HOST_PORT}/request" -H 'Content-Type: application/json' -H "host_token: ${HOST_TOKEN}" --data "$body"
	else
		curl -fsS -N -X POST "http://127.0.0.1:${HOST_PORT}/request" -H 'Content-Type: application/json' --data "$body"
	fi
}

wait_for_signal_trader_service() {
	for _ in $(seq 1 60); do
		if response=$(request_service 'SignalTrader/ListRuntimeConfig' '{}' 2>/dev/null); then
			if printf '%s' "$response" | node -e "const fs=require('fs');const raw=fs.readFileSync(0,'utf8').trim();if(!raw)process.exit(1);const last=JSON.parse(raw.split(/\n+/).filter(Boolean).pop());process.exit(last?.res?.code===0?0:1);"; then
				return 0
			fi
		fi
		sleep 1
	done
	echo '等待 SignalTrader 服务注册超时' >&2
	return 1
}

run_migrations() {
	local log_file="$LOG_DIR/sql-migration-live.log"
	for _ in $(seq 1 20); do
		if env \
			HOST_URL="$HOST_URL" \
			TERMINAL_ID='signal-trader-live-sql-migration' \
			SQL_DIR="$REPO_ROOT/tools/sql-migration/sql" \
			node "$REPO_ROOT/tools/sql-migration/lib/cli.js" >>"$log_file" 2>&1; then
			return 0
		fi
		sleep 1
	done
	echo "SQL migration 执行失败，日志见 $log_file" >&2
	return 1
}

build_targets() {
	if [[ "${SKIP_BUILD:-0}" == '1' ]]; then
		return 0
	fi
	node "$REPO_ROOT/common/scripts/install-run-rush.js" build \
		-t @yuants/app-host \
		-t @yuants/app-postgres-storage \
		-t @yuants/app-virtual-exchange \
		-t @yuants/app-signal-trader \
		-t @yuants/vendor-okx \
		-t @yuants/tool-sql-migration
}

wait_for_vex_service() {
	for _ in $(seq 1 60); do
		if response=$(request_service 'VEX/ListCredentials' '{}' 2>/dev/null); then
			if printf '%s' "$response" | node -e "const fs=require('fs');const raw=fs.readFileSync(0,'utf8').trim();if(!raw)process.exit(1);const last=JSON.parse(raw.split(/\n+/).filter(Boolean).pop());process.exit(last?.res?.code===0?0:1);"; then
				return 0
			fi
		fi
		sleep 1
	done
	echo '等待 VEX 服务注册超时' >&2
	return 1
}

register_vex_credential() {
	local log_file="$LOG_DIR/vex-register-credential.log"
	env \
		HOST_URL="$HOST_URL" \
		TERMINAL_ID='signal-trader-live-vex-register' \
		node "$SCRIPT_DIR/register-vex-credential.js" >>"$log_file" 2>&1
}

seed_runtime_if_configured() {
	if [[ "$AUTO_UPSERT_RUNTIME" != '1' ]]; then
		echo 'AUTO_UPSERT_RUNTIME=0，跳过 live runtime 自动写入'
		return 0
	fi
	if [[ -z "${SIGNAL_TRADER_PRODUCT_ID:-}" ]]; then
		echo '未设置 SIGNAL_TRADER_PRODUCT_ID，跳过 live runtime 自动写入'
		return 0
	fi
	env \
		HOST_URL="$HOST_URL" \
		TERMINAL_ID='signal-trader-live-runtime-seed' \
		node "$SCRIPT_DIR/seed-live-runtime.js"
}

start_stack() {
	if [[ -z "${HOST_TOKEN:-}" ]]; then
		echo 'HOST_TOKEN 未设置；本地 live profile 要求 Host token 作为最小控制面保护。' >&2
		return 1
	fi

	trap 'echo "启动失败，执行清理" >&2; stop_stack >/dev/null 2>&1 || true' ERR

	build_targets
	docker_compose up -d postgres host postgres-storage okx-vex-exchange virtual-exchange
	wait_for_postgres
	wait_for_tcp 127.0.0.1 "$HOST_PORT" 'app-host'
	run_migrations
	wait_for_vex_service
	register_vex_credential
	docker_compose up -d signal-trader
	wait_for_signal_trader_service
	seed_runtime_if_configured

	trap - ERR
	cat <<EOF
local live stack 已启动
- Host HTTP: http://127.0.0.1:${HOST_PORT}
- Host WS: ${HOST_WS_DISPLAY}
- Postgres: ${POSTGRES_URI}
- SQL order history: 需由 VEX/叶子节点或外部基础设施维护到表 "order"
- 当前 compose 故意不内置 writer；若缺少终态证据，runtime 会 fail-close 到 audit_only
- VEX credential register log: ${LOG_DIR}/vex-register-credential.log
- docker compose: ${COMPOSE_FILE}
- signal-trader logs: docker compose -f ${COMPOSE_FILE} logs -f signal-trader
- 前端：请继续本地启动 ui/web，并连接到上述 Host WS；若使用 token，请在 GUI 里单独填写 HOST_TOKEN
EOF
}

stop_stack() {
	docker_compose down >/dev/null 2>&1 || true
	echo 'local live stack 已停止'
}

status_stack() {
	docker_compose ps
}

case "${1:-start}" in
start)
	start_stack
	;;
stop)
	stop_stack
	;;
restart)
	stop_stack
	start_stack
	;;
status)
	status_stack
	;;
*)
	echo '用法: run-local-live-stack.sh [start|stop|restart|status]' >&2
	exit 1
	;;
esac
