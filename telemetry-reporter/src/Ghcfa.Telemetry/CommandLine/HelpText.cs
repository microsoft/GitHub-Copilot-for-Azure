namespace Ghcfa.Telemetry.CommandLine;

/// <summary>
/// Provides the telemetry reporter command-line help text.
/// </summary>
public static class HelpText
{
    public const string Value = """
        Usage:
          ghcfa-telem --timestamp <value> --event-type <value> --session-id <value> [options]

        Required options:
          --timestamp <value>       Timestamp of the telemetry event in ISO 8601 format.
          --event-type <value>      Event type, such as skill_invocation, tool_invocation, or reference_file_read.
          --session-id <value>      Session identifier for correlating related events.

        Optional values:
          --client-type <value>
          --client-name <value>
          --plugin-name <value>
          --plugin-version <value>
          --skill-name <value>
          --skill-version <value>
          --tool-name <value>
          --file-reference <value>
          --allowed-skills <path>       Replace the built-in skill allowlist.
          --allowed-references <path>   Replace the built-in reference-file allowlist.
          --allowed-tools <path>        Replace all built-in tool allowlists using grouped JSON.
          --dangerously-write-support-logs-to-dir <path>

        Allowlist files:
          Matching is case-sensitive. All files use UTF-8.
          Skills and references: one name or path per line.
          Surrounding whitespace, blank lines, and # comment lines are ignored in these text files.
          Reference entries and reported paths match with either / or \ separators.
          Tools: JSON with required commands, areas, and extensionTools object sections.
          Each section maps entry labels to non-empty arrays of names.
          Example: {"commands":{"1.0":["subscription_list"]},"areas":{},"extensionTools":{}}
          Omitted files use built-in lists. Empty text files or JSON sections allow no values.
          Unreadable files or malformed tool JSON fail without publishing telemetry.
          Relative file paths are resolved against the current working directory.

        Flags:
          --debug
          --help, -h
        """;
}
