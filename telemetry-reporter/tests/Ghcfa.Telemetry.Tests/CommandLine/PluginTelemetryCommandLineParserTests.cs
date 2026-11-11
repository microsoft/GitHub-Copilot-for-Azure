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
            "--allowed-skills", "allowed skills.txt",
            "--allowed-references", "references.txt",
            "--allowed-tools", "tools.json",
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
        Assert.Equal("allowed skills.txt", options.AllowedSkills);
        Assert.Equal("references.txt", options.AllowedReferences);
        Assert.Equal("tools.json", options.AllowedTools);
        Assert.True(options.Debug);
        Assert.Equal("logs", options.DangerouslyWriteSupportLogsToDir);
    }

    [Theory]
    [InlineData("--allowed-skills")]
    [InlineData("--allowed-references")]
    [InlineData("--allowed-tools")]
    public void Parse_BindsInlineAllowlistPaths(string option)
    {
        var result = _parser.Parse(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session",
            $"--allowed-skills={(option == "--allowed-skills" ? "lists with spaces/allowed.txt" : "skills.txt")}",
            $"--allowed-references={(option == "--allowed-references" ? "lists with spaces/allowed.txt" : "references.txt")}",
            $"--allowed-tools={(option == "--allowed-tools" ? "lists with spaces/allowed.txt" : "tools.json")}"
        ]);

        Assert.True(result.IsSuccess);
        var options = result.Options!;
        var path = option switch
        {
            "--allowed-skills" => options.AllowedSkills,
            "--allowed-references" => options.AllowedReferences,
            _ => options.AllowedTools
        };
        Assert.Equal("lists with spaces/allowed.txt", path);
    }

    [Fact]
    public void Parse_RejectsOmittedAllowlistPaths()
    {
        var result = _parser.Parse(
            ["--timestamp", "timestamp", "--event-type", "event", "--session-id", "session"]);

        Assert.False(result.IsSuccess);
        Assert.Equal("Missing Required options: --allowed-skills, --allowed-references, --allowed-tools",
            result.ErrorMessage);
    }

    [Theory]
    [InlineData("--allowed-skills")]
    [InlineData("--allowed-references")]
    [InlineData("--allowed-tools")]
    public void Parse_RejectsMalformedAllowlistOptions(string option)
    {
        Assert.Equal(
            $"Option '{option}' requires a value.",
            _parser.Parse([option]).ErrorMessage);
        Assert.Equal(
            $"Option '{option}' requires a value.",
            _parser.Parse([option, "--debug"]).ErrorMessage);
        Assert.Equal(
            $"Option '{option}' requires a non-empty path.",
            _parser.Parse([$"{option}="]).ErrorMessage);
        Assert.Equal(
            $"Option '{option}' requires a non-empty path.",
            _parser.Parse([option, " \t "]).ErrorMessage);
        Assert.Equal(
            $"Option '{option}' was specified more than once.",
            _parser.Parse([option, "first.txt", $"{option}=second.txt"]).ErrorMessage);
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
            "--allowed-skills", "skills.txt",
            "--allowed-references", "references.txt",
            "--allowed-tools", "tools.json",
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
            "--allowed-skills", "skills.txt",
            "--allowed-references", "references.txt",
            "--allowed-tools", "tools.json",
            "--debug", value
        ]);

        Assert.True(result.IsSuccess);
        Assert.Equal(expected, result.Options!.Debug);
    }

    [Theory]
    [InlineData("--timestamp")]
    [InlineData("--event-type")]
    [InlineData("--session-id")]
    [InlineData("--allowed-skills")]
    [InlineData("--allowed-references")]
    [InlineData("--allowed-tools")]
    public void Parse_ReportsMissingRequiredOptions(string missing)
    {
        var args = new[] { "--timestamp", "--event-type", "--session-id",
            "--allowed-skills", "--allowed-references", "--allowed-tools" }
            .Where(option => option != missing).SelectMany(option => new[] { option, "value" }).ToArray();
        var result = _parser.Parse(args);

        Assert.False(result.IsSuccess);
        Assert.Equal($"Missing Required options: {missing}", result.ErrorMessage);
    }

    [Fact]
    public void Parse_ReportsAllMissingRequiredOptions()
    {
        Assert.Equal(
            "Missing Required options: --timestamp, --event-type, --session-id, --allowed-skills, --allowed-references, --allowed-tools",
            _parser.Parse([]).ErrorMessage);
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
