using System.Reflection;
using System.Text.Json;

namespace Ghcfa.Telemetry.Validation;

/// <summary>
/// Loads and queries the embedded allowlists for telemetry event values.
/// </summary>
public sealed class PluginTelemetryAllowlist
{
    private const string ResourcePrefix = "Ghcfa.Telemetry.Resources.";

    private readonly HashSet<string> _allowedFileReferences;
    private readonly HashSet<string> _allowedSkillNames;
    private readonly HashSet<string> _allowedCommands;
    private readonly HashSet<string> _allowedAreas;
    private readonly HashSet<string> _allowedExtensionTools;

    private PluginTelemetryAllowlist(
        HashSet<string> allowedFileReferences,
        HashSet<string> allowedSkillNames,
        HashSet<string> allowedCommands,
        HashSet<string> allowedAreas,
        HashSet<string> allowedExtensionTools)
    {
        _allowedFileReferences = allowedFileReferences;
        _allowedSkillNames = allowedSkillNames;
        _allowedCommands = allowedCommands;
        _allowedAreas = allowedAreas;
        _allowedExtensionTools = allowedExtensionTools;
    }

    public static PluginTelemetryAllowlist LoadEmbedded()
    {
        var assembly = typeof(PluginTelemetryAllowlist).Assembly;

        return new PluginTelemetryAllowlist(
            LoadNestedValues(assembly, "allowed-plugin-file-references.json", "references"),
            LoadNestedValues(assembly, "allowed-skill-names.json", "skills"),
            LoadArray(assembly, "allowed-tool-names.json", "commands"),
            LoadArray(assembly, "allowed-tool-names.json", "areas"),
            LoadArray(assembly, "allowed-tool-names.json", "extensionTools"));
    }

    public bool IsFileReferenceAllowed(string value) =>
        !string.IsNullOrWhiteSpace(value) && _allowedFileReferences.Contains(value);

    public bool IsSkillNameAllowed(string value) =>
        !string.IsNullOrWhiteSpace(value) && _allowedSkillNames.Contains(value);

    public bool IsCommandAllowed(string value) => _allowedCommands.Contains(value);

    public bool IsAreaAllowed(string value) => _allowedAreas.Contains(value);

    public bool IsExtensionToolAllowed(string value) => _allowedExtensionTools.Contains(value);

    internal static HashSet<string> LoadNestedValues(Assembly assembly, string resourceName, string propertyName)
    {
        using var document = LoadDocument(assembly, resourceName);
        var values = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.GetProperty(propertyName).EnumerateObject())
        {
            foreach (var element in property.Value.EnumerateArray())
            {
                if (element.GetString() is { } value)
                {
                    values.Add(value);
                }
            }
        }

        return values;
    }

    internal static HashSet<string> LoadArray(Assembly assembly, string resourceName, string propertyName)
    {
        using var document = LoadDocument(assembly, resourceName);
        var values = new HashSet<string>(StringComparer.Ordinal);

        foreach (var element in document.RootElement.GetProperty(propertyName).EnumerateArray())
        {
            if (element.GetString() is { } value)
            {
                values.Add(value);
            }
        }

        return values;
    }

    private static JsonDocument LoadDocument(Assembly assembly, string resourceName)
    {
        var fullName = ResourcePrefix + resourceName;
        using var stream = assembly.GetManifestResourceStream(fullName)
            ?? throw new InvalidOperationException($"Embedded resource '{fullName}' was not found.");

        return JsonDocument.Parse(stream);
    }
}
