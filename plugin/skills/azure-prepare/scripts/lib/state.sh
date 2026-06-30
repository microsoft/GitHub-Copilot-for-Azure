# =============================================================================
# state.sh — JSON state model, jq path helpers, and small utilities.
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

# Emits a UTC timestamp used for the created/updated/scanned fields in state.
now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Converts a dotted path (e.g. "input.mode") into a jq index filter like .["input"]["mode"].
path_filter() {
    local IFS='.' s f="."
    local segs; read -ra segs <<<"$1"
    for s in "${segs[@]}"; do f+="[\"$s\"]"; done
    printf '%s' "$f"
}

# Converts a dotted path into a JSON array of segments for use with jq's setpath().
path_array() {
    local IFS='.' s out=""
    local segs; read -ra segs <<<"$1"
    for s in "${segs[@]}"; do out+="\"$s\","; done
    printf '[%s]' "${out%,}"
}

# Returns true if the given value is present in the remaining arguments (array membership test).
in_list() { local needle="$1"; shift; local x; for x in "$@"; do [[ "$x" == "$needle" ]] && return 0; done; return 1; }

# ---------------------------------------------------------------------------
# Nested get/set helpers (dotted paths into the state document)
# ---------------------------------------------------------------------------

# Returns the value at a dotted path within STATE (raw scalar / compact JSON), or non-zero if missing/null.
get_by_path() {
    local f v
    f="$(path_filter "$1")"
    v="$(printf '%s' "$STATE" | jq -r "$f // empty" 2>/dev/null)"
    [[ -z "$v" ]] && return 1
    printf '%s' "$v"
}

# Sets the value at a dotted path within STATE to the given JSON value, creating intermediate objects as needed.
set_by_path() {
    local p
    p="$(path_array "$1")"
    STATE="$(printf '%s' "$STATE" | jq --argjson v "$2" --argjson p "$p" 'setpath($p; $v)')"
}

# Sets the value at a dotted path to a JSON string (encodes the given text safely).
set_str() { local j; j="$(jq -n --arg s "$2" '$s')"; set_by_path "$1" "$j"; }

# Sets the value at a dotted path to JSON null (the placeholder the LM must fill).
set_null() { set_by_path "$1" 'null'; }

# A need is "provided" when the key exists and is not null and not an empty/whitespace string.
test_provided() {
    local f t s
    f="$(path_filter "$1")"
    t="$(printf '%s' "$STATE" | jq -r "($f) | type" 2>/dev/null)"
    [[ -z "$t" || "$t" == "null" ]] && return 1
    if [[ "$t" == "string" ]]; then
        s="$(printf '%s' "$STATE" | jq -r "$f" 2>/dev/null)"
        [[ -z "${s//[[:space:]]/}" ]] && return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# State load / save
# ---------------------------------------------------------------------------

# Builds a fresh, empty state object for a repo that has no prepare-info.json yet.
new_state() {
    jq -n --arg rp "$RepoPath" --arg ts "$(now_iso)" --argjson sv "$SchemaVersion" \
        '{schemaVersion:$sv, repoPath:$rp, createdAtUtc:$ts, updatedAtUtc:$ts, auto:{}, steps:{}, input:{}}'
}

# Loads the existing state file (ensuring core keys exist), or creates the state directory and a new state object.
get_state() {
    if [[ -f "$StateFile" ]]; then
        STATE="$(jq '.auto = (.auto // {}) | .steps = (.steps // {}) | .input = (.input // {})' "$StateFile")"
    else
        mkdir -p "$StateDir"
        STATE="$(new_state)"
    fi
}

# Stamps the updated timestamp and writes the state object back to prepare-info.json as JSON.
save_state() {
    STATE="$(printf '%s' "$STATE" | jq --arg t "$(now_iso)" '.updatedAtUtc = $t')"
    mkdir -p "$StateDir"
    printf '%s\n' "$STATE" | jq '.' >"$StateFile"
}

# ---------------------------------------------------------------------------
# Programmatic collectors (idempotent; run every invocation)
# ---------------------------------------------------------------------------

# Top-level + shallow file scan into the global FILES (newline-separated paths), excluding noise directories.
get_repo_files() {
    FILES="$(find "$RepoPath" -maxdepth 4 \
        \( -name .git -o -name .azure-prepare -o -name node_modules -o -name bin -o -name obj -o -name .venv -o -name dist -o -name .terraform \) -prune \
        -o -type f -print 2>/dev/null)"
}

# Returns 0 if any scanned file's basename matches the given shell glob pattern.
has_file_glob() {
    local pat="$1" f b
    while IFS= read -r f; do
        [[ -n "$f" ]] || continue
        b="${f##*/}"
        # shellcheck disable=SC2254
        case "$b" in $pat) return 0 ;; esac
    done < <(printf '%s\n' "$FILES")
    return 1
}

# Returns the full path of the first scanned file whose path ends with the given suffix regex.
first_file_matching() { printf '%s\n' "$FILES" | grep -m1 -E "$1" || true; }

