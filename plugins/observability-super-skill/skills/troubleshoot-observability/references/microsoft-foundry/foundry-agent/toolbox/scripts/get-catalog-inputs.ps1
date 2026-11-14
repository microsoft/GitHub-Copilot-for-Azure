<#
.SYNOPSIS
  Filter reviewed, sanitized catalog inputs locally; never fetch a catalog.
.NOTES
  Requires an explicitly approved Python 3.9+ interpreter and local input read.
  Output does not prove live catalog availability or runtime authorization.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Name = '',
    [string] $InputFile,
    [string] $PythonExecutable,
    [switch] $ReviewedInputs,
    [switch] $ManagedOAuth,
    [switch] $UserEntraToken
)

$ErrorActionPreference = 'Stop'
if (-not $InputFile -or -not $ReviewedInputs) {
    [Console]::Error.WriteLine('error: supply -InputFile and -ReviewedInputs after reviewing sanitized catalog inputs; no catalog is fetched.')
    exit 2
}
if (-not $PythonExecutable) {
    [Console]::Error.WriteLine('error: supply -PythonExecutable with an approved Python 3.9+ interpreter; no setup is performed.')
    exit 2
}
if ($ManagedOAuth -and $UserEntraToken) {
    [Console]::Error.WriteLine('error: select at most one auth filter.')
    exit 2
}
$arguments = @('-B', (Join-Path $PSScriptRoot 'get_catalog_inputs.py'),
    '--input-file', $InputFile, '--reviewed-inputs')
if ($Name) { $arguments += @('--name', $Name) }
if ($ManagedOAuth) { $arguments += '--managed-oauth' }
if ($UserEntraToken) { $arguments += '--user-entra-token' }
& $PythonExecutable @arguments
exit $LASTEXITCODE
