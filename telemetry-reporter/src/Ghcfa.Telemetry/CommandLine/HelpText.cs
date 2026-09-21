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
          --dangerously-write-support-logs-to-dir <path>

        Flags:
          --debug
          --help, -h
        """;
}
