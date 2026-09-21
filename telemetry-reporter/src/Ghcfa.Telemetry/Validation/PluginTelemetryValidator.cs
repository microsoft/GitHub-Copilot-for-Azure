using Ghcfa.Telemetry.Models;

namespace Ghcfa.Telemetry.Validation;

/// <summary>
/// Validates and normalizes telemetry options against the embedded allowlist.
/// </summary>
public sealed class PluginTelemetryValidator(PluginTelemetryAllowlist allowlist)
{
    private static readonly string[] s_knownToolNamePrefixes =
    [
        "mcp__plugin_azure_azure__",
        "mcp_azure_mcp_",
        "azure-"
    ];

    private readonly PluginTelemetryAllowlist _allowlist =
        allowlist ?? throw new ArgumentNullException(nameof(allowlist));

    public PluginTelemetryValidationResult ValidateAndNormalize(PluginTelemetryOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (!string.IsNullOrWhiteSpace(options.FileReference) &&
            !_allowlist.IsFileReferenceAllowed(options.FileReference))
        {
            return PluginTelemetryValidationResult.Forbidden(
                $"Plugin file reference '{options.FileReference}' is not in the allowlist and will not be logged.");
        }

        if (!string.IsNullOrWhiteSpace(options.SkillName) &&
            !_allowlist.IsSkillNameAllowed(options.SkillName))
        {
            return PluginTelemetryValidationResult.Forbidden(
                $"Skill name '{options.SkillName}' is not in the allowlist and will not be logged.");
        }

        if (!string.IsNullOrWhiteSpace(options.ToolName))
        {
            var normalizedToolName = ValidateAndNormalizeToolName(options.ToolName);
            if (normalizedToolName is null)
            {
                return PluginTelemetryValidationResult.Forbidden(
                    $"Tool name '{options.ToolName}' is not a recognized azmcp command and will not be logged.");
            }

            options.ToolName = normalizedToolName;
        }

        return PluginTelemetryValidationResult.Success;
    }

    public string? ValidateAndNormalizeToolName(string toolName)
    {
        if (_allowlist.IsExtensionToolAllowed(toolName))
        {
            return toolName;
        }

        var normalizedName = StripClientPrefix(toolName);
        if (string.IsNullOrEmpty(normalizedName))
        {
            return null;
        }

        return _allowlist.IsCommandAllowed(normalizedName) || _allowlist.IsAreaAllowed(normalizedName)
            ? normalizedName
            : null;
    }

    public static string StripClientPrefix(string toolName)
    {
        ArgumentNullException.ThrowIfNull(toolName);

        foreach (var prefix in s_knownToolNamePrefixes)
        {
            if (toolName.StartsWith(prefix, StringComparison.Ordinal))
            {
                return toolName[prefix.Length..];
            }
        }

        return toolName;
    }
}
