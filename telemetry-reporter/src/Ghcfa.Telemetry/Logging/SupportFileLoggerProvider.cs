using System.Globalization;
using Microsoft.Extensions.Logging;

namespace Ghcfa.Telemetry.Logging;

/// <summary>
/// Creates loggers that write diagnostic entries to a support file.
/// </summary>
internal sealed class SupportFileLoggerProvider : ILoggerProvider
{
    private readonly object _sync = new();
    private readonly StreamWriter _writer;

    public SupportFileLoggerProvider(string folderPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(folderPath);

        Directory.CreateDirectory(folderPath);
        var fileName = $"azmcp_{DateTime.Now.ToString("yyyyMMdd_HH", CultureInfo.InvariantCulture)}.log";
        _writer = new StreamWriter(Path.Combine(folderPath, fileName), append: true)
        {
            AutoFlush = true
        };
    }

    public ILogger CreateLogger(string categoryName) => new SupportFileLogger(categoryName, this);

    public void Dispose() => _writer.Dispose();

    private void Write(string message)
    {
        lock (_sync)
        {
            _writer.WriteLine(message);
        }
    }

    /// <summary>
    /// Writes formatted log entries through a support file logger provider.
    /// </summary>
    private sealed class SupportFileLogger(
        string categoryName,
        SupportFileLoggerProvider provider) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var entry =
                $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}] [{logLevel}] [{categoryName}] {formatter(state, exception)}";
            if (exception is not null)
            {
                entry += Environment.NewLine + exception;
            }

            provider.Write(entry);
        }
    }
}
