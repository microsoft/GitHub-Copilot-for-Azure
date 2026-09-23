using System.Diagnostics;
using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Telemetry;
using NSubstitute;

namespace Ghcfa.Telemetry.Tests.Telemetry;

/// <summary>
/// Contains tests for writing telemetry activity properties.
/// </summary>
public sealed class PluginTelemetryActivityWriterTests
{
    [Fact]
    public async Task Write_EmitsAzureMcpActivityAndAllPluginTags()
    {
        using var source = new ActivitySource(CompatibilityConstants.AzureMcpServerName);
        using var listener = CreateListener();
        var machine = Substitute.For<IMachineInformationProvider>();
        machine.GetMacAddressHashAsync().Returns("mac-hash");
        machine.GetOrCreateDeviceIdAsync().Returns("device-id");
        var writer = new PluginTelemetryActivityWriter(source, machine, "AzurePublicCloud");
        await writer.InitializeAsync();

        var options = new PluginTelemetryOptions
        {
            Timestamp = "2026-09-15T17:00:00Z",
            EventType = "skill_invocation",
            SessionId = "session-1",
            ClientType = "copilot-cli",
            ClientName = "GitHub Copilot CLI",
            PluginName = "azure",
            PluginVersion = "1.0.0",
            SkillName = "azure-storage",
            SkillVersion = "2.0.0",
            ToolName = "storage",
            FileReference = "azure-ai\\references\\auth-best-practices.md"
        };

        using var activity = writer.Write(options);

        Assert.NotNull(activity);
        Assert.Equal("PluginExecuted", activity!.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Equal("skill_invocation", activity.GetTagItem("Plugin_EventType"));
        Assert.Equal("session-1", activity.GetTagItem("Plugin_SessionId"));
        Assert.Equal("copilot-cli", activity.GetTagItem("Plugin_ClientType"));
        Assert.Equal("GitHub Copilot CLI", activity.GetTagItem("Plugin_ClientName"));
        Assert.Equal("azure", activity.GetTagItem("Plugin_PluginName"));
        Assert.Equal("1.0.0", activity.GetTagItem("Plugin_PluginVersion"));
        Assert.Equal("azure-storage", activity.GetTagItem("Plugin_SkillName"));
        Assert.Equal("2.0.0", activity.GetTagItem("Plugin_SkillVersion"));
        Assert.Equal("storage", activity.GetTagItem("Plugin_ToolName"));
        Assert.Equal("2026-09-15T17:00:00Z", activity.GetTagItem("Plugin_Timestamp"));
        Assert.Equal(
            "azure-ai\\references\\auth-best-practices.md",
            activity.GetTagItem("Plugin_FileReference"));
        Assert.Equal(CompatibilityConstants.AzureMcpServerName, activity.GetTagItem("McpServerNameV2"));
        Assert.Equal(CompatibilityConstants.AzureMcpVersion, activity.GetTagItem("Version"));
        Assert.Equal("namespace", activity.GetTagItem("ServerMode"));
        Assert.Equal("stdio", activity.GetTagItem("Transport"));
        Assert.Equal("AzurePublicCloud", activity.GetTagItem("Cloud"));
        Assert.Equal("mac-hash", activity.GetTagItem("MacAddressHash"));
        Assert.Equal("device-id", activity.GetTagItem("DevDeviceId"));
        Assert.NotNull(activity.GetTagItem("EventId"));
        Assert.NotNull(activity.GetTagItem("Host"));
        Assert.NotNull(activity.GetTagItem("ProcessorArchitecture"));
    }

    [Fact]
    public async Task Write_OmitsEmptyOptionalPluginTags()
    {
        using var source = new ActivitySource(CompatibilityConstants.AzureMcpServerName);
        using var listener = CreateListener();
        var machine = Substitute.For<IMachineInformationProvider>();
        machine.GetMacAddressHashAsync().Returns("mac-hash");
        machine.GetOrCreateDeviceIdAsync().Returns((string?)null);
        var writer = new PluginTelemetryActivityWriter(source, machine, "AzurePublicCloud");
        await writer.InitializeAsync();

        using var activity = writer.Write(new PluginTelemetryOptions
        {
            Timestamp = "timestamp",
            EventType = "event",
            SessionId = "session"
        });

        Assert.NotNull(activity);
        Assert.Null(activity!.GetTagItem("Plugin_ClientType"));
        Assert.Null(activity.GetTagItem("Plugin_ClientName"));
        Assert.Null(activity.GetTagItem("Plugin_PluginName"));
        Assert.Null(activity.GetTagItem("Plugin_SkillName"));
        Assert.Null(activity.GetTagItem("Plugin_ToolName"));
        Assert.Null(activity.GetTagItem("Plugin_FileReference"));
    }

    [Fact]
    public void Write_RequiresInitialization()
    {
        using var source = new ActivitySource(CompatibilityConstants.AzureMcpServerName);
        var machine = Substitute.For<IMachineInformationProvider>();
        var writer = new PluginTelemetryActivityWriter(source, machine, "AzurePublicCloud");

        Assert.Throws<InvalidOperationException>(() => writer.Write(new PluginTelemetryOptions
        {
            Timestamp = "timestamp",
            EventType = "event",
            SessionId = "session"
        }));
    }

    private static ActivityListener CreateListener()
    {
        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == CompatibilityConstants.AzureMcpServerName,
            Sample = static (ref ActivityCreationOptions<ActivityContext> _) =>
                ActivitySamplingResult.AllData
        };
        ActivitySource.AddActivityListener(listener);
        return listener;
    }
}
