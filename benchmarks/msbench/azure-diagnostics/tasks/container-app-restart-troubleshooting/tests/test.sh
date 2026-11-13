#!/bin/bash

_vally_verifier_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit $?
readonly _vally_verifier_dir
readonly _vally_verifier_script="$_vally_verifier_dir/test.mjs"
node "$_vally_verifier_script" prepare || exit $?

# Seed from the environment so a harness that exports these (the documented
# cross-platform path, and the only one available on Windows) is not discarded;
# the setup fragment below can still override either value.
DIFF_FILE="${DIFF_FILE:-}"
ARTIFACT_DIR="${ARTIFACT_DIR:-}"

_vally_grade_args=(grade)
if [ -n "$DIFF_FILE" ]; then
  _vally_grade_args+=(--diff-file "$DIFF_FILE")
fi
if [ -n "$ARTIFACT_DIR" ]; then
  _vally_grade_args+=(--artifact-dir "$ARTIFACT_DIR")
fi

node "$_vally_verifier_script" "${_vally_grade_args[@]}"
exit $?
