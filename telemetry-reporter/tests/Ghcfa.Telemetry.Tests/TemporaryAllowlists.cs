using Ghcfa.Telemetry.Validation;

namespace Ghcfa.Telemetry.Tests;

/// <summary>
/// Provides small, explicit allowlist files for reporter tests.
/// </summary>
internal sealed class TemporaryAllowlists : IDisposable
{
    public TemporaryAllowlistFile Skills { get; } = new("azure-storage");

    public TemporaryAllowlistFile References { get; } = new("azure-ai/references/auth-best-practices.md");

    public TemporaryAllowlistFile Tools { get; } = new("""
        {
          "commands": {"Test commands": ["subscription_list", "group_resource_list", "server_plugin-telemetry"]},
          "areas": {"Test areas": ["pricing", "server", "storage", "get_azure_bestpractices"]},
          "extensionTools": {"Test helpers": ["azure_auth-set_auth_context", "azure_query_azure_resource_graph"]}
        }
        """);

    public string[] Arguments =>
    [
        "--allowed-skills", Skills.Path,
        "--allowed-references", References.Path,
        "--allowed-tools", Tools.Path
    ];

    public PluginTelemetryAllowlist Load(
        string? skills = null, string? references = null, string? tools = null) =>
        PluginTelemetryAllowlist.Load(skills ?? Skills.Path, references ?? References.Path, tools ?? Tools.Path);

    public void Dispose()
    {
        Skills.Dispose();
        References.Dispose();
        Tools.Dispose();
    }
}
