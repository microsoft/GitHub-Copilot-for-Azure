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
        Assert.Equal(string.Empty, response.RootElement.GetProperty("message").GetString());
        Assert.Equal(0, response.RootElement.GetProperty("results").GetArrayLength());
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

    private PluginTelemetryApplication CreateApplication() =>
        new(
            new PluginTelemetryCommandLineParser(),
            new PluginTelemetryValidator(PluginTelemetryAllowlist.LoadEmbedded()),
            _publisher);
}
