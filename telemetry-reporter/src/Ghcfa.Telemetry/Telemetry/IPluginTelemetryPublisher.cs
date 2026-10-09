using Ghcfa.Telemetry.Models;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Publishes validated plugin telemetry events.
/// </summary>
public interface IPluginTelemetryPublisher
{
    Task PublishAsync(PluginTelemetryOptions options, CancellationToken cancellationToken);
}
