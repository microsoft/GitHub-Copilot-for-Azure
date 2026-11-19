#!/bin/bash
set -euo pipefail

mkdir -p /logs/verifier
printf '0\n' > /logs/verifier/reward.txt
export OUTPUT_DIR="${OUTPUT_DIR:-/output}"
python3 /tests/verify.py
