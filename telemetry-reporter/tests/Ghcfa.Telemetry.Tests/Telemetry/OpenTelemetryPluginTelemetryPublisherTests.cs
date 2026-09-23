using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Telemetry;

namespace Ghcfa.Telemetry.Tests.Telemetry;

/// <summary>
/// Contains tests for publishing telemetry through OpenTelemetry.
/// </summary>
public sealed class OpenTelemetryPluginTelemetryPublisherTests
{
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
