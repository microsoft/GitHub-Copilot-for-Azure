namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Abstracts access to environment variables.
/// </summary>
internal interface IEnvironmentVariables
{
    string? Get(string name);
}

/// <summary>
/// Reads environment variables from the current process.
/// </summary>
internal sealed class SystemEnvironmentVariables : IEnvironmentVariables
{
    public string? Get(string name) => Environment.GetEnvironmentVariable(name);
}
