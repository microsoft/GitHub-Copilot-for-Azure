using System.Text;
using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Provides shared device identifier persistence for Unix-based platforms.
/// </summary>
internal abstract class UnixMachineInformationProvider(
    ILogger logger) : MachineInformationProviderBase(logger)
{
    private readonly ILogger _logger = logger;

    protected abstract string GetStoragePath();

    public override async Task<string?> GetOrCreateDeviceIdAsync()
    {
        string cachePath;
        try
        {
            cachePath = Path.Combine(GetStoragePath(), MicrosoftDirectory, DeveloperToolsDirectory);
        }
        catch (InvalidOperationException exception)
        {
            _logger.LogWarning(exception, "Unable to find folder to cache device id to.");
            return null;
        }

        var fullPath = Path.Combine(cachePath, DeviceIdFileName);
        if (File.Exists(fullPath))
        {
            try
            {
                return await File.ReadAllTextAsync(fullPath, Encoding.UTF8).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Unable to read device id from {FullPath}.", fullPath);
            }
        }

        var deviceId = GenerateDeviceId();
        try
        {
            Directory.CreateDirectory(cachePath);
            await File.WriteAllTextAsync(fullPath, deviceId, Encoding.UTF8).ConfigureAwait(false);
            return deviceId;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unable to persist device id to {FullPath}.", fullPath);
            return null;
        }
    }
}
