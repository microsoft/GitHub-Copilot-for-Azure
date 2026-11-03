using System.Text;

namespace Ghcfa.Telemetry.Tests;

/// <summary>
/// Provides an isolated allowlist file that is deleted after a test.
/// </summary>
internal sealed class TemporaryAllowlistFile : IDisposable
{
    public TemporaryAllowlistFile(string contents, bool includeBom = false)
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"ghcfa-allowlist-{Guid.NewGuid():N}.txt");
        File.WriteAllText(Path, contents, new UTF8Encoding(includeBom));
    }

    public string Path { get; }

    public void Dispose() => File.Delete(Path);
}
