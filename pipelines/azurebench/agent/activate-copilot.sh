#!/bin/bash

copilot_bins=()
for candidate in /opt/node-v*/bin/copilot; do
    if [ -x "$candidate" ]; then
        copilot_bins+=("$candidate")
    fi
done

if [ "${#copilot_bins[@]}" -gt 1 ]; then
    printf 'Multiple downloaded Node installations contain Copilot CLI; refusing to select one arbitrarily.\n' >&2
    return 1
fi

if [ "${#copilot_bins[@]}" -eq 1 ]; then
    export PATH="${copilot_bins[0]%/*}:${PATH}"
fi

if ! command -v copilot >/dev/null 2>&1; then
    printf 'Copilot CLI is not available after agent package setup.\n' >&2
    return 127
fi
