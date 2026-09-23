using Ghcfa.Telemetry.Models;

namespace Ghcfa.Telemetry.CommandLine;

/// <summary>
/// Represents the result of parsing telemetry reporter command-line arguments.
/// </summary>
public sealed record CommandLineParseResult(
    PluginTelemetryOptions? Options,
    string? ErrorMessage,
    bool ShowHelp)
{
    public bool IsSuccess => Options is not null;

    public static CommandLineParseResult Success(PluginTelemetryOptions options) => new(options, null, false);

    public static CommandLineParseResult Error(string message) => new(null, message, false);

    public static CommandLineParseResult Help() => new(null, null, true);
}
