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

    [Theory]
    [InlineData(true, false, false)]
    [InlineData(false, true, false)]
    [InlineData(false, false, true)]
    [InlineData(true, true, true)]
    public void ValidateAndNormalize_AppliesIndependentOverrides(bool skills, bool references, bool tools)
    {
        using var file = new TemporaryAllowlistFile("custom-skill\ncustom/reference.md\ncustom_tool");
        using var toolFile = new TemporaryAllowlistFile("""
            {"commands":{"Initial":["custom_tool"]},"areas":{},"extensionTools":{}}
            """);
        var options = CreateOptions(
            skillName: skills ? "custom-skill" : "azure-storage",
            fileReference: references ? "custom/reference.md" : "azure-ai\\references\\auth-best-practices.md",
            toolName: tools ? "azure-custom_tool" : "azure-storage",
            allowedSkills: skills ? file.Path : null,
            allowedReferences: references ? file.Path : null,
            allowedTools: tools ? toolFile.Path : null);

        Assert.True(_validator.ValidateAndNormalize(options).IsValid);
        Assert.Equal(tools ? "custom_tool" : "storage", options.ToolName);
    }

    [Theory]
    [InlineData("custom_tool", "custom_tool")]
    [InlineData("azure-custom_tool", "custom_tool")]
    [InlineData("mcp_azure_mcp_custom_tool", "custom_tool")]
    [InlineData("mcp__plugin_azure_azure__custom_tool", "custom_tool")]
    [InlineData("azure-custom_area", "custom_area")]
    [InlineData("mcp_azure_mcp_custom_area", "custom_area")]
    [InlineData("mcp__plugin_azure_azure__custom_area", "custom_area")]
    [InlineData("azure_auth-set_auth_context", "azure_auth-set_auth_context")]
    public void ValidateAndNormalize_NormalizesAllowedTools(string toolName, string expected)
    {
        using var file = new TemporaryAllowlistFile("""
            {
              "commands": {"Initial": ["custom_tool"]},
              "areas": {"1.0.1": ["custom_area"]},
              "extensionTools": {"Azure extension": ["azure_auth-set_auth_context"]}
            }
            """);
        var options = CreateOptions(toolName: toolName, allowedTools: file.Path);

        Assert.True(_validator.ValidateAndNormalize(options).IsValid);
        Assert.Equal(expected, options.ToolName);
    }

    [Theory]
    [InlineData("azure-storage")]
    [InlineData("mcp_azure_mcp_subscription_list")]
    [InlineData("azure_auth-set_auth_context")]
    [InlineData("CUSTOM_TOOL")]
    [InlineData("mcp_azure_documentation")]
    public void ValidateAndNormalize_RejectsToolsNotInOverride(string toolName)
    {
        using var file = new TemporaryAllowlistFile("""
            {"commands":{"Initial":["custom_tool"]},"areas":{},"extensionTools":{}}
            """);
        var options = CreateOptions(toolName: toolName, allowedTools: file.Path);

        Assert.False(_validator.ValidateAndNormalize(options).IsValid);
    }

    [Fact]
    public void ValidateAndNormalize_DoesNotTreatCommandsOrAreasAsVerbatimExtensionTools()
    {
        using var file = new TemporaryAllowlistFile("""
            {
              "commands": {"Initial": ["azure-command"]},
              "areas": {"Initial": ["azure-area"]},
              "extensionTools": {"Initial": ["azure-helper"]}
            }
            """);

        Assert.False(_validator.ValidateAndNormalize(
            CreateOptions(toolName: "azure-command", allowedTools: file.Path)).IsValid);
        Assert.False(_validator.ValidateAndNormalize(
            CreateOptions(toolName: "azure-area", allowedTools: file.Path)).IsValid);
        Assert.True(_validator.ValidateAndNormalize(
            CreateOptions(toolName: "azure-helper", allowedTools: file.Path)).IsValid);
    }

    [Fact]
    public void ValidateAndNormalize_RejectsSkillsAndReferencesExcludedByOverride()
    {
        using var file = new TemporaryAllowlistFile("custom-entry");

        Assert.False(_validator.ValidateAndNormalize(CreateOptions(
            skillName: "azure-storage", allowedSkills: file.Path)).IsValid);
        Assert.False(_validator.ValidateAndNormalize(CreateOptions(
            fileReference: "azure-ai\\references\\auth-best-practices.md",
            allowedReferences: file.Path)).IsValid);
    }

    private static PluginTelemetryOptions CreateOptions(
        string? skillName = null,
        string? fileReference = null,
        string? toolName = null,
        string? allowedSkills = null,
        string? allowedReferences = null,
        string? allowedTools = null) => new()
    {
        Timestamp = "timestamp",
        EventType = "event",
        SessionId = "session",
        SkillName = skillName,
        FileReference = fileReference,
        ToolName = toolName,
        AllowedSkills = allowedSkills,
        AllowedReferences = allowedReferences,
        AllowedTools = allowedTools
    };
}
