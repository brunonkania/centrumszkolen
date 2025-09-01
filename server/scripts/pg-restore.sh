#!/usr/bin/env bash
set -euo pipefail

# Użycie:
#   ./scripts/pg-restore.sh postgres://user:pass@host:5432/dbname ./backups/db-YYYYMMDD-HHMMSS.sql.gz

DB_URL="${1:-${DATABASE_URL:-}}"
FILE="${2:-}"
if [ -z "$DB_URL" ] || [ -z "$FILE" ]; then
  echo "Użycie: $0 <DATABASE_URL> <plik.sql|plik.sql.gz>"
  exit 1
fi

echo "[*] Przywracam $FILE -> $DB_URL"
if [[ "$FILE" == *.gz ]]; then
  gunzip -c "$FILE" | psql "$DB_URL"
else
  psql "$DB_URL" < "$FILE"
fi
echo "[OK] Przywrócono."
