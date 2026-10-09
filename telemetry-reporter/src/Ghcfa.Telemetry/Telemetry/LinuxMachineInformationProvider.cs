using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Reads and persists machine identifiers on Linux.
/// </summary>
internal sealed class LinuxMachineInformationProvider(
    ILogger<LinuxMachineInformationProvider> logger)
    : UnixMachineInformationProvider(logger)
{
    protected override string GetStoragePath()
    {
        var cachePath = Environment.GetEnvironmentVariable("XDG_CACHE_HOME");
        if (!string.IsNullOrWhiteSpace(cachePath))
        {
            return cachePath;
        }

        var userPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (string.IsNullOrWhiteSpace(userPath))
        {
            throw new InvalidOperationException("linux: Unable to get UserProfile or $HOME folder.");
        }

        return Path.Combine(userPath, ".cache");
    }
}
