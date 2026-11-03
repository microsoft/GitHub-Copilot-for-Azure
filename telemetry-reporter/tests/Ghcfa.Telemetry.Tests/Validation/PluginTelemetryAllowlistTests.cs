using Ghcfa.Telemetry.Validation;

namespace Ghcfa.Telemetry.Tests.Validation;

/// <summary>
/// Contains tests for file-based allowlist loading and replacement.
/// </summary>
public sealed class PluginTelemetryAllowlistTests
{
    [Theory]
    [InlineData("\n", false)]
    [InlineData("\r\n", false)]
    [InlineData("\n", true)]
    [InlineData("\r\n", true)]
    public void WithOverrides_ReadsFlatLists(string newline, bool includeBom)
    {
        using var file = new TemporaryAllowlistFile(
            string.Join(newline, ["# Initial entries", "", "  custom-skill \t", "custom-skill",
                "  # First seen in 1.0.1", "other-skill", " \t "]),
            includeBom);

        var allowlist = PluginTelemetryAllowlist.LoadEmbedded().WithOverrides(file.Path, null, null);

        Assert.True(allowlist.IsSkillNameAllowed("custom-skill"));
        Assert.True(allowlist.IsSkillNameAllowed("other-skill"));
        Assert.False(allowlist.IsSkillNameAllowed("CUSTOM-SKILL"));
        Assert.False(allowlist.IsSkillNameAllowed("  custom-skill \t"));
        Assert.False(allowlist.IsSkillNameAllowed("# Initial entries"));
        Assert.False(allowlist.IsSkillNameAllowed(""));
        Assert.False(allowlist.IsSkillNameAllowed("azure-storage"));
        Assert.True(allowlist.IsFileReferenceAllowed("azure-ai\\references\\auth-best-practices.md"));
        Assert.True(allowlist.IsCommandAllowed("subscription_list"));
        Assert.True(allowlist.IsAreaAllowed("storage"));
        Assert.True(allowlist.IsExtensionToolAllowed("azure_auth-set_auth_context"));
    }

    [Theory]
    [InlineData("custom-skill/references/new.md")]
    [InlineData("custom-skill\\references\\new.md")]
    [InlineData("custom-skill\\references/new.md")]
    public void WithOverrides_NormalizesReferenceSeparators(string entry)
    {
        using var file = new TemporaryAllowlistFile(entry + "\n");
        var allowlist = PluginTelemetryAllowlist.LoadEmbedded().WithOverrides(null, file.Path, null);

        Assert.True(allowlist.IsFileReferenceAllowed("custom-skill/references/new.md"));
        Assert.True(allowlist.IsFileReferenceAllowed("custom-skill\\references\\new.md"));
        Assert.True(allowlist.IsFileReferenceAllowed("custom-skill/references\\new.md"));
        Assert.False(allowlist.IsFileReferenceAllowed("custom-skill/references/NEW.md"));
        Assert.False(allowlist.IsFileReferenceAllowed("azure-ai\\references\\auth-best-practices.md"));
        Assert.True(allowlist.IsSkillNameAllowed("azure-storage"));
    }

    [Fact]
    public void EmbeddedReferences_AcceptEitherSeparator()
    {
        var allowlist = PluginTelemetryAllowlist.LoadEmbedded();

        Assert.True(allowlist.IsFileReferenceAllowed("azure-ai\\references\\auth-best-practices.md"));
        Assert.True(allowlist.IsFileReferenceAllowed("azure-ai/references/auth-best-practices.md"));
        Assert.True(allowlist.IsFileReferenceAllowed("azure-ai/references\\auth-best-practices.md"));
        Assert.False(allowlist.IsFileReferenceAllowed("azure-ai/references/AUTH-BEST-PRACTICES.md"));
    }

    [Fact]
    public void WithOverrides_DoesNotMutateEmbeddedLists()
    {
        using var file = new TemporaryAllowlistFile("custom-entry");
        using var tools = new TemporaryAllowlistFile("""
            {
              "commands": {"Initial": ["custom-command"]},
              "areas": {"1.0": ["custom-area"]},
              "extensionTools": {"Azure extension": ["custom-helper"]}
            }
            """);
        var embedded = PluginTelemetryAllowlist.LoadEmbedded();

        var overridden = embedded.WithOverrides(file.Path, file.Path, tools.Path);

        Assert.True(overridden.IsSkillNameAllowed("custom-entry"));
        Assert.True(overridden.IsFileReferenceAllowed("custom-entry"));
        Assert.True(overridden.IsCommandAllowed("custom-command"));
        Assert.True(overridden.IsAreaAllowed("custom-area"));
        Assert.True(overridden.IsExtensionToolAllowed("custom-helper"));
        Assert.False(overridden.IsCommandAllowed("custom-area"));
        Assert.False(overridden.IsExtensionToolAllowed("custom-command"));
        Assert.False(overridden.IsAreaAllowed("custom-helper"));
        Assert.False(overridden.IsCommandAllowed("subscription_list"));
        Assert.False(overridden.IsAreaAllowed("storage"));
        Assert.False(overridden.IsExtensionToolAllowed("azure_auth-set_auth_context"));
        Assert.False(embedded.IsSkillNameAllowed("custom-entry"));
        Assert.False(embedded.IsFileReferenceAllowed("custom-entry"));
        Assert.False(embedded.IsCommandAllowed("custom-command"));
        Assert.True(embedded.IsSkillNameAllowed("azure-storage"));
        Assert.True(embedded.IsCommandAllowed("subscription_list"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("\n \t\n# No entries\n")]
    public void WithOverrides_EmptyListsAllowNothing(string contents)
    {
        using var file = new TemporaryAllowlistFile(contents);
        using var tools = new TemporaryAllowlistFile("""{"commands":{},"areas":{},"extensionTools":{}}""");
        var allowlist = PluginTelemetryAllowlist.LoadEmbedded().WithOverrides(file.Path, file.Path, tools.Path);

        Assert.False(allowlist.IsSkillNameAllowed("azure-storage"));
        Assert.False(allowlist.IsFileReferenceAllowed("azure-ai\\references\\auth-best-practices.md"));
        Assert.False(allowlist.IsCommandAllowed("subscription_list"));
        Assert.False(allowlist.IsAreaAllowed("storage"));
        Assert.False(allowlist.IsExtensionToolAllowed("azure_auth-set_auth_context"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void WithOverrides_UnionsNamedGroupsWithinEachToolSection(bool includeBom)
    {
        using var tools = new TemporaryAllowlistFile("""
            {
              "commands": {
                "Initial": ["custom_command", "another_command"],
                "1.0.1": ["custom_command", "new_command"]
              },
              "areas": {
                "Initial": ["custom-area", "another-area"],
                "Next release": ["new-area"]
              },
              "extensionTools": {
                "Azure extension": ["custom_helper", "another_helper"],
                "2.0.0": ["new_helper"]
              }
            }
            """, includeBom);

        var allowlist = PluginTelemetryAllowlist.LoadEmbedded().WithOverrides(null, null, tools.Path);

        Assert.True(allowlist.IsCommandAllowed("custom_command"));
        Assert.True(allowlist.IsCommandAllowed("another_command"));
        Assert.True(allowlist.IsCommandAllowed("new_command"));
        Assert.True(allowlist.IsAreaAllowed("custom-area"));
        Assert.True(allowlist.IsAreaAllowed("another-area"));
        Assert.True(allowlist.IsAreaAllowed("new-area"));
        Assert.True(allowlist.IsExtensionToolAllowed("custom_helper"));
        Assert.True(allowlist.IsExtensionToolAllowed("another_helper"));
        Assert.True(allowlist.IsExtensionToolAllowed("new_helper"));
        Assert.False(allowlist.IsCommandAllowed("Initial"));
        Assert.False(allowlist.IsAreaAllowed("Next release"));
        Assert.False(allowlist.IsExtensionToolAllowed("2.0.0"));
        Assert.False(allowlist.IsCommandAllowed("CUSTOM_COMMAND"));
        Assert.False(allowlist.IsAreaAllowed("CUSTOM-AREA"));
        Assert.False(allowlist.IsExtensionToolAllowed("CUSTOM_HELPER"));
        Assert.True(allowlist.IsSkillNameAllowed("azure-storage"));
        Assert.True(allowlist.IsFileReferenceAllowed("azure-ai/references/auth-best-practices.md"));
    }

    [Fact]
    public void WithOverrides_AcceptsRelativeFilePaths()
    {
        using var file = new TemporaryAllowlistFile("custom-skill");
        var relativePath = Path.GetRelativePath(Environment.CurrentDirectory, file.Path);
        var allowlist = PluginTelemetryAllowlist.LoadEmbedded().WithOverrides(relativePath, null, null);

        Assert.True(allowlist.IsSkillNameAllowed("custom-skill"));
    }
}
