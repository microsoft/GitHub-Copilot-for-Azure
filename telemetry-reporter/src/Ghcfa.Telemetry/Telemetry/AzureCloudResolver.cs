namespace Ghcfa.Telemetry.Telemetry;

/// <summary>
/// Resolves the active Azure cloud from environment variables.
/// </summary>
internal static class AzureCloudResolver
{
    public static string Resolve(IEnvironmentVariables environment)
    {
        ArgumentNullException.ThrowIfNull(environment);

        var cloudValue = environment.Get("AZURE_CLOUD")
            ?? environment.Get("azure_cloud")
            ?? environment.Get("cloud")
            ?? environment.Get("Cloud");

        if (string.IsNullOrWhiteSpace(cloudValue))
        {
            return "AzurePublicCloud";
        }

        return cloudValue.ToLowerInvariant() switch
        {
            "azurecloud" or "azurepubliccloud" or "public" or "azurepublic" =>
                "AzurePublicCloud",
            "azurechinacloud" or "china" or "azurechina" =>
                "AzureChinaCloud",
            "azureusgovernment" or "azureusgovernmentcloud" or "usgov" or "usgovernment" =>
                "AzureUSGovernmentCloud",
            _ => throw new ArgumentException(
                $"Unrecognized cloud value '{cloudValue}'. Supported values are: AzureCloud, AzurePublicCloud, Public, AzurePublic, AzureChinaCloud, China, AzureChina, AzureUSGovernment, AzureUSGovernmentCloud, USGov, USGovernment.",
                nameof(cloudValue))
        };
    }
}
