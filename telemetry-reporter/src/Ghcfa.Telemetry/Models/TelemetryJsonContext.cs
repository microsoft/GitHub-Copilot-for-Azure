using System.Text.Json.Serialization;

namespace Ghcfa.Telemetry.Models;

/// <summary>
/// Provides source-generated JSON metadata for telemetry response types.
/// </summary>
[JsonSerializable(typeof(CommandResponse))]
[JsonSerializable(typeof(IReadOnlyList<string>))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
public sealed partial class TelemetryJsonContext : JsonSerializerContext;
