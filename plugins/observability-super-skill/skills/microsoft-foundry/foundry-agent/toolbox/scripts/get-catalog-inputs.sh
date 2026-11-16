#!/usr/bin/env bash
# Filter reviewed catalog inputs locally using an explicitly approved interpreter.
set -euo pipefail

PY=""
ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --python)
      [ "$#" -ge 2 ] || { echo "error: --python requires an approved interpreter" >&2; exit 2; }
      PY="$2"
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done
if [ -z "$PY" ]; then
  echo "error: supply --python with an approved Python 3.9+ interpreter; no setup or catalog fetch is performed" >&2
  exit 2
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$PY" -B "$SCRIPT_DIR/get_catalog_inputs.py" "${ARGS[@]}"
