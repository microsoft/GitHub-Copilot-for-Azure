# Durable Task Scheduler

Build reliable, fault-tolerant workflows using durable execution with Azure Durable Task Scheduler.

## When to Use

- Long-running workflows requiring state persistence
- Distributed transactions with compensating actions (saga pattern)
- Multi-step orchestrations with checkpointing
- Fan-out/fan-in parallel processing
- Workflows requiring human interaction or external events
- Stateful entities (aggregators, counters, state machines)
- Multi-agent AI orchestration
- Data processing pipelines

## Framework Selection

| Framework | Best For | Hosting |
|-----------|----------|---------|
| **Durable Functions** | Serverless event-driven apps | Azure Functions |
| **Durable Task SDKs** | Any compute (containers, VMs) | ACA, AKS, App Service, VMs |

> **💡 TIP**: Use Durable Functions for serverless with built-in triggers. Use Durable Task SDKs for hosting flexibility.

## Quick Start - Local Emulator

```bash
# Start the emulator
docker pull mcr.microsoft.com/dts/dts-emulator:latest
docker run -d -p 8080:8080 -p 8082:8082 --name dts-emulator mcr.microsoft.com/dts/dts-emulator:latest

# Dashboard available at http://localhost:8082
```

## Durable Functions Setup

### .NET - Required NuGet Packages

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.DurableTask" Version="1.*" />
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.DurableTask.AzureManaged" Version="*" />
  <PackageReference Include="Azure.Identity" Version="1.*" />
</ItemGroup>
```

### Python - Required Packages

```txt
# requirements.txt
azure-functions
azure-functions-durable
azure-identity
```

### host.json Configuration

```json
{
  "version": "2.0",
  "extensions": {
    "durableTask": {
      "storageProvider": {
        "type": "azureManaged",
        "connectionStringName": "DTS_CONNECTION_STRING"
      },
      "hubName": "%TASKHUB_NAME%"
    }
  }
}
```

### local.settings.json (.NET)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "DTS_CONNECTION_STRING": "Endpoint=http://localhost:8080;Authentication=None",
    "TASKHUB_NAME": "default"
  }
}
```

### local.settings.json (Python)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "DTS_CONNECTION_STRING": "Endpoint=http://localhost:8080;Authentication=None",
    "TASKHUB_NAME": "default"
  }
}
```

### Minimal Example (.NET)

```csharp
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;

public static class DurableFunctionsApp
{
    [Function("HttpStart")]
    public static async Task<HttpResponseData> HttpStart(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req,
        [DurableClient] DurableTaskClient client)
    {
        string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(nameof(MyOrchestration));
        return await client.CreateCheckStatusResponseAsync(req, instanceId);
    }

    [Function(nameof(MyOrchestration))]
    public static async Task<string> MyOrchestration([OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var result1 = await context.CallActivityAsync<string>(nameof(SayHello), "Tokyo");
        var result2 = await context.CallActivityAsync<string>(nameof(SayHello), "Seattle");
        return $"{result1}, {result2}";
    }

    [Function(nameof(SayHello))]
    public static string SayHello([ActivityTrigger] string name) => $"Hello {name}!";
}
```

### Minimal Example (Python)

```python
import azure.functions as func
import azure.durable_functions as df

my_app = df.DFApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# HTTP Starter
@my_app.route(route="orchestrators/{function_name}", methods=["POST"])
@my_app.durable_client_input(client_name="client")
async def http_start(req: func.HttpRequest, client):
    function_name = req.route_params.get('function_name')
    instance_id = await client.start_new(function_name)
    return client.create_check_status_response(req, instance_id)

# Orchestrator
@my_app.orchestration_trigger(context_name="context")
def my_orchestration(context: df.DurableOrchestrationContext):
    result1 = yield context.call_activity("say_hello", "Tokyo")
    result2 = yield context.call_activity("say_hello", "Seattle")
    return f"{result1}, {result2}"

# Activity
@my_app.activity_trigger(input_name="name")
def say_hello(name: str) -> str:
    return f"Hello {name}!"
```

## Workflow Patterns

| Pattern | Use When |
|---------|----------|
| **Function Chaining** | Sequential steps, each depends on previous |
| **Fan-Out/Fan-In** | Parallel processing with aggregated results |
| **Async HTTP APIs** | Long-running operations with HTTP polling |
| **Monitor** | Periodic polling with configurable timeouts |
| **Human Interaction** | Workflow pauses for external input/approval |
| **Saga** | Distributed transactions with compensation |
| **Durable Entities** | Stateful objects (counters, accounts) |

### Fan-Out/Fan-In Example (.NET)

```csharp
[Function(nameof(FanOutFanIn))]
public static async Task<int[]> FanOutFanIn([OrchestrationTrigger] TaskOrchestrationContext context)
{
    var workItems = await context.CallActivityAsync<List<string>>(nameof(GetWorkItems), null);
    
    // Fan-out: schedule all in parallel
    var tasks = workItems.Select(item => context.CallActivityAsync<int>(nameof(ProcessItem), item));
    
    // Fan-in: wait for all
    return await Task.WhenAll(tasks);
}
```

### Fan-Out/Fan-In Example (Python)

```python
@my_app.orchestration_trigger(context_name="context")
def fan_out_fan_in(context: df.DurableOrchestrationContext):
    work_items = [f"item-{i}" for i in range(5)]
    
    # Fan-out: schedule all in parallel
    parallel_tasks = []
    for item in work_items:
        task = context.call_activity("process_item", item)
        parallel_tasks.append(task)
    
    # Fan-in: wait for all
    results = yield context.task_all(parallel_tasks)
    return {"items_processed": len(results), "results": results}

@my_app.activity_trigger(input_name="item")
def process_item(item: str) -> int:
    return len(item) * 10
```

### Human Interaction Example (.NET)

```csharp
[Function(nameof(ApprovalWorkflow))]
public static async Task<string> ApprovalWorkflow([OrchestrationTrigger] TaskOrchestrationContext context)
{
    await context.CallActivityAsync(nameof(SendApprovalRequest), context.GetInput<string>());
    
    // Wait for approval event with timeout
    using var cts = new CancellationTokenSource();
    var approvalTask = context.WaitForExternalEvent<bool>("ApprovalEvent");
    var timeoutTask = context.CreateTimer(context.CurrentUtcDateTime.AddDays(3), cts.Token);
    
    var winner = await Task.WhenAny(approvalTask, timeoutTask);
    
    if (winner == approvalTask)
    {
        cts.Cancel();
        return await approvalTask ? "Approved" : "Rejected";
    }
    return "Timed out";
}
```

### Human Interaction Example (Python)

```python
import datetime

@my_app.orchestration_trigger(context_name="context")
def approval_workflow(context: df.DurableOrchestrationContext):
    yield context.call_activity("send_approval_request", context.get_input())
    
    # Wait for approval event with timeout
    timeout = context.current_utc_datetime + datetime.timedelta(days=3)
    approval_task = context.wait_for_external_event("ApprovalEvent")
    timeout_task = context.create_timer(timeout)
    
    winner = yield context.task_any([approval_task, timeout_task])
    
    if winner == approval_task:
        approved = approval_task.result
        return "Approved" if approved else "Rejected"
    return "Timed out"
```

## Critical: Orchestration Determinism

Orchestrations replay from history — all code MUST be deterministic.

### .NET Determinism Rules

| ❌ NEVER | ✅ ALWAYS USE |
|----------|--------------|
| `DateTime.Now` | `context.CurrentUtcDateTime` |
| `Guid.NewGuid()` | `context.NewGuid()` |
| `Random` | Pass random values from activities |
| `Task.Delay()`, `Thread.Sleep()` | `context.CreateTimer()` |
| Direct I/O, HTTP, database | `context.CallActivityAsync()` |

### Python Determinism Rules

| ❌ NEVER | ✅ ALWAYS USE |
|----------|--------------|
| `datetime.now()` | `context.current_utc_datetime` |
| `uuid.uuid4()` | `context.new_uuid()` |
| `random.random()` | Pass random values from activities |
| `time.sleep()` | `context.create_timer()` |
| Direct I/O, HTTP, database | `context.call_activity()` |

### Logging in Orchestrations

Use replay-safe logging to avoid duplicate log entries:

**.NET:**
```csharp
[Function(nameof(MyOrchestration))]
public static async Task<string> MyOrchestration([OrchestrationTrigger] TaskOrchestrationContext context)
{
    ILogger logger = context.CreateReplaySafeLogger(nameof(MyOrchestration));
    logger.LogInformation("Started");  // Only logs once, not on replay
    return await context.CallActivityAsync<string>(nameof(MyActivity), "input");
}
```

**Python:**
```python
import logging

@my_app.orchestration_trigger(context_name="context")
def my_orchestration(context: df.DurableOrchestrationContext):
    # Check if replaying to avoid duplicate logs
    if not context.is_replaying:
        logging.info("Started")  # Only logs once, not on replay
    result = yield context.call_activity("my_activity", "input")
    return result
```

## Connection & Authentication

| Environment | Connection String |
|-------------|-------------------|
| Local Emulator | `Endpoint=http://localhost:8080;Authentication=None` |
| Azure (Managed Identity) | `Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity` |

> **⚠️ NOTE**: Durable Task Scheduler uses identity-based authentication only — no connection strings with keys.

## Error Handling & Retry

**.NET:**
```csharp
var retryOptions = new TaskOptions
{
    Retry = new RetryPolicy(
        maxNumberOfAttempts: 3,
        firstRetryInterval: TimeSpan.FromSeconds(5),
        backoffCoefficient: 2.0,
        maxRetryInterval: TimeSpan.FromMinutes(1))
};

try
{
    await context.CallActivityAsync<string>(nameof(UnreliableService), input, retryOptions);
}
catch (TaskFailedException ex)
{
    context.SetCustomStatus(new { Error = ex.Message });
    await context.CallActivityAsync(nameof(CompensationActivity), input);
}
```

**Python:**
```python
retry_options = df.RetryOptions(
    first_retry_interval_in_milliseconds=5000,
    max_number_of_attempts=3,
    backoff_coefficient=2.0,
    max_retry_interval_in_milliseconds=60000
)

@my_app.orchestration_trigger(context_name="context")
def workflow_with_retry(context: df.DurableOrchestrationContext):
    try:
        result = yield context.call_activity_with_retry(
            "unreliable_service", 
            retry_options, 
            context.get_input()
        )
        return result
    except Exception as ex:
        context.set_custom_status({"error": str(ex)})
        yield context.call_activity("compensation_activity", context.get_input())
        return "Compensated"
```

## Durable Task SDKs (Non-Functions)

For applications running outside Azure Functions:

### .NET SDK

```csharp
var connectionString = "Endpoint=http://localhost:8080;TaskHub=default;Authentication=None";

// Worker
builder.Services.AddDurableTaskWorker()
    .AddTasks(registry => registry.AddAllGeneratedTasks())
    .UseDurableTaskScheduler(connectionString);

// Client
var client = DurableTaskClientBuilder.UseDurableTaskScheduler(connectionString).Build();
string instanceId = await client.ScheduleNewOrchestrationInstanceAsync("MyOrchestration", input);
```

### Python SDK

```python
import asyncio
from durabletask.azuremanaged.worker import DurableTaskSchedulerWorker

# Activity function
def say_hello(ctx, name: str) -> str:
    return f"Hello {name}!"

# Orchestrator function
def my_orchestration(ctx, name: str) -> str:
    result = yield ctx.call_activity('say_hello', input=name)
    return result

async def main():
    with DurableTaskSchedulerWorker(
        host_address="http://localhost:8080",
        secure_channel=False,
        taskhub="default"
    ) as worker:
        worker.add_activity(say_hello)
        worker.add_orchestrator(my_orchestration)
        worker.start()
        
        # Keep worker running
        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
```

## Azure Deployment

### Provision Durable Task Scheduler

```bash
# Create scheduler
az durabletask scheduler create \
    --resource-group myResourceGroup \
    --name my-scheduler \
    --location eastus \
    --sku basic
```

### Bicep Example

```bicep
resource scheduler 'Microsoft.DurableTask/schedulers@2025-11-01' = {
  name: schedulerName
  location: location
  properties: {
    sku: { name: 'basic' }
  }
}

resource taskHub 'Microsoft.DurableTask/schedulers/taskHubs@2025-11-01' = {
  parent: scheduler
  name: 'default'
}
```

### Configure Managed Identity Access

```bash
# Get Function App identity
PRINCIPAL_ID=$(az functionapp identity show --name my-func-app --resource-group myRG --query principalId -o tsv)

# Grant access to scheduler
az role assignment create \
    --assignee $PRINCIPAL_ID \
    --role "Durable Task Data Contributor" \
    --scope /subscriptions/<sub-id>/resourceGroups/myRG/providers/Microsoft.DurableTask/schedulers/my-scheduler
```

## References

- [Official Documentation](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/durable-task-scheduler)
- [Durable Functions Overview](https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-overview)
- [Sample Repository](https://github.com/Azure-Samples/Durable-Task-Scheduler)
- [Choosing an Orchestration Framework](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/choose-orchestration-framework)
