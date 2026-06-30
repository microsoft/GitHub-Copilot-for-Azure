# =============================================================================
# state.ps1 -- Nested get/set path helpers and JSON state model.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Nested get/set helpers (dotted paths into the state hashtable)
# ---------------------------------------------------------------------------
function Get-ByPath {
    # Returns the value at a dotted path (e.g. "input.mode") within a nested hashtable, or $null if any segment is missing.
    param([hashtable]$Root, [string]$Path)
    $node = $Root
    foreach ($seg in $Path.Split('.')) {
        if ($node -is [hashtable] -and $node.ContainsKey($seg)) {
            $node = $node[$seg]
        }
        else {
            return $null
        }
    }
    return $node
}

function Set-ByPath {
    # Sets the value at a dotted path within a nested hashtable, creating intermediate hashtables as needed.
    param([hashtable]$Root, [string]$Path, $Value)
    $segs = $Path.Split('.')
    $node = $Root
    for ($i = 0; $i -lt $segs.Count - 1; $i++) {
        $seg = $segs[$i]
        if (-not ($node.ContainsKey($seg)) -or -not ($node[$seg] -is [hashtable])) {
            $node[$seg] = @{}
        }
        $node = $node[$seg]
    }
    $node[$segs[-1]] = $Value
}

function Test-Provided {
    # A need is "provided" when the key exists and is not null and not an empty string.
    param([hashtable]$Root, [string]$Path)
    $segs = $Path.Split('.')
    $node = $Root
    for ($i = 0; $i -lt $segs.Count - 1; $i++) {
        $seg = $segs[$i]
        if ($node -is [hashtable] -and $node.ContainsKey($seg)) { $node = $node[$seg] } else { return $false }
    }
    $leaf = $segs[-1]
    if (-not ($node -is [hashtable]) -or -not $node.ContainsKey($leaf)) { return $false }
    $val = $node[$leaf]
    if ($null -eq $val) { return $false }
    if ($val -is [string] -and [string]::IsNullOrWhiteSpace($val)) { return $false }
    return $true
}

# ---------------------------------------------------------------------------
# State load / save
# ---------------------------------------------------------------------------
function New-State {
    # Builds a fresh, empty state object for a repo that has no prepare-info.json yet.
    return @{
        schemaVersion = $SchemaVersion
        repoPath      = $RepoPath
        createdAtUtc  = (Get-Date).ToUniversalTime().ToString('o')
        updatedAtUtc  = (Get-Date).ToUniversalTime().ToString('o')
        auto          = @{}      # script-owned, refreshed every run
        steps         = @{}      # per-step status: pending | done
        input         = @{}      # LM-owned values
    }
}

function Get-State {
    # Loads the existing state file (ensuring core keys exist), or creates the state directory and a new state object.
    if (Test-Path -LiteralPath $StateFile) {
        $raw = Get-Content -LiteralPath $StateFile -Raw
        $obj = $raw | ConvertFrom-Json -AsHashtable
        if (-not $obj.ContainsKey('auto'))  { $obj['auto']  = @{} }
        if (-not $obj.ContainsKey('steps')) { $obj['steps'] = @{} }
        if (-not $obj.ContainsKey('input')) { $obj['input'] = @{} }
        return $obj
    }
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    return New-State
}

function Save-State {
    # Stamps the updated timestamp and writes the state object back to prepare-info.json as JSON.
    param([hashtable]$State)
    $State['updatedAtUtc'] = (Get-Date).ToUniversalTime().ToString('o')
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    ($State | ConvertTo-Json -Depth 30) | Set-Content -LiteralPath $StateFile -Encoding utf8
}

