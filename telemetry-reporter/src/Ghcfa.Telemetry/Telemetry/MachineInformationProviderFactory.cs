using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Creates the machine information provider for the current operating system.
/// </summary>
internal static class MachineInformationProviderFactory
{
    public static IMachineInformationProvider Create(ILoggerFactory loggerFactory)
    {
        ArgumentNullException.ThrowIfNull(loggerFactory);

        if (OperatingSystem.IsWindows())
        {
            return new WindowsMachineInformationProvider(
                loggerFactory.CreateLogger<WindowsMachineInformationProvider>());
        }

        if (OperatingSystem.IsLinux())
        {
            return new LinuxMachineInformationProvider(
                loggerFactory.CreateLogger<LinuxMachineInformationProvider>());
        }

        if (OperatingSystem.IsMacOS())
        {
            return new MacOsMachineInformationProvider(
                loggerFactory.CreateLogger<MacOsMachineInformationProvider>());
        }

        return new DefaultMachineInformationProvider(
            loggerFactory.CreateLogger<DefaultMachineInformationProvider>());
    }
}
