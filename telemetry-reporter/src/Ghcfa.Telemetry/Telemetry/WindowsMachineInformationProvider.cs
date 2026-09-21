using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.Runtime.Versioning;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Reads and persists machine identifiers on Windows.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class WindowsMachineInformationProvider(
    ILogger<WindowsMachineInformationProvider> logger)
    : MachineInformationProviderBase(logger)
{
    private const RegistryHive Hive = RegistryHive.CurrentUser;
    private const string RegistryPath = $"SOFTWARE\\{MicrosoftDirectory}\\{DeveloperToolsDirectory}";

    private readonly ILogger<WindowsMachineInformationProvider> _logger = logger;

    public override Task<string?> GetOrCreateDeviceIdAsync()
    {
        return Task.Run<string?>(() =>
        {
            try
            {
                using var registry = RegistryKey.OpenBaseKey(Hive, RegistryView.Registry64);
                using var key = registry.OpenSubKey(RegistryPath, writable: false);
                var matchingName = key?.GetValueNames()
                    .SingleOrDefault(name => string.Equals(name, DeviceIdFileName, StringComparison.OrdinalIgnoreCase));
                var existingValue = matchingName is null ? null : key?.GetValue(matchingName)?.ToString();
                if (!string.IsNullOrEmpty(existingValue))
                {
                    return existingValue;
                }
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Unable to fetch {Key} value from {RegistryRoot}.",
                    DeviceIdFileName,
                    RegistryPath);
            }

            var deviceId = GenerateDeviceId();

            try
            {
                using var registry = RegistryKey.OpenBaseKey(Hive, RegistryView.Registry64);
                using var key = registry.OpenSubKey(RegistryPath, writable: true)
                    ?? registry.CreateSubKey(RegistryPath, RegistryKeyPermissionCheck.ReadWriteSubTree);
                key?.SetValue(DeviceIdFileName, deviceId, RegistryValueKind.String);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Unable to persist {Key} in {RegistryPath}.",
                    DeviceIdFileName,
                    RegistryPath);
            }

            return deviceId;
        });
    }
}
