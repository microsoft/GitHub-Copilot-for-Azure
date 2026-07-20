# =============================================================================
# refs.ps1 -- SDK / service reference path resolution helpers.
# Dot-sourced by prepare.ps1; shares script scope ($RepoPath, $StateFile, $Steps).
# Not a standalone script.
# =============================================================================

function Get-SdkLanguageCodes {
    # Maps the project's languages (auto-detected files + LM-provided component technologies)
    # to Azure SDK quick-reference language codes (nodejs/js/ts -> ts, python -> py, etc.).
    # $Kind filters to the codes that actually have a reference file for that SDK family
    # (App Configuration has no .NET quick-reference, so 'dotnet' is dropped for appconfig).
    param([hashtable]$State, [string]$Kind = 'identity')
    $available = if ($Kind -eq 'appconfig') { @('py', 'ts', 'java') } else { @('py', 'dotnet', 'ts', 'java') }
    $codes = [System.Collections.Generic.List[string]]::new()
    $add = { param($c) if (($available -contains $c) -and -not $codes.Contains($c)) { $codes.Add($c) } }

    foreach ($l in @($State.auto.detectedLanguages)) {
        switch ($l) {
            'nodejs' { & $add 'ts' }
            'python' { & $add 'py' }
            'dotnet' { & $add 'dotnet' }
            'java'   { & $add 'java' }
        }
    }
    foreach ($comp in @($State.input.components)) {
        $t = "$($comp.technology)".ToLower()
        if ($t -match 'node|javascript|typescript|\bts\b|\bjs\b') { & $add 'ts' }
        if ($t -match 'python|\bpy\b|flask|django|fastapi')        { & $add 'py' }
        if ($t -match '\.net|dotnet|c#|csharp|asp')                { & $add 'dotnet' }
        if ($t -match 'java|spring')                               { & $add 'java' }
    }
    return @($codes)
}

function Test-ArchitectureUsesService {
    # Returns $true if any service named in the LM-provided architecture matches the given
    # name pattern (e.g. 'App Configuration'), so steps can surface service-specific refs.
    param([hashtable]$State, [string]$Pattern)
    foreach ($a in @($State.input.architecture)) {
        if ("$($a.azureService)" -match $Pattern) { return $true }
    }
    return $false
}

function Get-DurableRefs {
    # Returns the Durable Functions + Durable Task Scheduler reference paths when the chosen
    # architecture uses Durable Functions or the Durable Task Scheduler, else nothing. Lets the
    # research/generate steps surface these refs on demand instead of the specialized-check step.
    param([hashtable]$State)
    foreach ($a in @($State.input.architecture)) {
        $svc = "$($a.azureService)".ToLower()
        if ($svc -like '*durable*' -or $svc -like '*task scheduler*') {
            return @(
                'scripts/references/services/functions/durable.md',
                'scripts/references/services/durable-task-scheduler/README.md',
                'scripts/references/services/durable-task-scheduler/bicep.md'
            )
        }
    }
    return @()
}

function Get-ServiceReadmeRefs {
    # Maps each Azure service named in the LM-provided architecture to its reference README
    # under scripts/references/services/, so the research step can name the exact files to
    # read instead of a <service> placeholder. Returns a deduped list of README paths.
    param([hashtable]$State)
    $map = [ordered]@{
        'container app'                     = 'container-apps'
        'app service'                       = 'app-service'
        'static web'                        = 'static-web-apps'
        'aks|kubernetes'                    = 'aks'
        'cosmos'                            = 'cosmos-db'
        'sql'                               = 'sql-database'
        'key vault'                         = 'key-vault'
        'service bus'                       = 'service-bus'
        'event grid'                        = 'event-grid'
        'logic app'                         = 'logic-apps'
        'storage|blob'                      = 'storage'
        'application insights|app insights' = 'app-insights'
        'openai|foundry|cognitive'          = 'foundry'
        'durable'                           = 'durable-task-scheduler'
        'function'                          = 'functions'
    }
    $dirs = [System.Collections.Generic.List[string]]::new()
    foreach ($a in @($State.input.architecture)) {
        $svc = "$($a.azureService)".ToLower()
        foreach ($pat in $map.Keys) {
            if ($svc -match $pat) { $d = $map[$pat]; if (-not $dirs.Contains($d)) { $dirs.Add($d) } }
        }
    }
    return @($dirs | ForEach-Object { "scripts/references/services/$_/README.md" })
}

