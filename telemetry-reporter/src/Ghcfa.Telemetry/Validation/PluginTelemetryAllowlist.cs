using System.Text.Json;

namespace Ghcfa.Telemetry.Validation;

/// <summary>
/// Loads and queries file-based allowlists for telemetry event values.
/// </summary>
public sealed class PluginTelemetryAllowlist
{
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

    public bool IsFileReferenceAllowed(string value) =>
        !string.IsNullOrWhiteSpace(value) && _allowedFileReferences.Contains(NormalizeFileReference(value));

    public bool IsSkillNameAllowed(string value) =>
        !string.IsNullOrWhiteSpace(value) && _allowedSkillNames.Contains(value);

    public bool IsCommandAllowed(string value) => _allowedCommands.Contains(value);

    public bool IsAreaAllowed(string value) => _allowedAreas.Contains(value);

    public bool IsExtensionToolAllowed(string value) => _allowedExtensionTools.Contains(value);

    public static PluginTelemetryAllowlist Load(
        string allowedSkills,
        string allowedReferences,
        string allowedTools)
    {
        var skills = LoadFile(allowedSkills);
        var references = LoadFile(allowedReferences)
            .Select(NormalizeFileReference).ToHashSet(StringComparer.Ordinal);
        var (commands, areas, extensionTools) = LoadToolFile(allowedTools);

        return new PluginTelemetryAllowlist(
            references,
            skills,
            commands,
            areas,
            extensionTools);
    }

    private static string NormalizeFileReference(string value) => value.Replace('/', '\\');

    private static HashSet<string> LoadFile(string path)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(path);
            var values = new HashSet<string>(StringComparer.Ordinal);

            foreach (var line in File.ReadLines(path))
            {
                var value = line.Trim();
                if (value.Length > 0 && !value.StartsWith('#'))
                {
                    values.Add(value);
                }
            }

            return values;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or
            ArgumentException or NotSupportedException or System.Security.SecurityException)
        {
            throw new ArgumentException($"Unable to read allowlist file '{path}': {exception.Message}", exception);
        }
    }

    private static HashSet<string> LoadNestedValues(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var section) || section.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException($"Section '{propertyName}' must be an object containing named arrays.");
        }

        var values = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in section.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.Array ||
                property.Value.GetArrayLength() == 0)
            {
                throw new JsonException(
                    $"Entry '{propertyName}.{property.Name}' must be a non-empty array of names.");
            }

            foreach (var element in property.Value.EnumerateArray())
            {
                var value = element.ValueKind == JsonValueKind.String ? element.GetString() : null;
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new JsonException(
                        $"Entry '{propertyName}.{property.Name}' must contain only non-empty string names.");
                }

                values.Add(value);
            }
        }

        return values;
    }

    private static (HashSet<string> Commands, HashSet<string> Areas, HashSet<string> ExtensionTools)
        LoadToolFile(string path)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(path);
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                throw new JsonException("Tool allowlist must be a JSON object.");
            }

            var sections = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (property.Name is not ("commands" or "areas" or "extensionTools") ||
                    !sections.Add(property.Name))
                {
                    throw new JsonException($"Unknown or duplicate tool allowlist section '{property.Name}'.");
                }
            }

            return (
                LoadNestedValues(root, "commands"),
                LoadNestedValues(root, "areas"),
                LoadNestedValues(root, "extensionTools"));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or
            ArgumentException or NotSupportedException or System.Security.SecurityException or JsonException)
        {
            throw new ArgumentException($"Unable to read allowlist file '{path}': {exception.Message}", exception);
        }
    }
}
