using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Validation;

namespace Ghcfa.Telemetry.Tests.Validation;

/// <summary>
/// Contains tests for telemetry event validation.
/// </summary>
public sealed class PluginTelemetryValidatorTests
{
    private readonly PluginTelemetryValidator _validator =
        new(PluginTelemetryAllowlist.LoadEmbedded());

    [Fact]
    public void EmbeddedToolSnapshot_MatchesPinnedAzureMcpRegistrySize()
    {
        var assembly = typeof(PluginTelemetryAllowlist).Assembly;

        var commands = PluginTelemetryAllowlist.LoadArray(
            assembly,
            "allowed-tool-names.json",
            "commands");
        var areas = PluginTelemetryAllowlist.LoadArray(
            assembly,
            "allowed-tool-names.json",
            "areas");

        Assert.Equal(419, commands.Count);
        Assert.Equal(66, areas.Count);
    }

    [Theory]
    [InlineData("mcp__plugin_azure_azure__pricing", "pricing")]
    [InlineData("mcp_azure_mcp_subscription_list", "subscription_list")]
    [InlineData("azure-group_resource_list", "group_resource_list")]
    [InlineData("server_plugin-telemetry", "server_plugin-telemetry")]
    [InlineData("azure_auth-set_auth_context", "azure_auth-set_auth_context")]
    [InlineData("azure_query_azure_resource_graph", "azure_query_azure_resource_graph")]
    public void ValidateAndNormalizeToolName_AcceptsKnownTools(
        string toolName,
        string expected)
    {
        Assert.Equal(expected, _validator.ValidateAndNormalizeToolName(toolName));
    }

    [Theory]
    [InlineData("mcp__plugin_azure_azure__server", "server")]
    [InlineData("mcp_azure_mcp_storage", "storage")]
    [InlineData("azure-get_azure_bestpractices", "get_azure_bestpractices")]
    public void ValidateAndNormalizeToolName_AcceptsKnownAreas(
        string toolName,
        string expected)
    {
        Assert.Equal(expected, _validator.ValidateAndNormalizeToolName(toolName));
    }

    [Theory]
    [InlineData("azure-fakeTool")]
    [InlineData("mcp_azure_documentation")]
    [InlineData("completely_unknown")]
    [InlineData("")]
    public void ValidateAndNormalizeToolName_RejectsUnknownTools(string toolName)
    {
        Assert.Null(_validator.ValidateAndNormalizeToolName(toolName));
    }

    [Theory]
    [InlineData("mcp__plugin_azure_azure__pricing", "pricing")]
    [InlineData("mcp_azure_mcp_monitor", "monitor")]
    [InlineData("azure-documentation", "documentation")]
    [InlineData("server_start", "server_start")]
    public void StripClientPrefix_MatchesAzureMcp(string toolName, string expected)
    {
        Assert.Equal(expected, PluginTelemetryValidator.StripClientPrefix(toolName));
    }

    [Fact]
    public void ValidateAndNormalize_RejectsUnknownSkill()
    {
        var options = CreateOptions();
        options = new PluginTelemetryOptions
        {
            Timestamp = options.Timestamp,
            EventType = options.EventType,
            SessionId = options.SessionId,
            SkillName = "custom-skill"
        };

        var result = _validator.ValidateAndNormalize(options);

        Assert.False(result.IsValid);
        Assert.Equal(
            "Skill name 'custom-skill' is not in the allowlist and will not be logged.",
            result.Message);
    }

    [Fact]
    public void ValidateAndNormalize_RejectsUnknownFileReference()
    {
        var options = new PluginTelemetryOptions
        {
            Timestamp = "timestamp",
            EventType = "event",
            SessionId = "session",
            FileReference = "custom\\file.md"
        };

        var result = _validator.ValidateAndNormalize(options);

        Assert.False(result.IsValid);
        Assert.Equal(
            "Plugin file reference 'custom\\file.md' is not in the allowlist and will not be logged.",
            result.Message);
    }

    [Fact]
    public void ValidateAndNormalize_AcceptsKnownValuesAndNormalizesTool()
    {
        var options = new PluginTelemetryOptions
        {
            Timestamp = "timestamp",
            EventType = "event",
            SessionId = "session",
            SkillName = "azure-storage",
            FileReference = "azure-ai\\references\\auth-best-practices.md",
            ToolName = "azure-storage"
        };

        var result = _validator.ValidateAndNormalize(options);

        Assert.True(result.IsValid);
        Assert.Equal("storage", options.ToolName);
    }

    [Theory]
    [InlineData("AZURE-STORAGE")]
    [InlineData("Azure-Storage")]
    public void ValidateAndNormalize_IsCaseSensitive(string skillName)
    {
        var options = new PluginTelemetryOptions
        {
            Timestamp = "timestamp",
            EventType = "event",
            SessionId = "session",
            SkillName = skillName
        };

        Assert.False(_validator.ValidateAndNormalize(options).IsValid);
    }

    private static PluginTelemetryOptions CreateOptions() => new()
    {
        Timestamp = "timestamp",
        EventType = "event",
        SessionId = "session"
    };
}
