#!/usr/bin/env bash
# Starts a local Postgres for development. Needs postgresql installed.
# On a machine with Docker, `docker run -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16`
# does the same job with less ceremony.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/.dominate-portal-pgdata}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PORT:-5433}"

if [ ! -d "$PGDATA/base" ]; then
  echo "Initialising cluster at $PGDATA"
  "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust
fi

"$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/pg.log" -o "-p $PORT" -w start || true
createdb -h 127.0.0.1 -p "$PORT" -U postgres portal_dev 2>/dev/null || true
createdb -h 127.0.0.1 -p "$PORT" -U postgres portal_test 2>/dev/null || true

echo "Postgres is up on port $PORT."
echo 'DATABASE_URL="postgresql://postgres@127.0.0.1:'"$PORT"'/portal_dev"'
