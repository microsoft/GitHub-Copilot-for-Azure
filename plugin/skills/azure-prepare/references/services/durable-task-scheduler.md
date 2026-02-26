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
# Start the emulator (update the tag as needed; see https://mcr.microsoft.com/v2/dts/dts-emulator/tags/list for newer versions)
docker pull mcr.microsoft.com/dts/dts-emulator:v0.0.10
docker run -d -p 8080:8080 -p 8082:8082 --name dts-emulator mcr.microsoft.com/dts/dts-emulator:v0.0.10

# Dashboard available at http://localhost:8082
```

## Durable Functions Setup

### .NET - Required NuGet Packages

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.DurableTask" Version="1.14.1" />
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.DurableTask.AzureManaged" Version="1.4.0" />
  <PackageReference Include="Azure.Identity" Version="1.17.1" />
</ItemGroup>
```

### Python - Required Packages

```txt
# requirements.txt
azure-functions
azure-functions-durable
azure-identity
```

### Java - Required Maven Dependencies

```xml
<dependencies>
  <dependency>
    <groupId>com.microsoft.azure.functions</groupId>
    <artifactId>azure-functions-java-library</artifactId>
    <version>3.2.3</version>
  </dependency>
  <dependency>
    <groupId>com.microsoft</groupId>
    <artifactId>durabletask-azure-functions</artifactId>
    <version>1.7.0</version>
  </dependency>
</dependencies>
```

### JavaScript - Required npm Packages

```json
{
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "durable-functions": "^3.0.0"
  }
}
```

### host.json Configuration (.NET / Python)

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

### host.json Configuration (Java / JavaScript)

```json
{
  "version": "2.0",
  "extensions": {
    "durableTask": {
      "hubName": "default",
      "storageProvider": {
        "type": "durabletask-scheduler",
        "connectionStringName": "DURABLE_TASK_SCHEDULER_CONNECTION_STRING"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
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

### local.settings.json (Java)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "java",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "DURABLE_TASK_SCHEDULER_CONNECTION_STRING": "Endpoint=http://localhost:8080;TaskHub=default;Authentication=None"
  }
}
```

### local.settings.json (JavaScript)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "DURABLE_TASK_SCHEDULER_CONNECTION_STRING": "Endpoint=http://localhost:8080;TaskHub=default;Authentication=None"
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
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
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

my_app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)

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

### Minimal Example (Java)

```java
import com.microsoft.azure.functions.*;
import com.microsoft.azure.functions.annotation.*;
import com.microsoft.durabletask.*;
import com.microsoft.durabletask.azurefunctions.*;

public class DurableFunctionsApp {

    @FunctionName("HttpStart")
    public HttpResponseMessage httpStart(
            @HttpTrigger(name = "req", methods = {HttpMethod.POST}, authLevel = AuthorizationLevel.FUNCTION)
            HttpRequestMessage<Void> request,
            @DurableClientInput(name = "durableContext") DurableClientContext durableContext) {
        DurableTaskClient client = durableContext.getClient();
        String instanceId = client.scheduleNewOrchestrationInstance("MyOrchestration");
        return durableContext.createCheckStatusResponse(request, instanceId);
    }

    @FunctionName("MyOrchestration")
    public String myOrchestration(
            @DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
        String result1 = ctx.callActivity("SayHello", "Tokyo", String.class).await();
        String result2 = ctx.callActivity("SayHello", "Seattle", String.class).await();
        return result1 + ", " + result2;
    }

    @FunctionName("SayHello")
    public String sayHello(@DurableActivityTrigger(name = "name") String name) {
        return "Hello " + name + "!";
    }
}
```

### Minimal Example (JavaScript)

```javascript
const { app } = require("@azure/functions");
const df = require("durable-functions");

// Activity
df.app.activity("sayHello", {
  handler: (city) => `Hello ${city}!`,
});

// Orchestrator
df.app.orchestration("myOrchestration", function* (context) {
  const result1 = yield context.df.callActivity("sayHello", "Tokyo");
  const result2 = yield context.df.callActivity("sayHello", "Seattle");
  return `${result1}, ${result2}`;
});

// HTTP Starter
app.http("HttpStart", {
  route: "orchestrators/{orchestrationName}",
  methods: ["POST"],
  authLevel: "function",
  extraInputs: [df.input.durableClient()],
  handler: async (request, context) => {
    const client = df.getClient(context);
    const instanceId = await client.startNew(request.params.orchestrationName);
    return client.createCheckStatusResponse(request, instanceId);
  },
});
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
public static async Task<string[]> FanOutFanIn([OrchestrationTrigger] TaskOrchestrationContext context)
{
    string[] cities = { "Tokyo", "Seattle", "London", "Paris", "Berlin" };

    // Fan-out: schedule all in parallel
    var tasks = cities.Select(city => context.CallActivityAsync<string>(nameof(SayHello), city));

    // Fan-in: wait for all
    return await Task.WhenAll(tasks);
}
```

### Fan-Out/Fan-In Example (Python)

```python
@my_app.orchestration_trigger(context_name="context")
def fan_out_fan_in(context: df.DurableOrchestrationContext):
    cities = ["Tokyo", "Seattle", "London", "Paris", "Berlin"]
    
    # Fan-out: schedule all in parallel
    parallel_tasks = []
    for city in cities:
        task = context.call_activity("say_hello", city)
        parallel_tasks.append(task)
    
    # Fan-in: wait for all
    results = yield context.task_all(parallel_tasks)
    return results
```

### Fan-Out/Fan-In Example (Java)

```java
@FunctionName("FanOutFanIn")
public List<String> fanOutFanIn(
        @DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
    String[] cities = {"Tokyo", "Seattle", "London", "Paris", "Berlin"};
    List<Task<String>> parallelTasks = new ArrayList<>();

    // Fan-out: schedule all activities in parallel
    for (String city : cities) {
        parallelTasks.add(ctx.callActivity("SayHello", city, String.class));
    }

    // Fan-in: wait for all to complete
    List<String> results = new ArrayList<>();
    for (Task<String> task : parallelTasks) {
        results.add(task.await());
    }

    return results;
}
```

### Fan-Out/Fan-In Example (JavaScript)

```javascript
df.app.orchestration("fanOutFanIn", function* (context) {
  const cities = ["Tokyo", "Seattle", "London", "Paris", "Berlin"];

  // Fan-out: schedule all activities in parallel
  const tasks = cities.map((city) => context.df.callActivity("sayHello", city));

  // Fan-in: wait for all to complete
  const results = yield context.df.Task.all(tasks);
  return results;
});
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

### Human Interaction Example (Java)

```java
@FunctionName("ApprovalWorkflow")
public String approvalWorkflow(
        @DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
    ctx.callActivity("SendApprovalRequest", ctx.getInput(String.class)).await();

    // Wait for approval event with timeout
    Task<Boolean> approvalTask = ctx.waitForExternalEvent("ApprovalEvent", Boolean.class);
    Task<Void> timeoutTask = ctx.createTimer(Duration.ofDays(3));

    Task<?> winner = ctx.anyOf(approvalTask, timeoutTask).await();

    if (winner == approvalTask) {
        return approvalTask.await() ? "Approved" : "Rejected";
    }
    return "Timed out";
}
```

### Human Interaction Example (JavaScript)

```javascript
df.app.orchestration("approvalWorkflow", function* (context) {
  yield context.df.callActivity("sendApprovalRequest", context.df.getInput());

  // Wait for approval event with timeout
  const expiration = new Date(context.df.currentUtcDateTime);
  expiration.setDate(expiration.getDate() + 3);

  const approvalTask = context.df.waitForExternalEvent("ApprovalEvent");
  const timeoutTask = context.df.createTimer(expiration);

  const winner = yield context.df.Task.any([approvalTask, timeoutTask]);

  if (winner === approvalTask) {
    return approvalTask.result ? "Approved" : "Rejected";
  }
  return "Timed out";
});
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

### Java Determinism Rules

| ❌ NEVER | ✅ ALWAYS USE |
|----------|--------------|
| `System.currentTimeMillis()` | `ctx.getCurrentInstant()` |
| `UUID.randomUUID()` | Pass random values from activities |
| `Thread.sleep()` | `ctx.createTimer()` |
| Direct I/O, HTTP, database | `ctx.callActivity()` |

### JavaScript Determinism Rules

| ❌ NEVER | ✅ ALWAYS USE |
|----------|--------------|
| `new Date()` | `context.df.currentUtcDateTime` |
| `Math.random()` | Pass random values from activities |
| `setTimeout()` | `context.df.createTimer()` |
| Direct I/O, HTTP, database | `context.df.callActivity()` |

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

**Java:**
```java
@FunctionName("MyOrchestration")
public String myOrchestration(
        @DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
    // Use isReplaying to avoid duplicate logs
    if (!ctx.getIsReplaying()) {
        logger.info("Started");  // Only logs once, not on replay
    }
    return ctx.callActivity("MyActivity", "input", String.class).await();
}
```

**JavaScript:**
```javascript
df.app.orchestration("myOrchestration", function* (context) {
  if (!context.df.isReplaying) {
    console.log("Started");  // Only logs once, not on replay
  }
  const result = yield context.df.callActivity("myActivity", "input");
  return result;
});
```

## Connection & Authentication

| Environment | Connection String |
|-------------|-------------------|
| Local Emulator | `Endpoint=http://localhost:8080;Authentication=None` |
| Azure (System-Assigned MI) | `Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity` |
| Azure (User-Assigned MI) | `Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity;ClientID=<uami-client-id>` |

> **⚠️ NOTE**: Durable Task Scheduler uses identity-based authentication only — no connection strings with keys. When using a User-Assigned Managed Identity (UAMI), you must include the `ClientID` in the connection string.

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

**Java:**
```java
@FunctionName("WorkflowWithRetry")
public String workflowWithRetry(
        @DurableOrchestrationTrigger(name = "ctx") TaskOrchestrationContext ctx) {
    TaskOptions retryOptions = new TaskOptions(new RetryPolicy(
        3,  // maxNumberOfAttempts
        Duration.ofSeconds(5)  // firstRetryInterval
    ));

    try {
        return ctx.callActivity("UnreliableService", ctx.getInput(String.class),
                retryOptions, String.class).await();
    } catch (TaskFailedException ex) {
        ctx.setCustomStatus(Map.of("Error", ex.getMessage()));
        ctx.callActivity("CompensationActivity", ctx.getInput(String.class)).await();
        return "Compensated";
    }
}
```

**JavaScript:**
```javascript
df.app.orchestration("workflowWithRetry", function* (context) {
  const retryOptions = new df.RetryOptions(5000, 3); // firstRetryInterval, maxAttempts
  retryOptions.backoffCoefficient = 2.0;
  retryOptions.maxRetryIntervalInMilliseconds = 60000;

  try {
    const result = yield context.df.callActivityWithRetry(
      "unreliableService",
      retryOptions,
      context.df.getInput()
    );
    return result;
  } catch (ex) {
    context.df.setCustomStatus({ error: ex.message });
    yield context.df.callActivity("compensationActivity", context.df.getInput());
    return "Compensated";
  }
});
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

        # Client
        from durabletask.azuremanaged.client import DurableTaskSchedulerClient
        client = DurableTaskSchedulerClient(
            host_address="http://localhost:8080",
            taskhub="default",
            token_credential=None,
            secure_channel=False
        )
        instance_id = client.schedule_new_orchestration("my_orchestration", input="World")
        result = client.wait_for_orchestration_completion(instance_id, timeout=30)
        print(f"Output: {result.serialized_output}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Java SDK

```java
import com.microsoft.durabletask.*;
import com.microsoft.durabletask.azuremanaged.DurableTaskSchedulerWorkerExtensions;
import com.microsoft.durabletask.azuremanaged.DurableTaskSchedulerClientExtensions;

import java.time.Duration;

public class App {
    public static void main(String[] args) throws Exception {
        String connectionString = "Endpoint=http://localhost:8080;TaskHub=default;Authentication=None";

        // Worker
        DurableTaskGrpcWorker worker = DurableTaskSchedulerWorkerExtensions
            .createWorkerBuilder(connectionString)
            .addOrchestration(new TaskOrchestrationFactory() {
                @Override public String getName() { return "MyOrchestration"; }
                @Override public TaskOrchestration create() {
                    return ctx -> {
                        String result = ctx.callActivity("SayHello",
                                ctx.getInput(String.class), String.class).await();
                        ctx.complete(result);
                    };
                }
            })
            .addActivity(new TaskActivityFactory() {
                @Override public String getName() { return "SayHello"; }
                @Override public TaskActivity create() {
                    return ctx -> "Hello " + ctx.getInput(String.class) + "!";
                }
            })
            .build();

        worker.start();

        // Client
        DurableTaskClient client = DurableTaskSchedulerClientExtensions
            .createClientBuilder(connectionString).build();
        String instanceId = client.scheduleNewOrchestrationInstance("MyOrchestration", "World");
        OrchestrationMetadata result = client.waitForInstanceCompletion(
                instanceId, Duration.ofSeconds(30), true);
        System.out.println("Output: " + result.readOutputAs(String.class));

        worker.stop();
    }
}
```

### JavaScript SDK

```javascript
import { createAzureManagedWorkerBuilder, createAzureManagedClient } from "@microsoft/durabletask-js-azuremanaged";

const connectionString = "Endpoint=http://localhost:8080;Authentication=None;TaskHub=default";

// Activity
const sayHello = async (_ctx, name) => `Hello ${name}!`;

// Orchestrator
const myOrchestration = async function* (ctx, name) {
  const result = yield ctx.callActivity(sayHello, name);
  return result;
};

// Worker
const worker = createAzureManagedWorkerBuilder(connectionString)
  .addOrchestrator(myOrchestration)
  .addActivity(sayHello)
  .build();

await worker.start();

// Client
const client = createAzureManagedClient(connectionString);
const instanceId = await client.scheduleNewOrchestration("myOrchestration", "World");
const state = await client.waitForOrchestrationCompletion(instanceId, true, 30);
console.log("Output:", state.serializedOutput);

await client.stop();
await worker.stop();
```

## Azure Deployment

For provisioning, Bicep templates, managed identity configuration, and deployment workflows, see the [DTS Deployment Guide](../../../../skills/azure-deploy/references/recipes/azd/durable-task-scheduler-deploy.md).

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **403 PermissionDenied** on gRPC call (e.g., `client.start_new()`) | Function App managed identity lacks RBAC on the Durable Task Scheduler resource | Assign `Durable Task Data Contributor` role (`5f6a3c3e-0da3-4079-b4f3-4db62a1d3c09`) to the identity (SAMI or UAMI) scoped to the Durable Task Scheduler resource. For UAMI, also ensure the connection string includes `ClientID=<uami-client-id>` |
| **Connection refused** to emulator | Emulator container not running or wrong port | Verify container is running: `docker ps` and confirm port 8080 is mapped |
| **TaskHub not found** | Task hub not provisioned or name mismatch | Ensure `TASKHUB_NAME` app setting matches the provisioned task hub name |

## References

- [Official Documentation](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/durable-task-scheduler)
- [Durable Functions Overview](https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-overview)
- [Sample Repository](https://github.com/Azure-Samples/Durable-Task-Scheduler)
- [Choosing an Orchestration Framework](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/choose-orchestration-framework)
