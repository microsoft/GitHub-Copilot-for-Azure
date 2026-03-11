# Forecast API Examples

## 1. Forecast Rest of Current Month (Daily)

**Use case:** See actual costs incurred so far this month plus daily forecast for the remaining days.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<start-date>",
    "to": "<end-date>"
  },
  "dataset": {
    "granularity": "Daily",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "sorting": [
      {
        "direction": "Ascending",
        "name": "UsageDate"
      }
    ]
  },
  "includeActualCost": true,
  "includeFreshPartialCost": true
}
```

> 💡 **Tip:** Set `<start-date>` to the first day of the current month (e.g., `2024-07-01T00:00:00Z`) and `<end-date>` to the last day (e.g., `2024-07-31T00:00:00Z`). The response will contain `Actual` rows up to today and `Forecast` rows for the remaining days.

### bash

```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": {
      "from": "<start-date>",
      "to": "<end-date>"
    },
    "dataset": {
      "granularity": "Daily",
      "aggregation": {
        "totalCost": {
          "name": "Cost",
          "function": "Sum"
        }
      },
      "sorting": [
        {
          "direction": "Ascending",
          "name": "UsageDate"
        }
      ]
    },
    "includeActualCost": true,
    "includeFreshPartialCost": true
  }'
```

### PowerShell

```powershell
az rest --method POST `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"Custom\", \"timePeriod\": {\"from\": \"<start-date>\", \"to\": \"<end-date>\"}, \"dataset\": {\"granularity\": \"Daily\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"sorting\": [{\"direction\": \"Ascending\", \"name\": \"UsageDate\"}]}, \"includeActualCost\": true, \"includeFreshPartialCost\": true}'
```

---

## 2. Forecast Next 3 Months (Monthly)

**Use case:** Budget planning with monthly cost projections for the next quarter.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<start-date>",
    "to": "<end-date>"
  },
  "dataset": {
    "granularity": "Monthly",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "sorting": [
      {
        "direction": "Ascending",
        "name": "BillingMonth"
      }
    ]
  },
  "includeActualCost": true,
  "includeFreshPartialCost": true
}
```

> 💡 **Tip:** Set `<start-date>` to the first of the current month and `<end-date>` to 3 months out (e.g., `from: 2024-07-01T00:00:00Z`, `to: 2024-09-30T00:00:00Z`). Monthly granularity uses the `BillingMonth` column in the response.

### bash

```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": {
      "from": "<start-date>",
      "to": "<end-date>"
    },
    "dataset": {
      "granularity": "Monthly",
      "aggregation": {
        "totalCost": {
          "name": "Cost",
          "function": "Sum"
        }
      },
      "sorting": [
        {
          "direction": "Ascending",
          "name": "BillingMonth"
        }
      ]
    },
    "includeActualCost": true,
    "includeFreshPartialCost": true
  }'
```

### PowerShell

```powershell
az rest --method POST `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"Custom\", \"timePeriod\": {\"from\": \"<start-date>\", \"to\": \"<end-date>\"}, \"dataset\": {\"granularity\": \"Monthly\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"sorting\": [{\"direction\": \"Ascending\", \"name\": \"BillingMonth\"}]}, \"includeActualCost\": true, \"includeFreshPartialCost\": true}'
```

---

## 3. Forecast with Actual Cost Overlay for Resource Group

**Use case:** Compare actual spend against forecast for a specific resource group with daily detail.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<start-date>",
    "to": "<end-date>"
  },
  "dataset": {
    "granularity": "Daily",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "sorting": [
      {
        "direction": "Ascending",
        "name": "UsageDate"
      }
    ]
  },
  "includeActualCost": true,
  "includeFreshPartialCost": true
}
```

> 💡 **Tip:** The scope is set at the URL level, not in the request body. Use the resource group scope URL to limit the forecast to a specific resource group. With `includeActualCost: true`, the response shows actual costs up to today and forecast costs for the remaining period.

### bash

```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": {
      "from": "<start-date>",
      "to": "<end-date>"
    },
    "dataset": {
      "granularity": "Daily",
      "aggregation": {
        "totalCost": {
          "name": "Cost",
          "function": "Sum"
        }
      },
      "sorting": [
        {
          "direction": "Ascending",
          "name": "UsageDate"
        }
      ]
    },
    "includeActualCost": true,
    "includeFreshPartialCost": true
  }'
```

### PowerShell

```powershell
az rest --method POST `
  --url "https://management.azure.com/subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"Custom\", \"timePeriod\": {\"from\": \"<start-date>\", \"to\": \"<end-date>\"}, \"dataset\": {\"granularity\": \"Daily\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"sorting\": [{\"direction\": \"Ascending\", \"name\": \"UsageDate\"}]}, \"includeActualCost\": true, \"includeFreshPartialCost\": true}'
```

---

## 4. Forecast for Billing Account Scope

**Use case:** Long-term cost projection across the entire billing account for finance teams.

### Request Body

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<start-date>",
    "to": "<end-date>"
  },
  "dataset": {
    "granularity": "Monthly",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "sorting": [
      {
        "direction": "Ascending",
        "name": "BillingMonth"
      }
    ]
  },
  "includeActualCost": true,
  "includeFreshPartialCost": true
}
```

> 💡 **Tip:** Billing account scope uses a different URL pattern: `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/...`. Monthly granularity is recommended for billing account forecasts given the broader scope and longer projection periods.

### bash

```bash
az rest --method POST \
  --url "https://management.azure.com/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": {
      "from": "<start-date>",
      "to": "<end-date>"
    },
    "dataset": {
      "granularity": "Monthly",
      "aggregation": {
        "totalCost": {
          "name": "Cost",
          "function": "Sum"
        }
      },
      "sorting": [
        {
          "direction": "Ascending",
          "name": "BillingMonth"
        }
      ]
    },
    "includeActualCost": true,
    "includeFreshPartialCost": true
  }'
```

### PowerShell

```powershell
az rest --method POST `
  --url "https://management.azure.com/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '{\"type\": \"ActualCost\", \"timeframe\": \"Custom\", \"timePeriod\": {\"from\": \"<start-date>\", \"to\": \"<end-date>\"}, \"dataset\": {\"granularity\": \"Monthly\", \"aggregation\": {\"totalCost\": {\"name\": \"Cost\", \"function\": \"Sum\"}}, \"sorting\": [{\"direction\": \"Ascending\", \"name\": \"BillingMonth\"}]}, \"includeActualCost\": true, \"includeFreshPartialCost\": true}'
```

---

## Scope URL Reference

| Scope | URL Pattern |
|---|---|
| Subscription | `/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast` |
| Resource Group | `/subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.CostManagement/forecast` |
| Billing Account | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/providers/Microsoft.CostManagement/forecast` |
