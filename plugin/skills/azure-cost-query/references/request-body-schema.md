# Cost Management Query API — Request Body Schema

Complete JSON schema documentation for the [Cost Management Query API](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage).

## Request Body Structure

```json
{
  "type": "<report-type>",
  "timeframe": "<timeframe>",
  "timePeriod": {
    "from": "2024-01-01T00:00:00Z",
    "to": "2024-01-31T23:59:59Z"
  },
  "dataset": {
    "granularity": "<granularity>",
    "aggregation": {
      "<alias>": {
        "name": "<column-name>",
        "function": "<aggregation-function>"
      }
    },
    "grouping": [
      {
        "type": "<column-type>",
        "name": "<column-name>"
      }
    ],
    "filter": {
      "<filter-expression>"
    },
    "sorting": [
      {
        "direction": "<sort-direction>",
        "name": "<column-name>"
      }
    ]
  }
}
```

## Field Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Report type enum. Determines cost calculation method. |
| `timeframe` | string | Yes | Predefined or custom time window for the query. |
| `timePeriod` | object | Conditional | Required when `timeframe` is `Custom`. Contains `from` and `to` ISO 8601 dates. |
| `dataset` | object | Yes | Defines granularity, aggregation, grouping, filtering, and sorting. |

### ReportType Enum

| Value | Description |
|-------|-------------|
| `ActualCost` | Actual billed costs including purchases (reservations, marketplace). Shows costs as they appear on invoices. |
| `AmortizedCost` | Reservation and savings plan costs spread evenly across usage period. Useful for chargeback and showback. |
| `Usage` | Usage-based data. Shows consumption records without purchase amortization. |

### Timeframe Enum

| Value | Description |
|-------|-------------|
| `WeekToDate` | Start of current week through today. |
| `MonthToDate` | Start of current month through today. |
| `BillingMonthToDate` | Start of current billing month through today. |
| `YearToDate` | Start of current year through today. |
| `TheLastWeek` | Previous full week (Mon–Sun). |
| `TheLastMonth` | Previous full calendar month. |
| `TheLastBillingMonth` | Previous full billing month. |
| `TheLastYear` | Previous full calendar year. |
| `TheLast7Days` | Rolling 7-day window ending today. |
| `TheLast3Months` | Rolling 3-month window ending today. |
| `Custom` | Custom date range. Requires `timePeriod` with `from` and `to`. |

### timePeriod Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string (ISO 8601) | Yes | Start date (inclusive). |
| `to` | string (ISO 8601) | Yes | End date (inclusive). |

## Dataset Fields

### Granularity

| Value | Description | Max Range |
|-------|-------------|-----------|
| `None` | Aggregated total for the entire time period. No date breakdown. | 12 months |
| `Daily` | Day-by-day cost breakdown. Best for trend analysis over short periods. | 31 days |
| `Monthly` | Month-by-month cost breakdown. Best for longer-term trends. | 12 months |

### Aggregation

Aggregation defines which numeric columns to aggregate and how.

```json
"aggregation": {
  "totalCost": {
    "name": "Cost",
    "function": "Sum"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `<alias>` | string (key) | Yes | Output column alias (e.g., `totalCost`). |
| `name` | string | Yes | Source column name (e.g., `Cost`, `PreTaxCost`, `UsageQuantity`). |
| `function` | string | Yes | Aggregation function to apply. |

#### AggregationFunction Enum

| Value | Description |
|-------|-------------|
| `Sum` | Sum of values. Most common for cost queries. |
| `Count` | Count of records. |
| `Min` | Minimum value. |
| `Max` | Maximum value. |
| `Avg` | Average value. |

> ⚠️ **Warning:** For standard cost queries, only `Sum` is supported as the aggregation function. Other functions may return errors depending on the scope and API version.

### Grouping

Groups results by one or more dimensions or tags.

```json
"grouping": [
  { "type": "Dimension", "name": "ServiceName" },
  { "type": "TagKey", "name": "Environment" }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Column type: `Dimension` or `TagKey`. |
| `name` | string | Yes | Column name or tag key to group by. |

#### ColumnType Enum

| Value | Description |
|-------|-------------|
| `Dimension` | Built-in cost dimension (e.g., `ServiceName`, `ResourceGroupName`). |
| `TagKey` | Azure resource tag key (e.g., `Environment`, `CostCenter`). |

> ⚠️ **Warning:** Maximum of 2 GroupBy dimensions per query. No duplicate columns allowed.

### Filter

Filter expressions restrict which cost records are included. Filters support logical operators (`And`, `Or`, `Not`) and comparison operators on dimensions or tags.

#### Filter Expression Structure

```json
"filter": {
  "And": [
    {
      "Dimensions": {
        "Name": "ResourceGroupName",
        "Operator": "In",
        "Values": ["rg-prod", "rg-staging"]
      }
    },
    {
      "Not": {
        "Tags": {
          "Name": "Environment",
          "Operator": "Equal",
          "Values": ["dev"]
        }
      }
    }
  ]
}
```

#### Logical Operators

| Operator | Description | Children |
|----------|-------------|----------|
| `And` | All child expressions must match. | 2 or more expressions. |
| `Or` | Any child expression must match. | 2 or more expressions. |
| `Not` | Negates a single child expression. | Exactly 1 expression. |

> ⚠️ **Warning:** `And` and `Or` must contain at least 2 child expressions. `Not` must contain exactly 1.

#### Comparison Operators (ComparisonOperator Enum)

| Operator | Description | Example |
|----------|-------------|---------|
| `In` | Value is in the provided list. Supports multiple values. | `"Values": ["vm", "storage"]` |
| `Equal` | Exact match against a single value. | `"Values": ["production"]` |
| `Contains` | String contains the specified substring. | `"Values": ["prod"]` |
| `LessThan` | Numeric less-than comparison. | `"Values": ["100"]` |
| `GreaterThan` | Numeric greater-than comparison. | `"Values": ["0"]` |
| `NotEqual` | Value does not match the specified value. | `"Values": ["dev"]` |

#### Filter Target Types

| Target | Description |
|--------|-------------|
| `Dimensions` | Filter on built-in dimensions (e.g., `ResourceGroupName`, `ServiceName`). |
| `Tags` | Filter on Azure resource tags (e.g., `Environment`, `CostCenter`). |

### Sorting

```json
"sorting": [
  { "direction": "Descending", "name": "Cost" }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `direction` | string | Yes | `Ascending` or `Descending`. |
| `name` | string | Yes | Column name to sort by (must be present in aggregation or grouping). |

## Response Structure

```json
{
  "id": "<query-id>",
  "name": "<query-name>",
  "type": "Microsoft.CostManagement/query",
  "properties": {
    "nextLink": "<url-for-next-page-or-null>",
    "columns": [
      { "name": "Cost", "type": "Number" },
      { "name": "ServiceName", "type": "String" },
      { "name": "UsageDate", "type": "Number" },
      { "name": "Currency", "type": "String" }
    ],
    "rows": [
      [123.45, "Virtual Machines", 20240115, "USD"],
      [67.89, "Storage", 20240115, "USD"]
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `columns` | array | Array of column definitions with `name` and `type`. |
| `columns[].name` | string | Column name. |
| `columns[].type` | string | Data type: `Number` or `String`. |
| `rows` | array | Array of row arrays. Values ordered to match `columns`. |
| `nextLink` | string | URL for next page of results, or `null` if no more pages. |

> 💡 **Tip:** `UsageDate` is returned as a number in `YYYYMMDD` format (e.g., `20240115`) when granularity is `Daily` or `Monthly`.
