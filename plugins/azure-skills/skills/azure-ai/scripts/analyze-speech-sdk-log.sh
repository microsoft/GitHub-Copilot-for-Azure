#!/usr/bin/env bash
# Launch the local Speech SDK log analyzer.
# Exit codes: 0 = analysis written to stdout or --help, 1 = file/read/size error, 2 = usage/argument error.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_dir/analyze-speech-sdk-log.mjs" "$@"
