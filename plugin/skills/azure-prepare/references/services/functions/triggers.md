# Function Triggers

## HTTP Trigger

```javascript
module.exports = async function (context, req) {
    context.res = { body: "Hello from Azure Functions" };
};
```

## Timer Trigger

```json
// function.json
{
  "bindings": [{
    "name": "timer",
    "type": "timerTrigger",
    "schedule": "0 */5 * * * *"
  }]
}
```

Cron format: `{second} {minute} {hour} {day} {month} {day-of-week}`

## Queue Trigger (Service Bus)

```json
// function.json
{
  "bindings": [{
    "name": "queueItem",
    "type": "serviceBusTrigger",
    "queueName": "orders",
    "connection": "ServiceBusConnection"
  }]
}
```

## Blob Trigger

```json
// function.json
{
  "bindings": [{
    "name": "blob",
    "type": "blobTrigger",
    "path": "uploads/{name}",
    "connection": "StorageConnection"
  }]
}
```
