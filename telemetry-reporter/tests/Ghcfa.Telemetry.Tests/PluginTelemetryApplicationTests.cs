using System.Net;
using System.Text.Json;
using Ghcfa.Telemetry.CommandLine;
using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Telemetry;
using Ghcfa.Telemetry.Validation;
using NSubstitute;

namespace Ghcfa.Telemetry.Tests;

/// <summary>
/// Contains tests for the telemetry reporting application.
/// </summary>
public sealed class PluginTelemetryApplicationTests
{
    private readonly IPluginTelemetryPublisher _publisher =
        Substitute.For<IPluginTelemetryPublisher>();

    [Fact]
    public async Task RunAsync_WritesSuccessfulAzureMcpResponse()
    {
        var application = CreateApplication();
        using var output = new StringWriter();

        var exitCode = await application.RunAsync(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session",
            "--tool-name", "azure-storage"
        ],
        output,
        TestContext.Current.CancellationToken);

        Assert.Equal(0, exitCode);
        using var response = JsonDocument.Parse(output.ToString());
        Assert.Equal(200, response.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("Success", response.RootElement.GetProperty("message").GetString());
        Assert.False(response.RootElement.TryGetProperty("results", out _));
        await _publisher.Received(1).PublishAsync(
            Arg.Is<PluginTelemetryOptions>(options => options.ToolName == "storage"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_WritesBadRequestForParserErrors()
    {
        var application = CreateApplication();
        using var output = new StringWriter();

        var exitCode = await application.RunAsync(
            ["--event-type", "event"],
            output,
            TestContext.Current.CancellationToken);

        Assert.Equal(1, exitCode);
        using var response = JsonDocument.Parse(output.ToString());
        Assert.Equal(400, response.RootElement.GetProperty("status").GetInt32());
        Assert.Equal(
            "Missing Required options: --timestamp, --session-id",
            response.RootElement.GetProperty("message").GetString());
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(
            default!,
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_WritesForbiddenForRejectedTelemetryValue()
    {
        var application = CreateApplication();
        using var output = new StringWriter();

        var exitCode = await application.RunAsync(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session",
            "--skill-name", "custom-skill"
        ],
        output,
        TestContext.Current.CancellationToken);

        Assert.Equal(1, exitCode);
        using var response = JsonDocument.Parse(output.ToString());
        Assert.Equal(403, response.RootElement.GetProperty("status").GetInt32());
        Assert.False(response.RootElement.TryGetProperty("results", out _));
    }

    [Fact]
    public async Task RunAsync_MapsPublisherExceptions()
    {
        _publisher.PublishAsync(Arg.Any<PluginTelemetryOptions>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new HttpRequestException(
                "ingestion unavailable",
                null,
                HttpStatusCode.ServiceUnavailable));
        var application = CreateApplication();
        using var output = new StringWriter();

        var exitCode = await application.RunAsync(
        [
            "--timestamp", "timestamp",
            "--event-type", "event",
            "--session-id", "session"
        ],
        output,
        TestContext.Current.CancellationToken);

        Assert.Equal(1, exitCode);
        using var response = JsonDocument.Parse(output.ToString());
        Assert.Equal(503, response.RootElement.GetProperty("status").GetInt32());
        Assert.Contains("https://aka.ms/azmcp/troubleshooting", output.ToString());
    }

    [Fact]
    public async Task RunAsync_WritesHelpWithoutPublishing()
    {
        var application = CreateApplication();
        using var output = new StringWriter();

        var exitCode = await application.RunAsync(
            ["--help"],
            output,
            TestContext.Current.CancellationToken);

        Assert.Equal(0, exitCode);
        Assert.Contains("ghcfa-telem --timestamp", output.ToString());
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(
            default!,
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_PublishesUsingAllFileOverrides()
    {
        using var skills = new TemporaryAllowlistFile("custom-skill");
        using var references = new TemporaryAllowlistFile("custom-skill/references/new.md");
        using var tools = new TemporaryAllowlistFile("""
            {"commands":{"Initial":["custom_tool"]},"areas":{},"extensionTools":{}}
            """);

        var result = await ExecuteAsync(CreateApplication(),
            "--allowed-skills", skills.Path,
            "--allowed-references", references.Path,
            "--allowed-tools", tools.Path,
            "--skill-name", "custom-skill",
            "--file-reference", "custom-skill/references/new.md",
            "--tool-name", "azure-custom_tool");

        Assert.Equal(0, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(200, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.Received(1).PublishAsync(
            Arg.Is<PluginTelemetryOptions>(options =>
                options.SkillName == "custom-skill" &&
                options.FileReference == "custom-skill/references/new.md" &&
                options.ToolName == "custom_tool"),
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("custom/references/new.md", "custom\\references\\new.md")]
    [InlineData("custom\\references\\new.md", "custom/references/new.md")]
    [InlineData("custom/references/new.md", "custom/references/new.md")]
    [InlineData("custom\\references\\new.md", "custom\\references\\new.md")]
    [InlineData("custom\\references/new.md", "custom/references\\new.md")]
    public async Task RunAsync_NormalizesReferenceMatchingWithoutChangingTelemetry(string entry, string reportedPath)
    {
        using var file = new TemporaryAllowlistFile(entry);

        var result = await ExecuteAsync(CreateApplication(),
            "--allowed-references", file.Path, "--file-reference", reportedPath);

        Assert.Equal(0, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(200, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.Received(1).PublishAsync(
            Arg.Is<PluginTelemetryOptions>(options => options.FileReference == reportedPath),
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("--allowed-skills", "missing")]
    [InlineData("--allowed-references", "missing")]
    [InlineData("--allowed-tools", "missing")]
    [InlineData("--allowed-skills", "directory")]
    [InlineData("--allowed-references", "directory")]
    [InlineData("--allowed-tools", "directory")]
    [InlineData("--allowed-skills", "invalid")]
    [InlineData("--allowed-references", "invalid")]
    [InlineData("--allowed-tools", "invalid")]
    public async Task RunAsync_FailsClosedForInvalidFilesEvenWithoutEventValues(string option, string failure)
    {
        using var file = new TemporaryAllowlistFile("custom-entry");
        var path = failure switch
        {
            "missing" => file.Path + ".missing",
            "directory" => Path.GetDirectoryName(file.Path)!,
            _ => file.Path + '\0'
        };

        var result = await ExecuteAsync(CreateApplication(), option, path);

        Assert.Equal(1, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(400, response.RootElement.GetProperty("status").GetInt32());
        Assert.Contains("Unable to read allowlist file", response.RootElement.GetProperty("message").GetString());
        Assert.False(response.RootElement.TryGetProperty("results", out _));
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_FailsClosedForLockedFile()
    {
        using var file = new TemporaryAllowlistFile("custom-entry");
        using var locked = File.Open(file.Path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);

        var result = await ExecuteAsync(CreateApplication(), "--allowed-skills", file.Path);

        Assert.Equal(1, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(400, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData("")]
    [InlineData("custom_tool")]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("null")]
    [InlineData("""{"commands":{},"areas":{}}""")]
    [InlineData("""{"commands":{},"extensionTools":{}}""")]
    [InlineData("""{"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":[],"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":{},"areas":null,"extensionTools":{}}""")]
    [InlineData("""{"commands":{},"areas":{},"extensionTools":[]}""")]
    [InlineData("""{"commands":{"Initial":[]},"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":{},"areas":{"Initial":"storage"},"extensionTools":{}}""")]
    [InlineData("""{"commands":{},"areas":{},"extensionTools":{"Initial":[null]}}""")]
    [InlineData("""{"commands":{"Initial":[1]},"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":{"Initial":[""]},"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":{"Initial":[" "]},"areas":{},"extensionTools":{}}""")]
    [InlineData("""{"commands":{},"areas":{},"extensionTools":{},"tools":{}}""")]
    [InlineData("""{"commands":{},"commands":{},"areas":{},"extensionTools":{}}""")]
    public async Task RunAsync_FailsClosedForMalformedToolJson(string contents)
    {
        using var file = new TemporaryAllowlistFile(contents);

        var result = await ExecuteAsync(CreateApplication(),
            "--allowed-tools", file.Path, "--tool-name", "azure-storage");

        Assert.Equal(1, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(400, response.RootElement.GetProperty("status").GetInt32());
        var message = response.RootElement.GetProperty("message").GetString();
        Assert.Contains("Unable to read allowlist file", message);
        Assert.Contains(file.Path, message);
        Assert.False(response.RootElement.TryGetProperty("results", out _));
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_DoesNotRetainToolOverridesBetweenInvocations()
    {
        using var file = new TemporaryAllowlistFile("""
            {"commands":{"1.0.1":["custom_tool"]},"areas":{},"extensionTools":{}}
            """);
        var application = CreateApplication();

        var custom = await ExecuteAsync(application,
            "--allowed-tools", file.Path, "--tool-name", "azure-custom_tool");
        var embedded = await ExecuteAsync(application, "--tool-name", "azure-storage");
        var rejected = await ExecuteAsync(application, "--tool-name", "azure-custom_tool");

        Assert.Equal(0, custom.ExitCode);
        Assert.Equal(0, embedded.ExitCode);
        Assert.Equal(1, rejected.ExitCode);
        using var response = JsonDocument.Parse(rejected.Output);
        Assert.Equal(403, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.Received(2).PublishAsync(
            Arg.Any<PluginTelemetryOptions>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("--allowed-skills", "--skill-name", "azure-storage")]
    [InlineData("--allowed-references", "--file-reference", "azure-ai\\references\\auth-best-practices.md")]
    [InlineData("--allowed-tools", "--tool-name", "azure-storage")]
    public async Task RunAsync_EmptyOverrideRejectsBuiltInValues(string option, string eventOption, string value)
    {
        using var file = new TemporaryAllowlistFile(option == "--allowed-tools"
            ? """{"commands":{},"areas":{},"extensionTools":{}}"""
            : "");

        var result = await ExecuteAsync(CreateApplication(), option, file.Path, eventOption, value);

        Assert.Equal(1, result.ExitCode);
        using var response = JsonDocument.Parse(result.Output);
        Assert.Equal(403, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_DoesNotRetainOverridesBetweenInvocations()
    {
        using var file = new TemporaryAllowlistFile("custom-skill");
        var application = CreateApplication();

        var custom = await ExecuteAsync(application,
            "--allowed-skills", file.Path, "--skill-name", "custom-skill");
        var embedded = await ExecuteAsync(application, "--skill-name", "azure-storage");
        var rejected = await ExecuteAsync(application, "--skill-name", "custom-skill");

        Assert.Equal(0, custom.ExitCode);
        Assert.Equal(0, embedded.ExitCode);
        Assert.Equal(1, rejected.ExitCode);
        using var response = JsonDocument.Parse(rejected.Output);
        Assert.Equal(403, response.RootElement.GetProperty("status").GetInt32());
        await _publisher.Received(2).PublishAsync(
            Arg.Any<PluginTelemetryOptions>(), Arg.Any<CancellationToken>());
    }

    private static async Task<(int ExitCode, string Output)> ExecuteAsync(
        PluginTelemetryApplication application, params string[] additionalArgs)
    {
        using var output = new StringWriter();
        var exitCode = await application.RunAsync(
            ["--timestamp", "timestamp", "--event-type", "event", "--session-id", "session", .. additionalArgs],
            output,
            TestContext.Current.CancellationToken);
        return (exitCode, output.ToString());
    }

    private PluginTelemetryApplication CreateApplication() =>
        new(
            new PluginTelemetryCommandLineParser(),
            new PluginTelemetryValidator(PluginTelemetryAllowlist.LoadEmbedded()),
            _publisher);
}
