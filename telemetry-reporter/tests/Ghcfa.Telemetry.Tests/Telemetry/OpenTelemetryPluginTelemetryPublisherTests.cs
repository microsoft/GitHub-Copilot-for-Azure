using System.Diagnostics;
using System.Reflection;
using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Telemetry;
using OpenTelemetry.Resources;

namespace Ghcfa.Telemetry.Tests.Telemetry;

/// <summary>
/// Contains tests for publishing telemetry through OpenTelemetry.
/// </summary>
public sealed class OpenTelemetryPluginTelemetryPublisherTests
{
    [Fact]
    public void ProductVersion_MatchesAssemblyInformationalVersion()
    {
        var version = typeof(OpenTelemetryPluginTelemetryPublisher).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>();

        Assert.NotNull(version);
        Assert.NotEmpty(version.InformationalVersion);
        Assert.Equal(TelemetryConstants.ProductVersion, version.InformationalVersion);
    }

    [Fact]
    public void ConfigureResource_UsesReporterVersionAndAzureMcpServiceName()
    {
        var builder = ResourceBuilder.CreateEmpty();

        OpenTelemetryPluginTelemetryPublisher.ConfigureResource(builder);

        var attributes = builder.Build().Attributes.ToDictionary();
        Assert.Equal(
            CompatibilityConstants.OpenTelemetryServiceName,
            attributes["service.name"]);
        Assert.Equal(TelemetryConstants.ProductVersion, attributes["service.version"]);
    }

    [Fact]
    public async Task PublishAsync_UsesReporterVersionAndAzureMcpActivitySourceName()
    {
        ActivitySource? activitySource = null;
        using var listener = new ActivityListener
        {
            ShouldListenTo = source =>
            {
                if (source.Name == CompatibilityConstants.AzureMcpServerName &&
                    !string.IsNullOrEmpty(source.Version))
                {
                    activitySource = source;
                }

                return false;
            }
        };
        ActivitySource.AddActivityListener(listener);
        var publisher = new OpenTelemetryPluginTelemetryPublisher(
            new DisabledTelemetryEnvironment());

        await publisher.PublishAsync(
            new PluginTelemetryOptions
            {
                Timestamp = "timestamp",
                EventType = "event",
                SessionId = "session"
            },
            TestContext.Current.CancellationToken);

        Assert.NotNull(activitySource);
        Assert.Equal(CompatibilityConstants.AzureMcpServerName, activitySource.Name);
        Assert.Equal(TelemetryConstants.ProductVersion, activitySource.Version);
    }

    [Fact]
    public async Task PublishAsync_CreatesSupportLogWhenTelemetryIsDisabled()
    {
        var directory = Path.Combine(
            Path.GetTempPath(),
            "ghcfa-telem-tests",
            Guid.NewGuid().ToString("N"));

        try
        {
            var publisher = new OpenTelemetryPluginTelemetryPublisher(
                new DisabledTelemetryEnvironment());

            await publisher.PublishAsync(
                new PluginTelemetryOptions
                {
                    Timestamp = "timestamp",
                    EventType = "event",
                    SessionId = "session",
                    DangerouslyWriteSupportLogsToDir = directory
                },
                TestContext.Current.CancellationToken);

            Assert.Single(Directory.GetFiles(directory, "azmcp_*.log"));
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    /// <summary>
    /// Provides environment variables that disable telemetry for publisher tests.
    /// </summary>
    private sealed class DisabledTelemetryEnvironment : IEnvironmentVariables
    {
        public string? Get(string name) =>
            name == "AZURE_MCP_COLLECT_TELEMETRY" ? "false" : null;
    }
}
