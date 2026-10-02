import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const scriptRoot = join(repoRoot, "telemetry-reporter", "eng", "scripts");
const runtimeIdentifiers = [
  "win-x64", "win-arm64", "osx-x64", "osx-arm64",
  "linux-x64", "linux-arm64", "linux-musl-x64", "linux-musl-arm64",
] as const;
const sourceVersion = "a".repeat(40);
const version = "0.1.123";
const powerShellAvailable = spawnSync("pwsh", ["--version"], { stdio: "ignore" }).status === 0;

type Manifest = {
  runtimeIdentifiers: string[];
  files: Array<{ runtimeIdentifier: string; file: string; sha256: string }>;
};

let fixtureRoot: string;
let manifestPath: string;

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(command: string): ReturnType<typeof spawnSync> {
  return spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    env: { ...process.env, AZURE_MCP_COLLECT_TELEMETRY: "false" },
    timeout: 30_000,
  });
}

function expectSuccess(result: ReturnType<typeof spawnSync>): void {
  expect(result.error).toBeUndefined();
  expect(result.status, String(result.stderr || result.stdout)).toBe(0);
}

function expectFailure(result: ReturnType<typeof spawnSync>, message: string): void {
  expect(result.error).toBeUndefined();
  expect(result.status, String(result.stderr || result.stdout)).toBe(1);
  expect(String(result.stderr)).toContain(message);
}

function archivePath(rid: string, symbols = false, packageVersion = version): string {
  return join(
    fixtureRoot,
    `telemetry-reporter_${rid}`,
    `ghcfa-telem-${packageVersion}-${rid}${symbols ? "-symbols" : ""}.zip`,
  );
}

function writeChecksum(archive: string, hash?: string, fileName = basename(archive)): void {
  const actualHash = hash ?? createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(`${archive}.sha256`, `${actualHash}  ${fileName}\n`);
}

function rewriteArchive(archive: string, entries: string[]): void {
  rmSync(archive);
  const command = `
    $zip = [System.IO.Compression.ZipFile]::Open(${psQuote(archive)}, 'Create')
    try {
      foreach ($name in @(${entries.map(psQuote).join(",")})) {
        $writer = [System.IO.StreamWriter]::new($zip.CreateEntry($name).Open())
        try { $writer.Write('fixture') } finally { $writer.Dispose() }
      }
    } finally { $zip.Dispose() }
  `;
  expectSuccess(runPowerShell(command));
  writeChecksum(archive);
}

function verifyArtifacts(): ReturnType<typeof spawnSync> {
  return runPowerShell(`
    & ${psQuote(join(scriptRoot, "Test-NightlyBuildArtifacts.ps1"))}
      -PipelineWorkspace ${psQuote(fixtureRoot)}
      -ManifestPath ${psQuote(manifestPath)}
      -BuildId '123' -BuildReason 'Manual' -SourceVersion '${sourceVersion}'
  `.replaceAll("\n      -", " -"));
}

function releaseDryRun(): ReturnType<typeof spawnSync> {
  return runPowerShell(`
    & ${psQuote(join(scriptRoot, "Publish-Release.ps1"))}
      -PipelineWorkspace ${psQuote(fixtureRoot)}
      -ManifestPath ${psQuote(manifestPath)}
      -ExpectedBuildId '123' -ExpectedSourceVersion '${sourceVersion}' -DryRun
  `.replaceAll("\n      -", " -"));
}

function updateManifest(update: (manifest: Manifest) => void): void {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")) as Manifest;
  update(manifest);
  writeFileSync(manifestPath, JSON.stringify(manifest));
}

function muslHelperCommand({
  rid = "linux-musl-x64",
  daemon = "linux/x86_64",
  imageRid = rid,
  probeFails = false,
  buildImage = "fixture-toolchain",
  publishFails = false,
}: { rid?: string; daemon?: string; imageRid?: string; probeFails?: boolean; buildImage?: string; publishFails?: boolean } = {}): string {
  return `
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
      ${psQuote(join(scriptRoot, "Build-Native.ps1"))}, [ref]$null, [ref]$null)
    foreach ($name in @('Initialize-MuslContainer', 'Invoke-BuildDotNet', 'Invoke-NativeCommand')) {
      $function = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
      }, $true)
      . ([scriptblock]::Create($function.Extent.Text))
    }
    $dockerCalls = [System.Collections.Generic.List[object]]::new()
    $credentialValues = [System.Collections.Generic.List[string]]::new()
    function docker {
      $script:dockerCalls.Add(@($args))
      if ($args -contains 'NuGetPackageSourceCredentials_azure-sdk-for-net') {
        $script:credentialValues.Add([Environment]::GetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net'))
      }
      $global:LASTEXITCODE = 0
      if ($args[0] -eq 'info') { return ${psQuote(daemon)} }
      if ($args[-1] -eq '--version') { return '10.0.400' }
      if ($args[-1] -eq '--info') { return '  RID: ${imageRid}' }
      if ($args -contains '-c') {
        if (${probeFails ? "$true" : "$false"}) { $global:LASTEXITCODE = 7 }
        return
      }
      if ($args -contains 'publish') {
        if (${publishFails ? "$true" : "$false"}) { $global:LASTEXITCODE = 5 }
        return
      }
      if ($args -contains '/publish/ghcfa-telem') {
        $global:LASTEXITCODE = $script:smokeExitCode
        return $script:smokeResponse
      }
    }
    function id { $global:LASTEXITCODE = 0; return '1000' }
    $repoRoot = Join-Path ${psQuote(fixtureRoot)} 'reporter'
    $null = New-Item -ItemType Directory -Path $repoRoot -Force
    $null = New-Item -ItemType Directory -Path (Join-Path ${psQuote(fixtureRoot)} '.git') -Force
    '{"sdk":{"version":"10.0.400"}}' | Set-Content (Join-Path $repoRoot 'global.json')
    $outputRootPath = ${psQuote(fixtureRoot)}
    $publishDirectory = ${psQuote(join(fixtureRoot, "publish"))}
    $stagingDirectory = ${psQuote(fixtureRoot)}
    $restoreConfigFilePath = ${psQuote(join(fixtureRoot, "nuget.config"))}
    '<configuration><packageSources><add key="azure-sdk-for-net" value="https://pkgs.dev.azure.com/azure-sdk/public/_packaging/azure-sdk-for-net/nuget/v3/index.json"/></packageSources></configuration>' |
      Set-Content $restoreConfigFilePath
    $RuntimeIdentifier = '${rid}'
    $targetArchitecture = '${rid.endsWith("arm64") ? "arm64" : "x64"}'
    $muslPlatform = '${rid.endsWith("arm64") ? "linux/arm64" : "linux/amd64"}'
    $MuslBuildImage = ${psQuote(buildImage)}
    $muslRuntimeImage = 'fixture-runtime'
    $useMuslContainer = $true
    Initialize-MuslContainer
  `;
}

describe.skipIf(!powerShellAvailable)("Telemetry Native AOT packaging", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "telemetry-native-packages-"));
    manifestPath = join(fixtureRoot, "manifest", "build-manifest.json");
    const fixtureCommand = `
      $root = ${psQuote(fixtureRoot)}
      foreach ($rid in @(${runtimeIdentifiers.map(psQuote).join(",")})) {
        $directory = Join-Path $root "telemetry-reporter_$rid"
        $null = New-Item -ItemType Directory -Path $directory -Force
        foreach ($symbols in @($false, $true)) {
          $suffix = if ($symbols) { '-symbols' } else { '' }
          $path = Join-Path $directory "ghcfa-telem-${version}-$rid$suffix.zip"
          $names = if (-not $symbols) {
            if ($rid.StartsWith('win-')) { @('ghcfa-telem.exe') } else { @('ghcfa-telem') }
          } elseif ($rid.StartsWith('win-')) {
            @('ghcfa-telem.pdb', 'managed.pdb')
          } elseif ($rid.StartsWith('linux-')) {
            @('ghcfa-telem.dbg', 'managed.pdb')
          } else {
            @('ghcfa-telem.dSYM/Contents/Resources/DWARF/ghcfa-telem', 'managed.pdb')
          }
          $zip = [System.IO.Compression.ZipFile]::Open($path, 'Create')
          try {
            foreach ($name in $names) {
              $writer = [System.IO.StreamWriter]::new($zip.CreateEntry($name).Open())
              try { $writer.Write('fixture') } finally { $writer.Dispose() }
            }
          } finally { $zip.Dispose() }
          $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
          "$hash  $([System.IO.Path]::GetFileName($path))" |
            Set-Content -LiteralPath "$path.sha256" -Encoding ascii
        }
      }
    `;
    expectSuccess(runPowerShell(fixtureCommand));
  });

  afterEach(() => {
    if (fixtureRoot) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("verifies sixteen archives and releases exactly eight runtime assets", () => {
    expectSuccess(verifyArtifacts());
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")) as Manifest;
    expect(manifest.runtimeIdentifiers).toEqual(runtimeIdentifiers);
    expect(manifest.files).toHaveLength(16);
    const result = releaseDryRun();
    expectSuccess(result);
    const release = JSON.parse(String(result.stdout)) as { tag: string; assets: string[] };
    expect(release.tag).toBe(`ghcfa-telem-${version}`);
    expect(release.assets.map(asset => basename(asset))).toEqual(
      runtimeIdentifiers.map(rid => `ghcfa-telem-${version}-${rid}.zip`),
    );
  });

  it.each(["linux-musl-x64", "linux-musl-arm64"])("rejects a missing %s artifact", rid => {
    rmSync(join(fixtureRoot, `telemetry-reporter_${rid}`), { recursive: true, force: true });
    expectFailure(verifyArtifacts(), "was not downloaded");
  });

  it.each([false, true])("rejects a missing musl checksum (symbols=%s)", symbols => {
    rmSync(`${archivePath("linux-musl-arm64", symbols)}.sha256`);
    expectFailure(verifyArtifacts(), "does not exist");
  });

  it("rejects incorrect hashes and checksum filenames", () => {
    const archive = archivePath("linux-musl-x64");
    writeChecksum(archive, "0".repeat(64));
    expectFailure(verifyArtifacts(), "SHA-256 validation failed");
    writeChecksum(archive, undefined, "wrong.zip");
    expectFailure(verifyArtifacts(), "is malformed");
  });

  it("rejects a different symbols package version", () => {
    const archive = archivePath("linux-musl-arm64", true);
    const renamed = archivePath("linux-musl-arm64", true, "0.1.124");
    renameSync(archive, renamed);
    renameSync(`${archive}.sha256`, `${renamed}.sha256`);
    writeChecksum(renamed);
    expectFailure(verifyArtifacts(), "package versions do not match");
  });

  it("rejects different versions between platforms", () => {
    for (const symbols of [false, true]) {
      const archive = archivePath("linux-musl-arm64", symbols);
      const renamed = archivePath("linux-musl-arm64", symbols, "0.1.124");
      renameSync(archive, renamed);
      rmSync(`${archive}.sha256`);
      writeChecksum(renamed);
    }
    expectFailure(verifyArtifacts(), "Expected one package version");
  });

  it.each(["ghcfa-telem.dbg", "managed.pdb", "ghcfa-telem.dSYM/Contents/debug"])(
    "rejects runtime archives containing %s",
    symbol => {
      rewriteArchive(archivePath("linux-musl-x64"), ["ghcfa-telem", symbol]);
      expectFailure(verifyArtifacts(), "contains symbol files");
    },
  );

  it("requires native musl debug symbols, not just managed PDBs", () => {
    rewriteArchive(archivePath("linux-musl-arm64", true), ["managed.pdb"]);
    expectFailure(verifyArtifacts(), "expected native debug artifact");
  });

  it("rejects non-symbol files in a symbols archive", () => {
    rewriteArchive(archivePath("linux-musl-arm64", true), ["ghcfa-telem.dbg", "ghcfa-telem"]);
    expectFailure(verifyArtifacts(), "contains non-symbol files");
  });

  it("rejects a runtime archive without its executable", () => {
    rewriteArchive(archivePath("linux-musl-arm64"), ["runtime.json"]);
    expectFailure(verifyArtifacts(), "exactly one root 'ghcfa-telem'");
  });

  it("rejects a stale six-target release manifest", () => {
    expectSuccess(verifyArtifacts());
    updateManifest(manifest => {
      manifest.runtimeIdentifiers = manifest.runtimeIdentifiers.filter(rid => !rid.includes("-musl-"));
      manifest.files = manifest.files.filter(file => !file.runtimeIdentifier.includes("-musl-"));
    });
    expectFailure(releaseDryRun(), "expected 8-target matrix");
  });

  it("validates symbols as well as runtime hashes before releasing", () => {
    expectSuccess(verifyArtifacts());
    writeChecksum(archivePath("linux-musl-x64", true), "0".repeat(64));
    expectFailure(releaseDryRun(), "SHA-256 validation failed");
  });

  it("rejects duplicate or missing musl manifest entries", () => {
    expectSuccess(verifyArtifacts());
    updateManifest(manifest => {
      const index = manifest.files.findIndex(file => file.file.endsWith("linux-musl-arm64-symbols.zip"));
      manifest.files[index] = manifest.files[index - 1];
    });
    expectFailure(releaseDryRun(), "exactly one");
  });

  it("rejects an archive whose hash differs from the manifest", () => {
    expectSuccess(verifyArtifacts());
    updateManifest(manifest => {
      manifest.files.find(file => file.runtimeIdentifier === "linux-musl-x64")!.sha256 = "0".repeat(64);
    });
    expectFailure(releaseDryRun(), "manifest SHA-256 validation failed");
  });

  it("generates native musl legs on matching architecture pools", () => {
    const outputPath = join(fixtureRoot, "build-info.json");
    const result = runPowerShell(`
      & ${psQuote(join(scriptRoot, "New-NightlyBuildInfo.ps1"))}
        -RepositoryRoot ${psQuote(repoRoot)} -OutputPath ${psQuote(outputPath)}
        -BuildId 123 -BuildReason Manual -SourceVersion '${sourceVersion}'
    `.replaceAll("\n        -", " -"));
    expectSuccess(result);
    const info = JSON.parse(readFileSync(outputPath, "utf8").replace(/^\uFEFF/, "")) as {
      matrices: Record<string, Record<string, { BuildRuntimeIdentifier: string; Pool: string }>>;
    };
    expect(info.matrices.linuxX64.linux_musl_x64).toMatchObject({
      BuildRuntimeIdentifier: "linux-musl-x64", Pool: "azsdk-pool",
    });
    expect(info.matrices.linuxArm64.linux_musl_arm64).toMatchObject({
      BuildRuntimeIdentifier: "linux-musl-arm64", Pool: "azsdk-pool-arm64",
    });
    expect(Object.values(info.matrices).flatMap(matrix =>
      Object.values(matrix).map(leg => leg.BuildRuntimeIdentifier),
    ).sort()).toEqual([...runtimeIdentifiers].sort());
  });

  it("keeps project, parameter validation, manifest and release target lists aligned", () => {
    const result = runPowerShell(`
      Import-Module ${psQuote(join(scriptRoot, "NativePackaging.psm1"))} -Force
      $targets = @(Get-NativeRuntimeIdentifier)
      $project = [xml](Get-Content ${psQuote(join(repoRoot, "telemetry-reporter", "src", "ghcfa-telem", "ghcfa-telem.csproj"))} -Raw)
      $projectTargets = $project.Project.PropertyGroup[0].RuntimeIdentifiers.Split(';')
      if (@(Compare-Object $targets $projectTargets).Count -ne 0) { throw 'Project RIDs differ.' }
      $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        ${psQuote(join(scriptRoot, "Build-Native.ps1"))}, [ref]$null, [ref]$null)
      $parameter = $ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'RuntimeIdentifier' }
      $attribute = $parameter.Attributes | Where-Object { $_.TypeName.Name -eq 'ValidateSet' }
      $parameterTargets = @($attribute.PositionalArguments | ForEach-Object { $_.Value })
      if (@(Compare-Object $targets $parameterTargets).Count -ne 0) { throw 'Parameter RIDs differ.' }
    `);
    expectSuccess(result);
  });

  it("rebuilds for musl toolchain, packaging helper, and installer changes", () => {
    const result = runPowerShell(`
      $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        ${psQuote(join(scriptRoot, "New-NightlyBuildInfo.ps1"))}, [ref]$null, [ref]$null)
      $function = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-RelevantPath'
      }, $true)
      . ([scriptblock]::Create($function.Extent.Text))
      foreach ($path in @(
        'telemetry-reporter/eng/native-musl/Dockerfile',
        'telemetry-reporter/eng/scripts/NativePackaging.psm1',
        'hooks/scripts/install-telemetry.sh',
        'hooks/scripts/install-telemetry.ps1'
      )) {
        if (-not (Test-RelevantPath $path)) { throw "Missing change-detection path: $path" }
      }
      if (Test-RelevantPath 'docs/hooks.md') { throw 'Documentation-only changes should not rebuild.' }
    `);
    expectSuccess(result);
  });

  it.each([
    ["linux-musl-x64", "linux/x86_64", "linux/amd64"],
    ["linux-musl-arm64", "linux/aarch64", "linux/arm64"],
  ])("routes %s publish and smoke tests through native containers", (rid, daemon, platform) => {
    const result = runPowerShell(muslHelperCommand({ rid, daemon }) + `
      Invoke-BuildDotNet -Arguments @('publish', $buildProjectPath, '--output', $buildPublishDirectory)
      $script:smokeExitCode = 0
      $script:smokeResponse = '{"status":200}'
      $success = Invoke-NativeCommand -Arguments @('--tool-name', 'azure-storage') -ExpectedExitCode 0
      $script:smokeExitCode = 1
      $script:smokeResponse = '{"status":400}'
      $failure = Invoke-NativeCommand -Arguments @('--event-type', 'tool_invocation') -ExpectedExitCode 1
      @{
        calls = @($dockerCalls.ToArray())
        success = ($success | ConvertFrom-Json).status
        failure = ($failure | ConvertFrom-Json).status
      } | ConvertTo-Json -Depth 5 -Compress
    `);
    expectSuccess(result);
    const observed = JSON.parse(String(result.stdout)) as {
      calls: string[][];
      success: number;
      failure: number;
    };
    expect(observed.success).toBe(200);
    expect(observed.failure).toBe(400);
    const publish = observed.calls.find(call => call.includes("publish"))!;
    expect(publish).toContain(platform);
    expect(publish).toContain("/repo/telemetry-reporter/src/ghcfa-telem/ghcfa-telem.csproj");
    expect(publish).toContain(`/artifacts/publish/${rid}`);
    expect(publish).toContain("AZURE_MCP_COLLECT_TELEMETRY=false");
    const smokeCalls = observed.calls.filter(call => call.includes("/publish/ghcfa-telem"));
    expect(smokeCalls).toHaveLength(2);
    for (const call of smokeCalls) {
      expect(call).toContain("fixture-runtime");
      expect(call).not.toContain("fixture-toolchain");
      expect(call).toContain(platform);
      expect(call).toContain("AZURE_MCP_COLLECT_TELEMETRY=false");
    }
  });

  it("rejects a Docker engine of the wrong architecture before compiling", () => {
    expectFailure(runPowerShell(muslHelperCommand({ daemon: "linux/arm64" })), "emulation is not supported");
  });

  it("rejects an SDK image with a glibc RID", () => {
    expectFailure(runPowerShell(muslHelperCommand({ imageRid: "linux-x64" })), "does not provide target RID");
  });

  it("surfaces a failed musl compiler/linker prerequisite probe", () => {
    expectFailure(runPowerShell(muslHelperCommand({ probeFails: true })), "prerequisite validation failed");
  });

  it("builds a local Alpine image from the configured SDK when no image is supplied", () => {
    const result = runPowerShell(muslHelperCommand({ buildImage: "" }) + `
      @{ image = $MuslBuildImage; calls = @($dockerCalls.ToArray()) } |
        ConvertTo-Json -Depth 5 -Compress
    `);
    expectSuccess(result);
    const observed = JSON.parse(String(result.stdout)) as { image: string; calls: string[][] };
    expect(observed.image).toBe("ghcfa-telem-musl-build:10.0.400-x64");
    const build = observed.calls.find(call => call[0] === "build")!;
    expect(build).toContain("linux/amd64");
    expect(build).toContain("DOTNET_SDK_VERSION=10.0.400");
    expect(build).toContain(observed.image);
  });

  it.each([null, "Username=existing;Password=fixture;ValidAuthenticationTypes=Basic"])(
    "forwards feed-scoped credentials without command-line secrets (previous=%s)",
    previous => {
      const result = runPowerShell(muslHelperCommand() + `
        $env:VSS_NUGET_ACCESSTOKEN = 'fake-build-token'
        [Environment]::SetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net', ${previous ? psQuote(previous) : "[NullString]::Value"})
        Invoke-BuildDotNet -Arguments @('publish', $buildProjectPath)
        @{
          credentials = @($credentialValues.ToArray())
          calls = @($dockerCalls.ToArray())
          after = [Environment]::GetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net')
        } | ConvertTo-Json -Depth 5 -Compress
      `);
      expectSuccess(result);
      const observed = JSON.parse(String(result.stdout)) as {
        credentials: string[];
        calls: string[][];
        after: string | null;
      };
      expect(observed.credentials).toEqual([
        previous ?? "Username=AzureDevOps;Password=fake-build-token;ValidAuthenticationTypes=Basic",
      ]);
      expect(observed.after).toBe(previous);
      expect(observed.calls.flat().join(" ")).not.toContain("fake-build-token");
      expect(observed.calls.flat().join(" ")).not.toContain("Password=");
    },
  );

  it("does not forward Azure SDK credentials when an explicit public feed is selected", () => {
    const result = runPowerShell(muslHelperCommand() + `
      $env:VSS_NUGET_ACCESSTOKEN = 'fake-build-token'
      [Environment]::SetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net', [NullString]::Value)
      '<configuration><packageSources><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>' |
        Set-Content $restoreConfigFilePath
      Invoke-BuildDotNet -Arguments @('publish', $buildProjectPath)
      @{ credentials = @($credentialValues.ToArray()) } | ConvertTo-Json -Compress
    `);
    expectSuccess(result);
    expect(JSON.parse(String(result.stdout))).toEqual({ credentials: [] });
  });

  it("refuses to send the authenticated token to a different feed URL", () => {
    const result = runPowerShell(muslHelperCommand() + `
      $env:VSS_NUGET_ACCESSTOKEN = 'fake-build-token'
      [Environment]::SetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net', [NullString]::Value)
      '<configuration><packageSources><add key="azure-sdk-for-net" value="https://example.invalid/nuget"/></packageSources></configuration>' |
        Set-Content $restoreConfigFilePath
      Invoke-BuildDotNet -Arguments @('publish', $buildProjectPath)
    `);
    expectFailure(result, "unexpected NuGet feed");
    expect(String(result.stderr)).not.toContain("fake-build-token");
  });

  it("restores the credential environment even when publish fails", () => {
    const result = runPowerShell(muslHelperCommand({ publishFails: true }) + `
      $env:VSS_NUGET_ACCESSTOKEN = 'fake-build-token'
      [Environment]::SetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net', [NullString]::Value)
      try { Invoke-BuildDotNet -Arguments @('publish', $buildProjectPath) }
      catch { $errorMessage = $_.Exception.Message }
      @{
        error = $errorMessage
        after = [Environment]::GetEnvironmentVariable('NuGetPackageSourceCredentials_azure-sdk-for-net')
      } | ConvertTo-Json -Compress
    `);
    expectSuccess(result);
    expect(JSON.parse(String(result.stdout))).toEqual({
      error: "dotnet publish failed with exit code 5.",
      after: null,
    });
  });

  it.each([
    ["linux-x64", "linux-musl-x64"],
    ["linux-arm64", "linux-musl-arm64"],
    ["linux-x64", "linux-x64"],
    ["linux-arm64", "linux-arm64"],
    ["win-x64", "win-arm64"],
    ["osx-x64", "osx-arm64"],
    ["win-x64", "win-x64"],
    ["win-arm64", "win-arm64"],
    ["osx-x64", "osx-x64"],
    ["osx-arm64", "osx-arm64"],
  ])("preserves the supported topology %s -> %s", (host, target) => {
    const result = runPowerShell(`
      Import-Module ${psQuote(join(scriptRoot, "NativePackaging.psm1"))} -Force
      Get-NativeBuildTopology -HostRuntimeIdentifier '${host}' -TargetRuntimeIdentifier '${target}' |
        ConvertTo-Json -Compress
    `);
    expectSuccess(result);
    const topology = JSON.parse(String(result.stdout)) as {
      TargetOperatingSystem: string;
      TargetArchitecture: string;
      UseMuslContainer: boolean;
    };
    expect(topology.TargetOperatingSystem).toBe(target.split("-")[0]);
    expect(topology.TargetArchitecture).toBe(target.split("-").at(-1));
    expect(topology.UseMuslContainer).toBe(target.includes("-musl-"));
  });

  it.each([
    ["linux-x64", "linux-musl-arm64"],
    ["linux-arm64", "linux-musl-x64"],
    ["win-x64", "linux-musl-x64"],
    ["linux-x64", "linux-arm64"],
    ["osx-arm64", "osx-x64"],
  ])("rejects unsupported topology %s -> %s", (host, target) => {
    const result = runPowerShell(`
      Import-Module ${psQuote(join(scriptRoot, "NativePackaging.psm1"))} -Force
      Get-NativeBuildTopology -HostRuntimeIdentifier '${host}' -TargetRuntimeIdentifier '${target}'
    `);
    expect(result.status).not.toBe(0);
  });
});
