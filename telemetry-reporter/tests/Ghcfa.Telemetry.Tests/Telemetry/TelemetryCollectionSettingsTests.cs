using Ghcfa.Telemetry.Telemetry;

namespace Ghcfa.Telemetry.Tests.Telemetry;

/// <summary>
/// Contains tests for deriving telemetry collection settings.
/// </summary>
public sealed class TelemetryCollectionSettingsTests
{
    [Fact]
    public void FromEnvironment_UsesAzureMcpDefaults()
    {
        var settings = TelemetryCollectionSettings.FromEnvironment(
            new TestEnvironment(),
            microsoftExporterAvailable: true);

        Assert.True(settings.TelemetryEnabled);
        Assert.True(settings.MicrosoftExporterEnabled);
    }

    [Fact]
    public void FromEnvironment_IgnoresExporterSettings()
    {
        var environment = new TestEnvironment
        {
            ["AZURE_MCP_COLLECT_TELEMETRY"] = "true",
            ["AZURE_MCP_COLLECT_TELEMETRY_MICROSOFT"] = "false",
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "InstrumentationKey=test",
            ["AZURE_MCP_ENABLE_OTLP_EXPORTER"] = "true"
        };

        var settings = TelemetryCollectionSettings.FromEnvironment(
            environment,
            microsoftExporterAvailable: true);

        Assert.True(settings.TelemetryEnabled);
        Assert.True(settings.MicrosoftExporterEnabled);
    }

    [Fact]
    public void FromEnvironment_DisablesAllTelemetry()
    {
        var environment = new TestEnvironment
        {
            ["AZURE_MCP_COLLECT_TELEMETRY"] = "false"
        };

        var settings = TelemetryCollectionSettings.FromEnvironment(
            environment,
            microsoftExporterAvailable: true);

        Assert.False(settings.TelemetryEnabled);
    }

    [Fact]
    public void FromEnvironment_DoesNotEnableMicrosoftExporterInDevelopmentBuild()
    {
        var settings = TelemetryCollectionSettings.FromEnvironment(
            new TestEnvironment(),
            microsoftExporterAvailable: false);

        Assert.False(settings.MicrosoftExporterEnabled);
    }

    [Fact]
    public void FromEnvironment_RejectsInvalidGlobalTelemetryValue()
    {
        var environment = new TestEnvironment
        {
            ["AZURE_MCP_COLLECT_TELEMETRY"] = "invalid"
        };

        Assert.Throws<ArgumentException>(() =>
            TelemetryCollectionSettings.FromEnvironment(
                environment,
                microsoftExporterAvailable: true));
    }

    [Theory]
    [InlineData(null, "AzurePublicCloud")]
    [InlineData("public", "AzurePublicCloud")]
    [InlineData("azurechina", "AzureChinaCloud")]
    [InlineData("usgov", "AzureUSGovernmentCloud")]
    public void AzureCloudResolver_MapsAzureMcpValues(string? value, string expected)
    {
        var environment = new TestEnvironment();
        if (value is not null)
        {
            environment["AZURE_CLOUD"] = value;
        }

        Assert.Equal(expected, AzureCloudResolver.Resolve(environment));
    }

    [Fact]
    public void AzureCloudResolver_RejectsUnknownCloud()
    {
        var environment = new TestEnvironment
        {
            ["AZURE_CLOUD"] = "moon"
        };

        Assert.Throws<ArgumentException>(() => AzureCloudResolver.Resolve(environment));
    }

    /// <summary>
    /// Provides configurable environment variables for telemetry settings tests.
    /// </summary>
    private sealed class TestEnvironment : IEnvironmentVariables
    {
        private readonly Dictionary<string, string?> _values = new(StringComparer.Ordinal);

        public string? this[string name]
        {
            set => _values[name] = value;
        }

        public string? Get(string name) =>
            _values.TryGetValue(name, out var value) ? value : null;
    }
}
