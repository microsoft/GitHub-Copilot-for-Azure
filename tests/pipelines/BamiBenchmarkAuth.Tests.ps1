BeforeAll {
    $repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $credentialScript = Join-Path $repoRoot 'pipelines/scripts/Get-BamiBenchmarkCredential.ps1'
    $runScript = Join-Path $repoRoot 'pipelines/scripts/Invoke-RunBenchmarks.ps1'
    $secret = "test-only%credential`nsecond-line"
    $envNames = @(
        'TF_BUILD', 'SYSTEM_DEBUG', 'PIP_EXTRA_INDEX_URL',
        'BAMI_CLIENT_SECRET',
        'CAPI_INTEGRATION_ID', 'CAPI_HMAC_KEY', 'USE_COPILOT_CLI_VERSION',
        'AZURE_CLIENT_SECRET'
    )
    $savedEnv = @{}
    foreach ($name in $envNames) {
        $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name)
    }
    # Pester intercepts every CLI boundary; no live credentials or Azure calls.
    function az {}
    function python {}
    function git {}
    function msbench-cli {}
    function Invoke-TestBenchmark {
        param(
            [switch]$UseBamiCredentials,
            [string[]]$Model = @('test-one', 'test-two')
        )
        & $runScript -UseBamiCredentials:$UseBamiCredentials -Model $Model `
            -OutputPath (Join-Path $caseDirectory 'output') `
            -StorageAccountName 'test-storage' -ContainerName 'test-container'
    }
}

AfterAll {
    foreach ($name in $envNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnv[$name])
    }
}

Describe 'BAMI benchmark credential forwarding' {
    BeforeEach {
        foreach ($envName in $envNames) {
            [Environment]::SetEnvironmentVariable($envName, $null)
        }
        $env:TF_BUILD = 'True'
        $env:SYSTEM_DEBUG = 'false'
        $env:PIP_EXTRA_INDEX_URL = 'test-feed'
        $state = @{
            VaultExit = 0
            Secret = $secret
            AzCalls = [System.Collections.Generic.List[object]]::new()
            RunCalls = [System.Collections.Generic.List[object]]::new()
        }
        $workingDirectory = Get-Location
        $caseDirectory = Join-Path $TestDrive ([guid]::NewGuid().ToString())
        $null = New-Item -ItemType Directory -Path $caseDirectory
        Set-Location $caseDirectory

        Mock az {
            $state.AzCalls.Add(@($args))
            $global:LASTEXITCODE = 0
            if ($args[0] -eq 'keyvault') {
                if ($args -contains 'kv-msbench-eval') {
                    $global:LASTEXITCODE = $state.VaultExit
                    return $state.Secret
                }
                return 'test-only-capi'
            }
            if ($args[0] -eq 'account') { return 'test-only-repo-token' }
            if ($args[2] -eq 'download') { $global:LASTEXITCODE = 1 }
        }
        Mock Get-Command { [pscustomobject]@{ Path = 'mock-python' } } -ParameterFilter { $Name -eq 'python' }
        Mock python { $global:LASTEXITCODE = 0; 'mock-python' }
        Mock git {
            $global:LASTEXITCODE = 0
            $directory = Join-Path $args[-1] 'curation/benchmarks/azure'
            $null = New-Item -ItemType Directory -Path $directory -Force
        }
        Mock msbench-cli {
            $global:LASTEXITCODE = 0
            if ($args[0] -eq 'run') {
                $state.RunCalls.Add(@($args))
                "run_id=$($state.RunCalls.Count)"
            }
        }
    }

    AfterEach {
        Set-Location $workingDirectory
    }

    It 'retrieves the named secret and exports only escaped secret logging commands' {
        $output = & $credentialScript 6>&1 | Out-String
        $escaped = $secret.Replace('%', '%AZP25').Replace("`n", '%0A')
        $output | Should -Match ([regex]::Escape("##vso[task.setsecret]$escaped"))
        $output | Should -Match ([regex]::Escape("##vso[task.setvariable variable=BAMI_CLIENT_SECRET;issecret=true;isoutput=true]$escaped"))
        $output.Contains($secret) | Should -BeFalse
        $state.AzCalls.Count | Should -Be 1
        $state.AzCalls[0] | Should -Contain 'kv-msbench-eval'
        $state.AzCalls[0] | Should -Contain 'msbench-evals-app-secret'
        $state.AzCalls[0] | Should -Not -Contain $secret
        @(Get-ChildItem $caseDirectory -Recurse -File).Count | Should -Be 0
    }

    It 'requires a pipeline task to export credentials' {
        $env:TF_BUILD = 'False'
        { & $credentialScript 6>$null } | Should -Throw '*Azure DevOps*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'blocks debug logging before retrieving a secret' {
        $env:SYSTEM_DEBUG = 'true'
        { & $credentialScript 6>$null } | Should -Throw '*System.Debug*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'rejects native vault failures even when stdout contains a value' {
        $state.VaultExit = 9
        { & $credentialScript 6>$null } | Should -Throw '*exit code 9*'
    }

    It 'rejects empty secrets' {
        $state.Secret = ''
        { & $credentialScript 6>$null } | Should -Throw '*empty or invalid*'
    }

    It 'preserves the default Microsoft submission arguments' {
        $null = Invoke-TestBenchmark 6>&1
        $state.RunCalls.Count | Should -Be 2
        for ($index = 0; $index -lt $state.RunCalls.Count; $index++) {
            $state.RunCalls[$index] | Should -Be @(
                'run', '--agent', 'github-copilot-cli',
                '--benchmark', 'azure.skill', '--model', @('test-one', 'test-two')[$index],
                '--encrypted-env', 'CAPI_INTEGRATION_ID', 'CAPI_HMAC_KEY',
                '--env', 'USE_COPILOT_CLI_VERSION',
                '--dataset', (Join-Path $caseDirectory 'msbench-benchmarks/curation/benchmarks/azure/metadata.csv'),
                '--tag', 'org=CoreAI Cloud and Tools', '--no-wait', '--confirm'
            )
        }
        $uploads = @($state.AzCalls | Where-Object { $_[0] -eq 'storage' -and $_ -notcontains 'ToBeProcessed' })
        $uploads.Count | Should -Be 2
        @($state.AzCalls | Where-Object { $_ -contains 'ToBeProcessed' }).Count | Should -Be 2
        foreach ($upload in $uploads) {
            $nameIndex = [array]::IndexOf($upload, '--name')
            $upload[$nameIndex + 1] | Should -Match '^\d{4}-\d{2}-\d{2}/(run_ids\.json|timestamp\.txt)$'
        }
    }

    It 'requires the mapped BAMI secret when forwarding is enabled' {
        { Invoke-TestBenchmark -UseBamiCredentials 6>$null } | Should -Throw '*requires BAMI_CLIENT_SECRET*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'rejects an unresolved secret output variable' {
        $env:BAMI_CLIENT_SECRET = '$(BamiCredentials.BAMI_CLIENT_SECRET)'
        { Invoke-TestBenchmark -UseBamiCredentials 6>$null } | Should -Throw '*requires BAMI_CLIENT_SECRET*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'requires explicit forwarding instead of silently ignoring a BAMI secret' {
        $env:BAMI_CLIENT_SECRET = $secret
        { Invoke-TestBenchmark 6>$null } | Should -Throw '*Enable forwarding explicitly*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'blocks debug submission before accessing credentials' {
        $env:BAMI_CLIENT_SECRET = $secret
        $env:SYSTEM_DEBUG = 'true'
        { Invoke-TestBenchmark -UseBamiCredentials 6>$null } | Should -Throw '*System.Debug*'
        $state.AzCalls.Count | Should -Be 0
    }

    It 'forwards the secret by name without replacing Microsoft credentials or writing its value' {
        $env:BAMI_CLIENT_SECRET = $secret
        $env:AZURE_CLIENT_SECRET = 'test-only-ces-credential'
        $output = Invoke-TestBenchmark -UseBamiCredentials 6>&1 | Out-String
        $state.RunCalls.Count | Should -Be 2
        foreach ($runArgs in $state.RunCalls) {
            $encryptedIndex = [array]::IndexOf($runArgs, '--encrypted-env')
            $runArgs[($encryptedIndex + 1)..($encryptedIndex + 3)] | Should -Be @('CAPI_INTEGRATION_ID', 'CAPI_HMAC_KEY', 'BAMI_CLIENT_SECRET')
            $runArgs | Should -Not -Contain $secret
            $runArgs | Should -Not -Contain '--verbose'
        }
        $output.Contains($secret) | Should -BeFalse
        $env:CAPI_INTEGRATION_ID | Should -Be 'test-only-capi'
        $env:AZURE_CLIENT_SECRET | Should -Be 'test-only-ces-credential'
        foreach ($file in Get-ChildItem $caseDirectory -Recurse -File) {
            (Get-Content $file.FullName -Raw).Contains($secret) | Should -BeFalse
        }
    }

    It 'submits the full suite for all seven default models with encrypted BAMI credentials' {
        $env:BAMI_CLIENT_SECRET = $secret
        $null = & $runScript -UseBamiCredentials `
            -OutputPath (Join-Path $caseDirectory 'output') `
            -StorageAccountName 'test-storage' -ContainerName 'test-container' 6>&1
        $models = @(
            'claude-sonnet-4.5-autodev-test',
            'claude-opus-4.5-autodev-test',
            'gpt-5.2-codex-autodev-test',
            'gpt-5.2-autodev-test',
            'gemini-2.5-pro-autodev-test',
            'claude-opus-4.7',
            'gpt-5.5'
        )
        $state.RunCalls.Count | Should -Be $models.Count
        for ($index = 0; $index -lt $models.Count; $index++) {
            $runArgs = $state.RunCalls[$index]
            $runArgs | Should -Be @(
                'run', '--agent', 'github-copilot-cli',
                '--benchmark', 'azure.skill', '--model', $models[$index],
                '--encrypted-env', 'CAPI_INTEGRATION_ID', 'CAPI_HMAC_KEY', 'BAMI_CLIENT_SECRET',
                '--env', 'USE_COPILOT_CLI_VERSION',
                '--dataset', (Join-Path $caseDirectory 'msbench-benchmarks/curation/benchmarks/azure/metadata.csv'),
                '--tag', 'org=CoreAI Cloud and Tools', '--no-wait', '--confirm'
            )
        }
        $json = Get-Content (Join-Path $caseDirectory 'output/run_ids.json') -Raw
        @($json | ConvertFrom-Json).Count | Should -Be $models.Count
        @($state.AzCalls | Where-Object { $_ -contains 'ToBeProcessed' }).Count | Should -Be 2
    }

    It 'preserves the run ID array when a caller supplies one model' {
        $null = Invoke-TestBenchmark -Model 'test-one' 6>&1
        $json = Get-Content (Join-Path $caseDirectory 'output/run_ids.json') -Raw
        $json.Trim() | Should -Match '^\['
        @($json | ConvertFrom-Json) | Should -Be @('1')
    }
}
