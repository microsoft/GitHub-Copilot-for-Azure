using System.Diagnostics;
using Azure.Monitor.OpenTelemetry.Exporter;
using Ghcfa.Telemetry.Logging;
using Ghcfa.Telemetry.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Publishes telemetry events through the configured OpenTelemetry exporters.
/// </summary>
public sealed class OpenTelemetryPluginTelemetryPublisher : IPluginTelemetryPublisher
{
    private readonly IEnvironmentVariables _environment;

    public OpenTelemetryPluginTelemetryPublisher()
        : this(new SystemEnvironmentVariables())
    {
    }

    internal OpenTelemetryPluginTelemetryPublisher(IEnvironmentVariables environment)
    {
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    }

    public async Task PublishAsync(
        PluginTelemetryOptions options,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(options);

        var settings = TelemetryExporterSettings.FromEnvironment(
            _environment,
            microsoftExporterAvailable: IsReleaseBuild);

        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            DisableDefaults = true
        });

        ConfigureLogging(builder.Logging, options);
        if (settings.TelemetryEnabled)
        {
            ConfigureOpenTelemetry(builder.Services, settings);
        }

        using var activitySource = new ActivitySource(
            CompatibilityConstants.AzureMcpServerName,
            CompatibilityConstants.AzureMcpVersion);
        using var host = builder.Build();
        await host.StartAsync(cancellationToken).ConfigureAwait(false);

        if (settings.TelemetryEnabled)
        {
            var machineInformationProvider = MachineInformationProviderFactory.Create(
                host.Services.GetRequiredService<ILoggerFactory>());
            var writer = new PluginTelemetryActivityWriter(
                activitySource,
                machineInformationProvider,
                AzureCloudResolver.Resolve(_environment));

            await writer.InitializeAsync().ConfigureAwait(false);
            using (writer.Write(options))
            {
            }

            host.Services.GetService<TracerProvider>()?.ForceFlush();
        }

        await host.StopAsync(cancellationToken).ConfigureAwait(false);
    }

    private static void ConfigureLogging(ILoggingBuilder logging, PluginTelemetryOptions options)
    {
        logging.ClearProviders();
        logging.AddEventSourceLogger();

        if (options.Debug)
        {
            logging.AddConsole(console =>
            {
                console.LogToStandardErrorThreshold = LogLevel.Debug;
                console.FormatterName = ConsoleFormatterNames.Simple;
            });
            logging.AddSimpleConsole(console =>
            {
                console.ColorBehavior = LoggerColorBehavior.Disabled;
                console.IncludeScopes = false;
                console.SingleLine = true;
                console.TimestampFormat = "[HH:mm:ss] ";
                console.UseUtcTimestamp = true;
            });
            logging.AddFilter<ConsoleLoggerProvider>(null, LogLevel.Debug);
            logging.SetMinimumLevel(LogLevel.Debug);
        }

        if (!string.IsNullOrWhiteSpace(options.DangerouslyWriteSupportLogsToDir))
        {
            logging.SetMinimumLevel(LogLevel.Debug);
            var supportLogDirectory = options.DangerouslyWriteSupportLogsToDir;
            logging.Services.AddSingleton<ILoggerProvider>(
                _ => new SupportFileLoggerProvider(supportLogDirectory));
        }
    }

    private static void ConfigureOpenTelemetry(
        IServiceCollection services,
        TelemetryExporterSettings settings)
    {
        var openTelemetry = services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(
                    CompatibilityConstants.OpenTelemetryServiceName,
                    serviceVersion: CompatibilityConstants.AzureMcpVersion)
                .AddTelemetrySdk())
            .WithTracing(tracing => tracing.AddSource(CompatibilityConstants.AzureMcpServerName));

        if (settings.UserApplicationInsightsConnectionString is { } userConnectionString)
        {
            openTelemetry
                .WithLogging(logging => logging.AddAzureMonitorLogExporter(
                    options => options.ConnectionString = userConnectionString,
                    name: "UserProvided"))
                .WithMetrics(metrics => metrics.AddAzureMonitorMetricExporter(
                    options => options.ConnectionString = userConnectionString,
                    name: "UserProvided"))
                .WithTracing(tracing => tracing.AddAzureMonitorTraceExporter(
                    options => options.ConnectionString = userConnectionString,
                    name: "UserProvided"));
        }

        if (settings.MicrosoftExporterEnabled)
        {
            openTelemetry
                .WithMetrics(metrics => metrics.AddAzureMonitorMetricExporter(
                    options =>
                    {
                        options.ConnectionString =
                            TelemetryExporterSettings.MicrosoftOwnedApplicationInsightsConnectionString;
                        options.SamplingRatio = 1.0f;
                        options.TracesPerSecond = null;
                    },
                    name: "Microsoft"))
                .WithTracing(tracing => tracing.AddAzureMonitorTraceExporter(
                    options =>
                    {
                        options.ConnectionString =
                            TelemetryExporterSettings.MicrosoftOwnedApplicationInsightsConnectionString;
                        options.SamplingRatio = 1.0f;
                        options.TracesPerSecond = null;
                    },
                    name: "Microsoft"));
        }

        if (settings.OtlpExporterEnabled)
        {
            openTelemetry
                .WithTracing(tracing => tracing.AddOtlpExporter())
                .WithMetrics(metrics => metrics.AddOtlpExporter())
                .WithLogging(logging => logging.AddOtlpExporter());
        }
    }

    private static bool IsReleaseBuild
    {
        get
        {
#if RELEASE
            return true;
#else
            return false;
#endif
        }
    }
}
