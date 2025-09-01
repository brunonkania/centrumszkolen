#!/usr/bin/env bash
set -euo pipefail

# Użycie:
#   ./scripts/pg-backup.sh postgres://user:pass@host:5432/dbname
# albo korzysta z ENV: DATABASE_URL

DB_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: Podaj DATABASE_URL jako argument lub ustaw zmienną ENV."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUTDIR="${OUTDIR:-./backups}"
mkdir -p "$OUTDIR"
OUTFILE="$OUTDIR/db-$STAMP.sql.gz"

echo "[*] Backup do: $OUTFILE"
pg_dump "$DB_URL" | gzip -9 > "$OUTFILE"
echo "[OK] Zrobione."
