# Cost Management Query Examples

Common query examples with complete request bodies and CLI commands.

> 💡 **Tip:** Replace `<subscription-id>` with your actual Azure subscription GUID in all examples.

## 1. Monthly Cost by Service (Current Month)

Shows cost breakdown by Azure service for the current month. Use this to understand which services are driving costs.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "MonthToDate",
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ServiceName"
      }
    ],
    "sorting": [
      {
        "direction": "Descending",
        "name": "Cost"
      }
    ]
  }
}
```

### bash

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "ServiceName" }
      ],
      "sorting": [
        { "direction": "Descending", "name": "Cost" }
      ]
    }
  }'
```

### PowerShell

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"MonthToDate\", \"dataset\": {\"granularity\": \"None\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"grouping\": [{\"type\": \"Dimension\", \"name\": \"ServiceName\"}], \"sorting\": [{\"direction\": \"Descending\", \"name\": \"Cost\"}]}}'
```

---

## 2. Daily Cost Trend (Last 30 Days)

Shows day-by-day cost totals for a custom 30-day period. Use this to identify cost spikes or trends.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "2024-01-01T00:00:00Z",
    "to": "2024-01-31T23:59:59Z"
  },
  "dataset": {
    "granularity": "Daily",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    }
  }
}
```

> ⚠️ **Warning:** Daily granularity supports a maximum of 31 days. The API will return an error if the range exceeds this limit.

### bash

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-01-31T23:59:59Z"
    },
    "dataset": {
      "granularity": "Daily",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      }
    }
  }'
```

### PowerShell

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"Custom\", \"timePeriod\": {\"from\": \"2024-01-01T00:00:00Z\", \"to\": \"2024-01-31T23:59:59Z\"}, \"dataset\": {\"granularity\": \"Daily\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}}}'
```

---

## 3. Cost by Resource Group with Tag Filter

Shows costs grouped by resource group, filtered to only resources tagged with a specific environment. Use this for chargeback reporting.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "MonthToDate",
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ResourceGroupName"
      }
    ],
    "filter": {
      "Tags": {
        "Name": "Environment",
        "Operator": "In",
        "Values": ["production", "staging"]
      }
    },
    "sorting": [
      {
        "direction": "Descending",
        "name": "Cost"
      }
    ]
  }
}
```

### bash

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "ResourceGroupName" }
      ],
      "filter": {
        "Tags": {
          "Name": "Environment",
          "Operator": "In",
          "Values": ["production", "staging"]
        }
      },
      "sorting": [
        { "direction": "Descending", "name": "Cost" }
      ]
    }
  }'
```

### PowerShell

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"MonthToDate\", \"dataset\": {\"granularity\": \"None\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"grouping\": [{\"type\": \"Dimension\", \"name\": \"ResourceGroupName\"}], \"filter\": {\"Tags\": {\"Name\": \"Environment\", \"Operator\": \"In\", \"Values\": [\"production\", \"staging\"]}}, \"sorting\": [{\"direction\": \"Descending\", \"name\": \"Cost\"}]}}'
```

---

## 4. Amortized Cost for Reservation Analysis

Shows amortized costs grouped by reservation/savings plan name. Use this to analyze how reservation costs are distributed across usage.

### Request Body

```json
{
  "type": "AmortizedCost",
  "timeframe": "TheLastMonth",
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "BenefitName"
      }
    ],
    "sorting": [
      {
        "direction": "Descending",
        "name": "Cost"
      }
    ]
  }
}
```

> 💡 **Tip:** Use `AmortizedCost` instead of `ActualCost` to spread one-time reservation purchases across the reservation term, giving a more accurate picture of daily/monthly effective cost.

### bash

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  --body '{
    "type": "AmortizedCost",
    "timeframe": "TheLastMonth",
    "dataset": {
      "granularity": "None",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "BenefitName" }
      ],
      "sorting": [
        { "direction": "Descending", "name": "Cost" }
      ]
    }
  }'
```

### PowerShell

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '{\"type\": \"AmortizedCost\", \"timeframe\": \"TheLastMonth\", \"dataset\": {\"granularity\": \"None\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"grouping\": [{\"type\": \"Dimension\", \"name\": \"BenefitName\"}], \"sorting\": [{\"direction\": \"Descending\", \"name\": \"Cost\"}]}}'
```

---

## 5. Top 10 Most Expensive Resources

Shows the 10 highest-cost individual resources. Use this to identify the biggest cost drivers for optimization.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "MonthToDate",
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ResourceId"
      }
    ],
    "sorting": [
      {
        "direction": "Descending",
        "name": "Cost"
      }
    ]
  }
}
```

> 💡 **Tip:** Use the query parameter `$top=10` appended to the URL to limit results to the top 10 resources: `...query?api-version=2023-11-01&$top=10`

### bash

```bash
az rest --method post \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01&\$top=10" \
  --body '{
    "type": "ActualCost",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "ResourceId" }
      ],
      "sorting": [
        { "direction": "Descending", "name": "Cost" }
      ]
    }
  }'
```

### PowerShell

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01&`$top=10" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"MonthToDate\", \"dataset\": {\"granularity\": \"None\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"grouping\": [{\"type\": \"Dimension\", \"name\": \"ResourceId\"}], \"sorting\": [{\"direction\": \"Descending\", \"name\": \"Cost\"}]}}'
```
