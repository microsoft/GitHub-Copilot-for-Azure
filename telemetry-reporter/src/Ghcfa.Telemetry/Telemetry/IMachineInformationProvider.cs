namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Provides stable device and hashed network identifiers for telemetry.
/// </summary>
internal interface IMachineInformationProvider
{
    Task<string> GetMacAddressHashAsync();

    Task<string?> GetOrCreateDeviceIdAsync();
}
