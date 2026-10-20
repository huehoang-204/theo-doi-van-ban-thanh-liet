#!/usr/bin/env bash
# PostgreSQL cho DEVELOPMENT chạy bằng user hiện tại (không sudo, không Docker).
#
#   npm run db:local -- init     # initdb + tạo role/DB theo DATABASE_URL
#   npm run db:local -- start | stop | status | psql
#
# Đọc từ .env: DATABASE_URL, DEV_PG_DATA_DIR, DEV_PG_PORT, DEV_PG_BIN_DIR (tuỳ chọn).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "Thiếu $ENV_FILE (sao chép từ .env.example)" >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a

: "${DATABASE_URL:?Đặt DATABASE_URL trong .env}"
: "${DEV_PG_DATA_DIR:?Đặt DEV_PG_DATA_DIR trong .env (thư mục ngoài repo)}"
DEV_PG_PORT="${DEV_PG_PORT:-5452}"
PG_BIN="${DEV_PG_BIN_DIR:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$PG_BIN/initdb" ]] || { echo "Không tìm thấy initdb; đặt DEV_PG_BIN_DIR trong .env" >&2; exit 1; }
SOCKET_DIR="$DEV_PG_DATA_DIR/socket"
LOG_FILE="$DEV_PG_DATA_DIR/postgres.log"

case "$DEV_PG_DATA_DIR" in
  "$ROOT_DIR"/*) echo "DEV_PG_DATA_DIR không được nằm trong repo" >&2; exit 1 ;;
esac

# Tách user/password/db từ DATABASE_URL (không in mật khẩu ra màn hình).
url_part() {
  node -e '
    const u = new URL(process.argv[1]);
    const v = { user: u.username, password: u.password, db: u.pathname.slice(1) }[process.argv[2]];
    process.stdout.write(decodeURIComponent(v));
  ' "$DATABASE_URL" "$1"
}
APP_USER="$(url_part user)"
APP_DB="$(url_part db)"

superuser_psql() { "$PG_BIN/psql" -h "$SOCKET_DIR" -p "$DEV_PG_PORT" -U "$(whoami)" -d postgres "$@"; }

cmd_start() {
  if "$PG_BIN/pg_ctl" -D "$DEV_PG_DATA_DIR" status >/dev/null 2>&1; then
    echo "PostgreSQL dev đang chạy (cổng $DEV_PG_PORT)."
  else
    "$PG_BIN/pg_ctl" -D "$DEV_PG_DATA_DIR" -l "$LOG_FILE" -w start >/dev/null
    echo "Đã khởi động PostgreSQL dev (cổng $DEV_PG_PORT)."
  fi
}

cmd_init() {
  if [[ -f "$DEV_PG_DATA_DIR/PG_VERSION" ]]; then
    echo "Cluster đã tồn tại tại $DEV_PG_DATA_DIR — bỏ qua initdb."
  else
    mkdir -p "$DEV_PG_DATA_DIR"
    chmod 700 "$DEV_PG_DATA_DIR"
    "$PG_BIN/initdb" -D "$DEV_PG_DATA_DIR" --auth-local=peer --auth-host=scram-sha-256 \
      --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    mkdir -p "$SOCKET_DIR"
    {
      echo "listen_addresses = '127.0.0.1'"
      echo "port = $DEV_PG_PORT"
      echo "unix_socket_directories = '$SOCKET_DIR'"
      echo "timezone = 'UTC'"
    } >> "$DEV_PG_DATA_DIR/postgresql.conf"
  fi
  cmd_start
  if superuser_psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1; then
    echo "Role $APP_USER đã tồn tại."
  else
    # CREATEDB: prisma migrate dev cần tạo shadow database (chỉ ở dev).
    # psql không thay biến :'pw' trong -c nên truyền câu lệnh qua stdin.
    superuser_psql -q -v pw="$(url_part password)" <<SQL
CREATE ROLE "$APP_USER" LOGIN CREATEDB PASSWORD :'pw';
SQL
    echo "Đã tạo role $APP_USER."
  fi
  if superuser_psql -tAc "SELECT 1 FROM pg_database WHERE datname='$APP_DB'" | grep -q 1; then
    echo "Database $APP_DB đã tồn tại."
  else
    superuser_psql -qc "CREATE DATABASE \"$APP_DB\" OWNER \"$APP_USER\" ENCODING 'UTF8'"
    echo "Đã tạo database $APP_DB."
  fi
}

case "${1:-}" in
  init)   cmd_init ;;
  start)  cmd_start ;;
  stop)   "$PG_BIN/pg_ctl" -D "$DEV_PG_DATA_DIR" -w stop ;;
  status) "$PG_BIN/pg_ctl" -D "$DEV_PG_DATA_DIR" status ;;
  psql)   shift; superuser_psql -d "$APP_DB" "$@" ;;
  *)      echo "Cách dùng: $0 {init|start|stop|status|psql}" >&2; exit 1 ;;
esac
