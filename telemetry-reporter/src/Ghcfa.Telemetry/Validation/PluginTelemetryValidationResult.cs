using System.Net;

namespace Ghcfa.Telemetry.Validation;

/// <summary>
/// Represents the result of validating a telemetry event.
/// </summary>
public sealed record PluginTelemetryValidationResult(
    bool IsValid,
    HttpStatusCode Status,
    string Message)
{
    public static PluginTelemetryValidationResult Success { get; } =
        new(true, HttpStatusCode.OK, string.Empty);

    public static PluginTelemetryValidationResult Forbidden(string message) =>
        new(false, HttpStatusCode.Forbidden, message);
}
