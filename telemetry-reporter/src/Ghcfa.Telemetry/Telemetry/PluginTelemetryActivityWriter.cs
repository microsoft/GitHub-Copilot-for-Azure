using System.Diagnostics;
using System.Runtime.InteropServices;
using Ghcfa.Telemetry.Models;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Writes Azure MCP-compatible telemetry properties to activities.
/// </summary>
internal sealed class PluginTelemetryActivityWriter(
    ActivitySource activitySource,
    IMachineInformationProvider machineInformationProvider,
    string cloud)
{
    private readonly ActivitySource _activitySource =
        activitySource ?? throw new ArgumentNullException(nameof(activitySource));
    private readonly IMachineInformationProvider _machineInformationProvider =
        machineInformationProvider ?? throw new ArgumentNullException(nameof(machineInformationProvider));
    private readonly string _cloud = cloud;
    private IReadOnlyList<KeyValuePair<string, object?>>? _defaultTags;

    public async Task InitializeAsync()
    {
        var macAddressTask = _machineInformationProvider.GetMacAddressHashAsync();
        var deviceIdTask = _machineInformationProvider.GetOrCreateDeviceIdAsync();

        await Task.WhenAll((Task)macAddressTask, deviceIdTask).ConfigureAwait(false);

        _defaultTags =
        [
            new(TelemetryConstants.McpServerVersion, CompatibilityConstants.AzureMcpVersion),
            new(TelemetryConstants.McpServerName, CompatibilityConstants.AzureMcpServerName),
            new(TelemetryConstants.ServerMode, "namespace"),
            new(TelemetryConstants.Transport, "stdio"),
            new(TelemetryConstants.Host, RuntimeInformation.OSDescription),
            new(TelemetryConstants.ProcessorArchitecture, RuntimeInformation.ProcessArchitecture.ToString()),
            new(TelemetryConstants.Cloud, _cloud),
            new(TelemetryConstants.MacAddressHash, await macAddressTask.ConfigureAwait(false)),
            new(TelemetryConstants.DeviceId, await deviceIdTask.ConfigureAwait(false))
        ];
    }

    public Activity? Write(PluginTelemetryOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var defaultTags = _defaultTags
            ?? throw new InvalidOperationException("Telemetry activity writer has not been initialized.");

        var activity = _activitySource.StartActivity(TelemetryConstants.ActivityName);
        if (activity is null)
        {
            return null;
        }

        activity.AddTag(TelemetryConstants.EventId, Guid.NewGuid().ToString());
        foreach (var tag in defaultTags)
        {
            activity.AddTag(tag.Key, tag.Value);
        }

        AddTagIfNotEmpty(activity, "Plugin_EventType", options.EventType);
        AddTagIfNotEmpty(activity, "Plugin_SessionId", options.SessionId);
        AddTagIfNotEmpty(activity, "Plugin_ClientType", options.ClientType);
        AddTagIfNotEmpty(activity, "Plugin_ClientName", options.ClientName);
        AddTagIfNotEmpty(activity, "Plugin_PluginName", options.PluginName);
        AddTagIfNotEmpty(activity, "Plugin_PluginVersion", options.PluginVersion);
        AddTagIfNotEmpty(activity, "Plugin_SkillName", options.SkillName);
        AddTagIfNotEmpty(activity, "Plugin_SkillVersion", options.SkillVersion);
        AddTagIfNotEmpty(activity, "Plugin_ToolName", options.ToolName);
        AddTagIfNotEmpty(activity, "Plugin_Timestamp", options.Timestamp);
        AddTagIfNotEmpty(activity, "Plugin_FileReference", options.FileReference);

        activity.SetStatus(ActivityStatusCode.Ok);
        return activity;
    }

    private static void AddTagIfNotEmpty(Activity activity, string key, string? value)
    {
        if (!string.IsNullOrEmpty(value))
        {
            activity.AddTag(key, value);
        }
    }
}
