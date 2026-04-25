#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(dirname "$SCRIPT_DIR")
REPO_ROOT=$(dirname "$(dirname "$APP_DIR")")
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
STATE_ROOT="${TMPDIR:-/tmp}/yuants-signal-trader-mock-stack"
LOG_DIR="$STATE_ROOT/logs"
PID_DIR="$STATE_ROOT/pids"

HOST_PORT="${HOST_PORT:-8888}"
POSTGRES_PORT="${POSTGRES_PORT:-54329}"
POSTGRES_DB="${POSTGRES_DB:-yuan}"
POSTGRES_USER="${POSTGRES_USER:-yuants}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-yuants}"
POSTGRES_URI="${POSTGRES_URI:-postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}}"
HOST_URL="${HOST_URL:-ws://127.0.0.1:${HOST_PORT}}"

HOST_PID_FILE="$PID_DIR/app-host.pid"
PG_STORAGE_PID_FILE="$PID_DIR/app-postgres-storage.pid"
SIGNAL_TRADER_PID_FILE="$PID_DIR/app-signal-trader.pid"

mkdir -p "$LOG_DIR" "$PID_DIR"

docker_compose() {
	if command -v docker-compose >/dev/null 2>&1; then
		docker-compose -f "$COMPOSE_FILE" "$@"
	else
		docker compose -f "$COMPOSE_FILE" "$@"
	fi
}

is_pid_running() {
	local pid="$1"
	kill -0 "$pid" >/dev/null 2>&1
}

stop_pid_file() {
	local pid_file="$1"
	if [[ ! -f "$pid_file" ]]; then
		return 0
	fi
	local pid
	pid=$(tr -d '[:space:]' <"$pid_file")
	if [[ -n "$pid" ]] && is_pid_running "$pid"; then
		kill "$pid" >/dev/null 2>&1 || true
		for _ in $(seq 1 20); do
			if ! is_pid_running "$pid"; then
				break
			fi
			sleep 0.5
		done
		if is_pid_running "$pid"; then
			kill -9 "$pid" >/dev/null 2>&1 || true
		fi
	fi
	rm -f "$pid_file"
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
	local log_file="$LOG_DIR/sql-migration.log"
	for _ in $(seq 1 20); do
		if env \
			HOST_URL="$HOST_URL" \
			TERMINAL_ID='signal-trader-mock-sql-migration' \
			SQL_DIR="$REPO_ROOT/tools/sql-migration/sql" \
			node "$REPO_ROOT/tools/sql-migration/lib/cli.js" >>"$log_file" 2>&1; then
			return 0
		fi
		sleep 1
	done
	echo "SQL migration 执行失败，日志见 $log_file" >&2
	return 1
}

start_process() {
	local pid_file="$1"
	local log_file="$2"
	shift 2
	"$@" >>"$log_file" 2>&1 &
	local pid=$!
	printf '%s\n' "$pid" >"$pid_file"
}

build_targets() {
	if [[ "${SKIP_BUILD:-0}" == '1' ]]; then
		return 0
	fi
	node "$REPO_ROOT/common/scripts/install-run-rush.js" build \
		-t @yuants/app-host \
		-t @yuants/app-postgres-storage \
		-t @yuants/app-signal-trader \
		-t @yuants/tool-sql-migration
}

start_stack() {
	if [[ -f "$SIGNAL_TRADER_PID_FILE" ]] && is_pid_running "$(tr -d '[:space:]' <"$SIGNAL_TRADER_PID_FILE")"; then
		echo 'local mock stack 已在运行，先执行 stop 或使用 restart。' >&2
		return 1
	fi

	trap 'echo "启动失败，执行清理" >&2; stop_stack >/dev/null 2>&1 || true' ERR

	build_targets
	docker_compose up -d postgres
	wait_for_postgres

	start_process \
		"$HOST_PID_FILE" \
		"$LOG_DIR/app-host.log" \
		env PORT="$HOST_PORT" node "$REPO_ROOT/apps/host/lib/cli.js"
	wait_for_tcp 127.0.0.1 "$HOST_PORT" 'app-host'

	start_process \
		"$PG_STORAGE_PID_FILE" \
		"$LOG_DIR/app-postgres-storage.log" \
		env HOST_URL="$HOST_URL" TERMINAL_ID='signal-trader-mock-postgres-storage' POSTGRES_URI="$POSTGRES_URI" node "$REPO_ROOT/apps/postgres-storage/lib/cli.js"
	sleep 2

	run_migrations

	start_process \
		"$SIGNAL_TRADER_PID_FILE" \
		"$LOG_DIR/app-signal-trader.log" \
		env HOST_URL="$HOST_URL" TERMINAL_ID='signal-trader-mock-bootstrap' node "$REPO_ROOT/apps/signal-trader/dev/bootstrap-mock-app.js"
	wait_for_signal_trader_service

	trap - ERR
	cat <<EOF
local mock stack 已启动
- Host: http://127.0.0.1:${HOST_PORT}
- Host WS: ${HOST_URL}
- Postgres: ${POSTGRES_URI}
- 日志目录: ${LOG_DIR}
EOF
}

stop_stack() {
	stop_pid_file "$SIGNAL_TRADER_PID_FILE"
	stop_pid_file "$PG_STORAGE_PID_FILE"
	stop_pid_file "$HOST_PID_FILE"
	docker_compose down >/dev/null 2>&1 || true
	echo 'local mock stack 已停止'
}

status_stack() {
	local name pid_file pid status
	for name in app-host app-postgres-storage app-signal-trader; do
		case "$name" in
		app-host) pid_file="$HOST_PID_FILE" ;;
		app-postgres-storage) pid_file="$PG_STORAGE_PID_FILE" ;;
		app-signal-trader) pid_file="$SIGNAL_TRADER_PID_FILE" ;;
		esac
		if [[ -f "$pid_file" ]]; then
			pid=$(tr -d '[:space:]' <"$pid_file")
			if [[ -n "$pid" ]] && is_pid_running "$pid"; then
				status='running'
			else
				status='stale-pid'
			fi
		else
			pid='-'
			status='stopped'
		fi
		printf '%-24s %-12s %s\n' "$name" "$status" "$pid"
	done
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
	echo '用法: run-local-mock-stack.sh [start|stop|restart|status]' >&2
	exit 1
	;;
esac
