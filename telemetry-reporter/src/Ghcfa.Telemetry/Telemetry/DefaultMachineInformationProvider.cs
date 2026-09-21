using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Provides machine identifiers by delegating to the current platform implementation.
/// </summary>
internal sealed class DefaultMachineInformationProvider(
    ILogger<DefaultMachineInformationProvider> logger)
    : MachineInformationProviderBase(logger)
{
    public override Task<string?> GetOrCreateDeviceIdAsync() => Task.FromResult<string?>(null);
}
