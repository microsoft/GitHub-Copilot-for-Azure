using System.Net;
using System.Text.Json.Serialization;

namespace Ghcfa.Telemetry.Models;

/// <summary>
/// Represents the JSON response emitted by the telemetry reporter.
/// </summary>
public sealed class CommandResponse
{
    [JsonPropertyName("status")]
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("results")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Results { get; set; }

    [JsonPropertyName("duration")]
    public long Duration { get; set; }
}
