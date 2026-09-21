using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Reads and persists machine identifiers on macOS.
/// </summary>
internal sealed class MacOsMachineInformationProvider(
    ILogger<MacOsMachineInformationProvider> logger)
    : UnixMachineInformationProvider(logger)
{
    protected override string GetStoragePath()
    {
        var userPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (string.IsNullOrWhiteSpace(userPath))
        {
            userPath = Environment.GetEnvironmentVariable("HOME");
        }

        if (string.IsNullOrWhiteSpace(userPath))
        {
            throw new InvalidOperationException("macOS: Unable to get UserProfile or $HOME folder.");
        }

        return Path.Combine(userPath, "Library", "Application Support");
    }
}
