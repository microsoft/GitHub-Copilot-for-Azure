using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Provides shared machine identifier behavior for platform-specific providers.
/// </summary>
internal abstract class MachineInformationProviderBase(
    ILogger logger) : IMachineInformationProvider
{
    protected const string MicrosoftDirectory = "Microsoft";
    protected const string DeveloperToolsDirectory = "DeveloperTools";
    protected const string DeviceIdFileName = "deviceid";

    private readonly ILogger _logger = logger;

    public abstract Task<string?> GetOrCreateDeviceIdAsync();

    public Task<string> GetMacAddressHashAsync()
    {
        return Task.Run(() =>
        {
            try
            {
                var address = NetworkInterface.GetAllNetworkInterfaces()
                    .Where(networkInterface =>
                        networkInterface.OperationalStatus == OperationalStatus.Up &&
                        networkInterface.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                    .Select(networkInterface => networkInterface.GetPhysicalAddress().ToString())
                    .FirstOrDefault(value => !string.IsNullOrEmpty(value));

                if (address is null)
                {
                    return "N/A";
                }

                var hash = SHA256.HashData(Encoding.UTF8.GetBytes(address));
                return Convert.ToHexStringLower(hash);
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Unable to calculate MAC address hash.");
                return "N/A";
            }
        });
    }

    protected static string GenerateDeviceId() => Guid.NewGuid().ToString("D").ToLowerInvariant();
}
