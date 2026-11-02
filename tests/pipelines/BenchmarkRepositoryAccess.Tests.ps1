BeforeAll {
    $repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $probeScript = Join-Path $repoRoot 'pipelines/scripts/Test-BenchmarkRepositoryAccess.ps1'
    function az {}
    function git {}
    $savedBuild = $env:TF_BUILD
    $savedDebug = $env:SYSTEM_DEBUG
}

AfterAll {
    $env:TF_BUILD = $savedBuild
    $env:SYSTEM_DEBUG = $savedDebug
}

Describe 'Service principal repository read probe' {
    BeforeEach {
        $env:TF_BUILD = 'True'
        $env:SYSTEM_DEBUG = 'false'
        $state = @{
            IdentityType = 'servicePrincipal'
            AccountExit = 0
            TokenExit = 0
            GitExit = 0
            GitOutput = 'test-ref HEAD'
            Token = 'test-only-token'
            GitCalls = 0
            TokenCalls = 0
            Header = $null
            Helper = $null
            Arguments = $null
        }
        Mock az {
            if ($args[1] -eq 'show') {
                $global:LASTEXITCODE = $state.AccountExit
                return (@{
                    tenantId = 'test-tenant'
                    subscriptionId = 'test-subscription'
                    identityType = $state.IdentityType
                    clientId = 'test-client'
                } | ConvertTo-Json)
            }
            $state.TokenCalls++
            $global:LASTEXITCODE = $state.TokenExit
            return $state.Token
        }
        Mock git {
            $state.GitCalls++
            $state.Header = $env:GIT_CONFIG_VALUE_1
            $state.Helper = $env:GIT_CONFIG_VALUE_2
            $state.Arguments = @($args)
            $env:GIT_CONFIG_COUNT | Should -Be '3'
            $env:GIT_CONFIG_VALUE_0 | Should -BeNullOrEmpty
            $env:GIT_CONFIG_KEY_2 | Should -Be 'credential.helper'
            $env:GIT_TERMINAL_PROMPT | Should -Be '0'
            $env:GIT_TRACE_CURL | Should -Be '0'
            $global:LASTEXITCODE = $state.GitExit
            return $state.GitOutput
        }
    }

    It 'uses only a read-only probe and restores environment configuration' {
        $previousHeader = $env:GIT_CONFIG_VALUE_1
        $output = & $probeScript -ConnectionName 'test-connection' -ExpectedTenantId 'test-tenant' 6>&1 | Out-String
        $output | Should -Match 'PASS'
        $output | Should -Match 'app/client=test-client'
        $state.Header | Should -Be 'AUTHORIZATION: bearer test-only-token'
        $state.Helper | Should -BeNullOrEmpty
        $state.Arguments | Should -Contain 'ls-remote'
        $state.Arguments | Should -Not -Contain 'clone'
        $state.Arguments | Should -Not -Contain $state.Token
        $env:GIT_CONFIG_VALUE_1 | Should -Be $previousHeader
        ($output -split "`n" | Where-Object { $_ -notmatch '^##vso\[task.setsecret\]' }) -join "`n" | Should -Not -Match 'test-only-token'
    }

    It 'does not print a token when running outside Azure Pipelines' {
        $env:TF_BUILD = 'False'
        $output = & $probeScript -ConnectionName 'test-connection' 6>&1 | Out-String
        $output | Should -Not -Match 'test-only-token|task.setsecret'
    }

    It 'rejects a personal user login before acquiring a token' {
        $state.IdentityType = 'user'
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*service principal login*'
        $state.TokenCalls | Should -Be 0
        $state.GitCalls | Should -Be 0
    }

    It 'rejects a wrong tenant before acquiring a token' {
        { & $probeScript -ConnectionName 'test-connection' -ExpectedTenantId 'wrong-tenant' 6>$null } | Should -Throw '*ExpectedTenantId*'
        $state.TokenCalls | Should -Be 0
    }

    It 'rejects account CLI failures even with JSON output' {
        $state.AccountExit = 1
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*unable to read*'
        $state.TokenCalls | Should -Be 0
    }

    It 'rejects token CLI failures even with token output' {
        $state.TokenExit = 1
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*token acquisition failed*'
        $state.GitCalls | Should -Be 0
    }

    It 'rejects empty tokens' {
        $state.Token = ''
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*token acquisition failed*'
        $state.GitCalls | Should -Be 0
    }

    It 'rejects debug logging before any token acquisition' {
        $env:SYSTEM_DEBUG = 'true'
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*System.Debug*'
        $state.TokenCalls | Should -Be 0
    }

    It 'reports forbidden access without raw diagnostics and restores the environment' {
        $previousHeader = $env:GIT_CONFIG_VALUE_1
        $state.GitExit = 128
        $state.GitOutput = 'HTTP 403 raw diagnostic test-only-token'
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*HTTP 403: access forbidden*'
        $env:GIT_CONFIG_VALUE_1 | Should -Be $previousHeader
    }

    It 'does not mistake a network failure for a permissions failure' {
        $state.GitExit = 128
        $state.GitOutput = 'Could not resolve host'
        { & $probeScript -ConnectionName 'test-connection' 6>$null } | Should -Throw '*permissions could not be determined*'
    }
}
