namespace Ghcfa.Telemetry.Models;

/// <summary>
/// Defines the telemetry event values accepted by the reporter.
/// </summary>
public sealed class PluginTelemetryOptions
{
    public required string Timestamp { get; init; }

    public required string EventType { get; init; }

    public required string SessionId { get; init; }

    public string? ClientType { get; init; }

    public string? ClientName { get; init; }

    public string? PluginName { get; init; }

    public string? PluginVersion { get; init; }

    public string? SkillName { get; init; }

    public string? SkillVersion { get; init; }

    public string? ToolName { get; set; }

    public string? FileReference { get; init; }

    public bool Debug { get; init; }

    public string? DangerouslyWriteSupportLogsToDir { get; init; }
}
