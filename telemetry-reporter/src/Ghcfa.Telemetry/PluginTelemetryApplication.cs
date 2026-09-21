using System.Diagnostics;
using System.Net;
using System.Text.Json;
using Ghcfa.Telemetry.CommandLine;
using Ghcfa.Telemetry.Models;
using Ghcfa.Telemetry.Telemetry;
using Ghcfa.Telemetry.Validation;

namespace Ghcfa.Telemetry;

/// <summary>
/// Runs the telemetry reporting command and writes its JSON response.
/// </summary>
public sealed class PluginTelemetryApplication(
    PluginTelemetryCommandLineParser parser,
    PluginTelemetryValidator validator,
    IPluginTelemetryPublisher publisher)
{
    private const string TroubleshootingUrl = "https://aka.ms/azmcp/troubleshooting";

    private readonly PluginTelemetryCommandLineParser _parser =
        parser ?? throw new ArgumentNullException(nameof(parser));
    private readonly PluginTelemetryValidator _validator =
        validator ?? throw new ArgumentNullException(nameof(validator));
    private readonly IPluginTelemetryPublisher _publisher =
        publisher ?? throw new ArgumentNullException(nameof(publisher));

    public static PluginTelemetryApplication CreateDefault() =>
        new(
            new PluginTelemetryCommandLineParser(),
            new PluginTelemetryValidator(PluginTelemetryAllowlist.LoadEmbedded()),
            new OpenTelemetryPluginTelemetryPublisher());

    public async Task<int> RunAsync(
        IReadOnlyList<string> args,
        TextWriter standardOutput,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(standardOutput);

        var parseResult = _parser.Parse(args);
        if (parseResult.ShowHelp)
        {
            await standardOutput.WriteLineAsync(HelpText.Value).ConfigureAwait(false);
            return 0;
        }

        if (!parseResult.IsSuccess)
        {
            return await WriteResponseAsync(
                standardOutput,
                new CommandResponse
                {
                    Status = HttpStatusCode.BadRequest,
                    Message = parseResult.ErrorMessage ?? "Invalid command line."
                }).ConfigureAwait(false);
        }

        var stopwatch = Stopwatch.StartNew();
        var options = parseResult.Options!;
        var validation = _validator.ValidateAndNormalize(options);
        if (!validation.IsValid)
        {
            stopwatch.Stop();
            return await WriteResponseAsync(
                standardOutput,
                new CommandResponse
                {
                    Status = validation.Status,
                    Message = validation.Message,
                    Duration = stopwatch.ElapsedMilliseconds
                }).ConfigureAwait(false);
        }

        CommandResponse response;
        try
        {
            await _publisher.PublishAsync(options, cancellationToken).ConfigureAwait(false);
            response = new CommandResponse();
        }
        catch (Exception exception)
        {
            response = new CommandResponse
            {
                Status = GetStatusCode(exception),
                Message =
                    $"{exception.Message}. To mitigate this issue, please refer to the troubleshooting guidelines here at {TroubleshootingUrl}."
            };
        }

        stopwatch.Stop();
        response.Duration = stopwatch.ElapsedMilliseconds;
        return await WriteResponseAsync(standardOutput, response).ConfigureAwait(false);
    }

    private static async Task<int> WriteResponseAsync(
        TextWriter standardOutput,
        CommandResponse response)
    {
        var json = JsonSerializer.Serialize(response, TelemetryJsonContext.Default.CommandResponse);
        await standardOutput.WriteLineAsync(json).ConfigureAwait(false);

        return response.Status >= HttpStatusCode.OK && response.Status < HttpStatusCode.Ambiguous
            ? 0
            : 1;
    }

    private static HttpStatusCode GetStatusCode(Exception exception) => exception switch
    {
        ArgumentException => HttpStatusCode.BadRequest,
        InvalidOperationException => HttpStatusCode.UnprocessableEntity,
        HttpRequestException httpException =>
            httpException.StatusCode ?? HttpStatusCode.ServiceUnavailable,
        _ => HttpStatusCode.InternalServerError
    };
}
