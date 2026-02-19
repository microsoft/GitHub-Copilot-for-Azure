using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;

namespace MyFunctions;

public class CosmosChangeFeed
{
    private readonly ILogger _logger;

    public CosmosChangeFeed(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<CosmosChangeFeed>();
    }

    [Function("CosmosChangeFeed")]
    public void Run(
        [CosmosDBTrigger(
            databaseName: "mydb",
            containerName: "items",
            Connection = "COSMOS_CONNECTION",
            LeaseContainerName = "leases",
            CreateLeaseContainerIfNotExists = true)]
        IReadOnlyList<MyDocument> documents)
    {
        if (documents != null && documents.Count > 0)
        {
            _logger.LogInformation("Documents modified: {count}", documents.Count);
            foreach (var doc in documents)
            {
                _logger.LogInformation("Document Id: {id}", doc.Id);
            }
        }
    }
}

public class MyDocument
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
