namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Represents telemetry collection settings derived from environment variables.
/// </summary>
internal sealed record TelemetryCollectionSettings(
    bool TelemetryEnabled,
    bool MicrosoftExporterEnabled)
{
    public static TelemetryCollectionSettings FromEnvironment(
        IEnvironmentVariables environment,
        bool microsoftExporterAvailable)
    {
        ArgumentNullException.ThrowIfNull(environment);

        var telemetryEnabled = ParseBoolean(
            environment.Get("AZURE_MCP_COLLECT_TELEMETRY"),
            defaultValue: true,
            "AZURE_MCP_COLLECT_TELEMETRY");

        return new TelemetryCollectionSettings(
            telemetryEnabled,
            microsoftExporterAvailable);
    }

    private static bool ParseBoolean(string? value, bool defaultValue, string variableName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return defaultValue;
        }

        if (bool.TryParse(value, out var parsedValue))
        {
            return parsedValue;
        }

        throw new ArgumentException(
            $"Environment variable '{variableName}' must be 'true' or 'false'.",
            variableName);
    }
}
