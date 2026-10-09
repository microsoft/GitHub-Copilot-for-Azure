using Ghcfa.Telemetry.Models;

namespace Ghcfa.Telemetry.CommandLine;

/// <summary>
/// Parses command-line arguments into telemetry reporting options.
/// </summary>
public sealed class PluginTelemetryCommandLineParser
{
    private static readonly HashSet<string> s_booleanOptions = new(StringComparer.Ordinal)
    {
        "--debug"
    };

    private static readonly HashSet<string> s_valueOptions = new(StringComparer.Ordinal)
    {
        "--timestamp",
        "--event-type",
        "--session-id",
        "--client-type",
        "--client-name",
        "--plugin-name",
        "--plugin-version",
        "--skill-name",
        "--skill-version",
        "--tool-name",
        "--file-reference",
        "--dangerously-write-support-logs-to-dir"
    };

    public CommandLineParseResult Parse(IReadOnlyList<string> args)
    {
        ArgumentNullException.ThrowIfNull(args);

        if (args.Count == 1 && (args[0] is "--help" or "-h"))
        {
            return CommandLineParseResult.Help();
        }

        var values = new Dictionary<string, string?>(StringComparer.Ordinal);

        for (var index = 0; index < args.Count; index++)
        {
            var argument = args[index];
            if (!argument.StartsWith("--", StringComparison.Ordinal))
            {
                return CommandLineParseResult.Error($"Unexpected argument '{argument}'.");
            }

            var separatorIndex = argument.IndexOf('=');
            var optionName = separatorIndex >= 0 ? argument[..separatorIndex] : argument;
            var inlineValue = separatorIndex >= 0 ? argument[(separatorIndex + 1)..] : null;

            if (!s_valueOptions.Contains(optionName) && !s_booleanOptions.Contains(optionName))
            {
                return CommandLineParseResult.Error($"Unknown option '{optionName}'.");
            }

            if (values.ContainsKey(optionName))
            {
                return CommandLineParseResult.Error($"Option '{optionName}' was specified more than once.");
            }

            if (s_booleanOptions.Contains(optionName))
            {
                if (inlineValue is null)
                {
                    if (index + 1 < args.Count &&
                        !args[index + 1].StartsWith("--", StringComparison.Ordinal))
                    {
                        if (!bool.TryParse(args[index + 1], out var followingBooleanValue))
                        {
                            return CommandLineParseResult.Error(
                                $"Option '{optionName}' requires a boolean value.");
                        }

                        values.Add(optionName, followingBooleanValue.ToString());
                        index++;
                        continue;
                    }

                    values.Add(optionName, bool.TrueString);
                    continue;
                }

                if (!bool.TryParse(inlineValue, out var booleanValue))
                {
                    return CommandLineParseResult.Error($"Option '{optionName}' requires a boolean value.");
                }

                values.Add(optionName, booleanValue.ToString());
                continue;
            }

            string value;
            if (inlineValue is not null)
            {
                value = inlineValue;
            }
            else
            {
                if (index + 1 >= args.Count || args[index + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    return CommandLineParseResult.Error($"Option '{optionName}' requires a value.");
                }

                value = args[++index];
            }

            values.Add(optionName, value);
        }

        var missingOptions = new[] { "--timestamp", "--event-type", "--session-id" }
            .Where(option => !values.TryGetValue(option, out var value) || string.IsNullOrWhiteSpace(value))
            .ToArray();

        if (missingOptions.Length > 0)
        {
            return CommandLineParseResult.Error($"Missing Required options: {string.Join(", ", missingOptions)}");
        }

        return CommandLineParseResult.Success(new PluginTelemetryOptions
        {
            Timestamp = values["--timestamp"]!,
            EventType = values["--event-type"]!,
            SessionId = values["--session-id"]!,
            ClientType = GetValue(values, "--client-type"),
            ClientName = GetValue(values, "--client-name"),
            PluginName = GetValue(values, "--plugin-name"),
            PluginVersion = GetValue(values, "--plugin-version"),
            SkillName = GetValue(values, "--skill-name"),
            SkillVersion = GetValue(values, "--skill-version"),
            ToolName = GetValue(values, "--tool-name"),
            FileReference = GetValue(values, "--file-reference"),
            Debug = values.TryGetValue("--debug", out var debugValue) &&
                bool.TryParse(debugValue, out var debug) &&
                debug,
            DangerouslyWriteSupportLogsToDir = GetValue(values, "--dangerously-write-support-logs-to-dir")
        });
    }

    private static string? GetValue(IReadOnlyDictionary<string, string?> values, string name) =>
        values.TryGetValue(name, out var value) ? value : null;
}
