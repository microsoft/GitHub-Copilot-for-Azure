using Ghcfa.Telemetry.CommandLine;

namespace Ghcfa.Telemetry.Tests.CommandLine;

/// <summary>
/// Contains tests for telemetry command-line parsing.
/// </summary>
public sealed class PluginTelemetryCommandLineParserTests
{
    private readonly PluginTelemetryCommandLineParser _parser = new();

    [Fact]
    public void Parse_BindsAllOptions()
    {
        var result = _parser.Parse(
        [
            "--timestamp=2026-09-15T17:00:00Z",
            "--event-type", "skill_invocation",
            "--session-id", "session-1",
            "--client-type", "copilot-cli",
            "--client-name", "GitHub Copilot CLI",
            "--plugin-name", "azure",
            "--plugin-version", "1.2.3",
            "--skill-name", "azure-storage",
            "--skill-version", "2.0.0",
            "--tool-name", "azure-storage",
            "--file-reference", "azure-ai\\references\\auth-best-practices.md",
            "--debug",
            "--dangerously-write-support-logs-to-dir", "logs"
        ]);

        Assert.True(result.IsSuccess);
        var options = Assert.IsType<Models.PluginTelemetryOptions>(result.Options);
        Assert.Equal("2026-09-15T17:00:00Z", options.Timestamp);
        Assert.Equal("skill_invocation", options.EventType);
        Assert.Equal("session-1", options.SessionId);
        Assert.Equal("copilot-cli", options.ClientType);
        Assert.Equal("GitHub Copilot CLI", options.ClientName);
        Assert.Equal("azure", options.PluginName);
        Assert.Equal("1.2.3", options.PluginVersion);
        Assert.Equal("azure-storage", options.SkillName);
        Assert.Equal("2.0.0", options.SkillVersion);
        Assert.Equal("azure-storage", options.ToolName);
        Assert.Equal("azure-ai\\references\\auth-best-practices.md", options.FileReference);
        Assert.True(options.Debug);
        Assert.Equal("logs", options.DangerouslyWriteSupportLogsToDir);
    }

    [Theory]
    [InlineData("--debug", true)]
    [InlineData("--debug=true", true)]
    [InlineData("--debug=false", false)]
    public void Parse_BindsDebug(string debugArgument, bool expected)
    {
        var result = _parser.Parse(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session",
            debugArgument
        ]);

        Assert.True(result.IsSuccess);
        Assert.Equal(expected, result.Options!.Debug);
    }

    [Theory]
    [InlineData("true", true)]
    [InlineData("false", false)]
    public void Parse_BindsSeparatedDebugValue(string value, bool expected)
    {
        var result = _parser.Parse(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session",
            "--debug", value
        ]);

        Assert.True(result.IsSuccess);
        Assert.Equal(expected, result.Options!.Debug);
    }

    [Theory]
    [InlineData(new string[0], "Missing Required options: --timestamp, --event-type, --session-id")]
    [InlineData(new[] { "--event-type", "event", "--session-id", "session" }, "Missing Required options: --timestamp")]
    [InlineData(new[] { "--timestamp", "time", "--session-id", "session" }, "Missing Required options: --event-type")]
    [InlineData(new[] { "--timestamp", "time", "--event-type", "event" }, "Missing Required options: --session-id")]
    public void Parse_ReportsMissingRequiredOptions(string[] args, string expected)
    {
        var result = _parser.Parse(args);

        Assert.False(result.IsSuccess);
        Assert.Equal(expected, result.ErrorMessage);
    }

    [Theory]
    [InlineData(new[] { "--unknown", "value" }, "Unknown option '--unknown'.")]
    [InlineData(new[] { "timestamp" }, "Unexpected argument 'timestamp'.")]
    [InlineData(new[] { "--timestamp" }, "Option '--timestamp' requires a value.")]
    [InlineData(new[] { "--debug=maybe" }, "Option '--debug' requires a boolean value.")]
    public void Parse_ReportsMalformedArguments(string[] args, string expected)
    {
        var result = _parser.Parse(args);

        Assert.False(result.IsSuccess);
        Assert.Equal(expected, result.ErrorMessage);
    }

    [Fact]
    public void Parse_RejectsDuplicateOptions()
    {
        var result = _parser.Parse(
        [
            "--timestamp", "one",
            "--timestamp", "two"
        ]);

        Assert.Equal("Option '--timestamp' was specified more than once.", result.ErrorMessage);
    }

    [Theory]
    [InlineData("--help")]
    [InlineData("-h")]
    public void Parse_RecognizesHelp(string argument)
    {
        var result = _parser.Parse([argument]);

        Assert.True(result.ShowHelp);
        Assert.False(result.IsSuccess);
    }
}
