namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Represents telemetry exporter settings derived from environment variables.
/// </summary>
internal sealed record TelemetryExporterSettings(
    bool TelemetryEnabled,
    bool MicrosoftExporterEnabled,
    string? UserApplicationInsightsConnectionString,
    bool OtlpExporterEnabled)
{
    public const string MicrosoftOwnedApplicationInsightsConnectionString =
        "InstrumentationKey=21e003c0-efee-4d3f-8a98-1868515aa2c9;" +
        "IngestionEndpoint=https://centralus-2.in.applicationinsights.azure.com/;" +
        "LiveEndpoint=https://centralus.livediagnostics.monitor.azure.com/;" +
        "ApplicationId=f14f6a2d-6405-4f88-bd58-056f25fe274f";

    public static TelemetryExporterSettings FromEnvironment(
        IEnvironmentVariables environment,
        bool microsoftExporterAvailable)
    {
        ArgumentNullException.ThrowIfNull(environment);

        var telemetryEnabled = ParseBoolean(
            environment.Get("AZURE_MCP_COLLECT_TELEMETRY"),
            defaultValue: true,
            "AZURE_MCP_COLLECT_TELEMETRY");

        var microsoftSetting = environment.Get("AZURE_MCP_COLLECT_TELEMETRY_MICROSOFT");
        var microsoftEnabled = microsoftExporterAvailable &&
            (string.IsNullOrWhiteSpace(microsoftSetting) ||
             (bool.TryParse(microsoftSetting, out var collectMicrosoft) && collectMicrosoft));

        var userConnectionString = environment.Get("APPLICATIONINSIGHTS_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(userConnectionString))
        {
            userConnectionString = null;
        }

        var otlpSetting = environment.Get("AZURE_MCP_ENABLE_OTLP_EXPORTER");
        var otlpEnabled = !string.IsNullOrEmpty(otlpSetting) &&
            bool.TryParse(otlpSetting, out var enableOtlp) &&
            enableOtlp;

        return new TelemetryExporterSettings(
            telemetryEnabled,
            microsoftEnabled,
            userConnectionString,
            otlpEnabled);
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
