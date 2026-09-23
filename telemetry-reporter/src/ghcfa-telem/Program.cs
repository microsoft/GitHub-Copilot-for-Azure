using Ghcfa.Telemetry;

using var cancellationSource = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellationSource.Cancel();
};

var application = PluginTelemetryApplication.CreateDefault();
return await application.RunAsync(args, Console.Out, cancellationSource.Token);
