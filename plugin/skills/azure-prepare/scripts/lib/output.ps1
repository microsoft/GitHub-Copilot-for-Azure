# =============================================================================
# output.ps1 -- NEXT ACTION and COMPLETE output emitters.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Output emitters
# ---------------------------------------------------------------------------
function Write-NextAction {
    # Writes null placeholders for the missing keys, saves state, and prints the NEXT ACTION block telling the LM what to do and which keys to fill.
    param([hashtable]$State, [hashtable]$Step, [array]$Missing)

    # Ensure null placeholders exist for every missing need so the LM has a template.
    foreach ($n in $Missing) {
        if (-not (Test-Provided $State $n.Path)) { Set-ByPath $State $n.Path $null }
    }
    Save-State $State

    $phaseLabel = if ($Step.phase -eq 1) { 'Phase 1 — Planning' } else { 'Phase 2 — Execution' }

    Write-Output '=== AZURE-PREPARE :: NEXT ACTION ==='
    Write-Output ''
    Write-Output "Step:  $($Step.id)  ($phaseLabel)"
    Write-Output "Title: $($Step.title)"
    Write-Output "State: $StateFile"
    Write-Output ''
    if ($Step.ContainsKey('gate') -and $Step.gate) {
        Write-Output '*** USER APPROVAL GATE — do not continue until the user approves. ***'
        Write-Output ''
    }
    Write-Output 'What to do:'
    foreach ($line in ((Get-StepGuidance $Step.id) -split "`n")) { Write-Output ("  " + $line.TrimEnd()) }
    Write-Output ''
    $allRefs = @($Step.refs)
    if ($Step.ContainsKey('dynamicRefs') -and $Step.dynamicRefs) {
        $allRefs += @(& $Step.dynamicRefs $State)
    }
    $allRefs = @($allRefs | Where-Object { $_ } | Select-Object -Unique)
    if ($allRefs.Count -gt 0) {
        Write-Output 'Read for detail:'
        foreach ($r in $allRefs) { Write-Output "  - $r" }
        Write-Output ''
    }
    Write-Output 'Fill these keys in the state file (currently null):'
    foreach ($n in $Missing) {
        Write-Output "  - $($n.Path) : $($n.Prompt)"
    }
    Write-Output ''
    Write-Output 'Then re-run:'
    Write-Output "  pwsh <skill>/scripts/prepare.ps1 -RepoPath `"$RepoPath`""
    Write-Output ''
    Write-Output '=== END NEXT ACTION ==='
}

function Write-Complete {
    # Saves state and prints the COMPLETE block directing the LM to hand off to azure-validate.
    param([hashtable]$State)
    Save-State $State
    $plan = Join-Path $RepoPath '.azure/deployment-plan.md'
    Write-Output '=== AZURE-PREPARE :: COMPLETE ==='
    Write-Output ''
    Write-Output 'All preparation steps are done.'
    Write-Output "Plan: $plan  (Status: Ready for Validation)"
    Write-Output ''
    Write-Output 'Next: invoke the azure-validate skill.'
    Write-Output 'Do NOT run azd up / azd deploy / terraform apply directly.'
    Write-Output ''
    Write-Output '=== END COMPLETE ==='
}
