Set-StrictMode -Version Latest

function Get-NativeRuntimeIdentifier {
    return @(
        'win-x64', 'win-arm64',
        'osx-x64', 'osx-arm64',
        'linux-x64', 'linux-arm64',
        'linux-musl-x64', 'linux-musl-arm64'
    )
}

function Get-NativeBuildTopology {
    param(
        [string] $HostRuntimeIdentifier,
        [string] $TargetRuntimeIdentifier
    )

    $hostMatch = [regex]::Match($HostRuntimeIdentifier, '^(win|linux|osx)(-musl)?-(x64|arm64)$')
    $targetMatch = [regex]::Match($TargetRuntimeIdentifier, '^(win|linux|osx)(-musl)?-(x64|arm64)$')
    if (-not $hostMatch.Success -or -not $targetMatch.Success) {
        throw "Unable to compare host RID '$HostRuntimeIdentifier' with target RID '$TargetRuntimeIdentifier'."
    }
    if ($hostMatch.Groups[1].Value -ne $targetMatch.Groups[1].Value) {
        throw "Native AOT cross-operating-system builds are not supported. Host RID: '$HostRuntimeIdentifier'; target RID: '$TargetRuntimeIdentifier'."
    }

    $allowedTargetsByHost = @{
        'win-x64' = @('win-x64', 'win-arm64')
        'win-arm64' = @('win-arm64')
        'linux-x64' = @('linux-x64', 'linux-musl-x64')
        'linux-arm64' = @('linux-arm64', 'linux-musl-arm64')
        'osx-x64' = @('osx-x64', 'osx-arm64')
        'osx-arm64' = @('osx-arm64')
    }
    if (-not $allowedTargetsByHost.ContainsKey($HostRuntimeIdentifier) -or
        $allowedTargetsByHost[$HostRuntimeIdentifier] -notcontains $TargetRuntimeIdentifier) {
        throw "Host RID '$HostRuntimeIdentifier' does not build target RID '$TargetRuntimeIdentifier' in the supported platform topology."
    }

    return [pscustomobject]@{
        HostArchitecture = $hostMatch.Groups[3].Value
        TargetArchitecture = $targetMatch.Groups[3].Value
        TargetOperatingSystem = $targetMatch.Groups[1].Value
        UseMuslContainer = $targetMatch.Groups[2].Success
    }
}

function Get-ValidatedNativePackage {
    param(
        [string] $ArchivePath,
        [string] $RuntimeIdentifier,
        [switch] $Symbols
    )

    if ((Get-NativeRuntimeIdentifier) -notcontains $RuntimeIdentifier) {
        throw "Runtime identifier '$RuntimeIdentifier' is not supported."
    }

    $fileName = [System.IO.Path]::GetFileName($ArchivePath)
    $checksumPath = "$ArchivePath.sha256"
    $checksumLine = (Get-Content -LiteralPath $checksumPath -Raw -ErrorAction Stop).Trim()
    $checksumParts = $checksumLine -split '\s+', 2
    if ($checksumParts.Count -ne 2 -or
        $checksumParts[0] -notmatch '^[0-9a-fA-F]{64}$' -or
        $checksumParts[1] -ne $fileName) {
        throw "Checksum file '$checksumPath' is malformed."
    }
    $hash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    if ($hash -ne $checksumParts[0].ToLowerInvariant()) {
        throw "SHA-256 validation failed for '$fileName'."
    }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        $files = @($zip.Entries | Where-Object { -not [string]::IsNullOrEmpty($_.Name) })
        $executableName = if ($RuntimeIdentifier.StartsWith('win-')) { 'ghcfa-telem.exe' } else { 'ghcfa-telem' }
        $symbolEntries = @($files | Where-Object {
            $_.FullName -match '(?i)(\.pdb$|\.dbg$|\.dSYM[/\\])'
        })

        if (-not $Symbols) {
            if (@($files | Where-Object { $_.FullName -eq $executableName }).Count -ne 1) {
                throw "Runtime archive '$fileName' must contain exactly one root '$executableName'."
            }
            if ($symbolEntries.Count -ne 0) {
                throw "Runtime archive '$fileName' contains symbol files."
            }
        }
        else {
            $nativeSymbols = @(if ($RuntimeIdentifier.StartsWith('win-')) {
                $files | Where-Object { $_.FullName -eq 'ghcfa-telem.pdb' }
            }
            elseif ($RuntimeIdentifier.StartsWith('linux-')) {
                $files | Where-Object { $_.FullName -eq 'ghcfa-telem.dbg' }
            }
            else {
                $files | Where-Object { $_.FullName -match '^ghcfa-telem\.dSYM[/\\]' }
            })
            if ($nativeSymbols.Count -eq 0) {
                throw "Symbols archive '$fileName' does not contain the expected native debug artifact."
            }
            if ($symbolEntries.Count -ne $files.Count) {
                throw "Symbols archive '$fileName' contains non-symbol files."
            }
        }
    }
    finally {
        $zip.Dispose()
    }

    return [pscustomobject]@{
        Path = $ArchivePath
        File = $fileName
        Sha256 = $hash
    }
}

Export-ModuleMember -Function Get-NativeRuntimeIdentifier, Get-NativeBuildTopology, Get-ValidatedNativePackage
