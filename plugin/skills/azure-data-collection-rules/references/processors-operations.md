# Processor Reference: Filter, Map, Parse, Aggregate, Enrich, KQL

## filter.Basic

Drops records based on conditions. Structure: OR groups of AND groups.

```jsonc
{
    "any": [
        {
            "all": [
                { "columnName": "Facility", "operator": "==", "value": "auth" }
            ]
        }
    ]
}
```

Record is **kept** if any AND group evaluates to true.

**Operators:**
- String: `==`, `!=`, `contains`, `!contains`
- Numeric: `==`, `!=`, `>`, `<`, `>=`, `<=`

Output: same schema, fewer records.

## map.Rename

```jsonc
{
    "all": [
        { "columnName": "OldName", "nameAs": "NewName", "typeAs": "string" }
    ]
}
```

`nameAs` and `typeAs` are both optional (at least one required). Types: `string`, `int`, `long`, `real`, `bool`, `datetime`. Failed casts produce `null`.

**Limitations:**
- `nameAs` is required by the API even for type-only casts — set `nameAs` to a new column name
- Cannot rename a column to its own name (API rejects duplicate column names)
- For in-place type casts without renaming, use `transform.KQL` instead: `source | extend Col = toint(Col)`

## map.Drop

```jsonc
{ "columnNames": ["Column1", "Column2"] }
```

## parse.JsonPath

```jsonc
{
    "columnName": "EventData",
    "all": [
        { "path": "$.user.name", "nameAs": "UserName", "typeAs": "string" }
    ]
}
```

## parse.XmlPath

```jsonc
{
    "columnName": "RawXml",
    "all": [
        { "path": "/Event/System/EventID", "nameAs": "EventID", "typeAs": "int" }
    ]
}
```

Supports simple XPath including attribute selectors: `/Event/EventData/Data[@Name='SubjectUserName']`

## parse.CEFAttribute

```jsonc
{
    "columnName": "Message",
    "all": [
        { "path": "deviceAction", "nameAs": "Action", "typeAs": "string" }
    ]
}
```

All parse processors add new columns to the schema. `typeAs` is optional; failed casts produce `null`.

## aggregate.Basic

```jsonc
{
    "batchingSettings": {
        "timeWindow": "5m",
        "maxBatchRows": 1000
    },
    "aggregates": [
        { "columnName": "CounterValue", "operator": "avg", "nameAs": "AvgValue" },
        { "operator": "count", "nameAs": "RecordCount" }
    ],
    "dimensionColumns": ["Host", "CounterName"]
}
```

**Operators:** `sum`, `avg`, `min`, `max`, `count` (`columnName` not required for `count`).
**dimensionColumns:** group-by columns (string type only).

Output schema contains ONLY aggregate columns + dimension columns. Route aggregated data to a custom table.

## enrich.DNSLookup

```jsonc
{ "columnName": "IPAddress", "nameAs": "DNSName" }
```

Best-effort DNS resolution. Returns `null` on lookup failure.

## transform.KQL

Ingestion-side only. Arbitrary KQL expression.

```jsonc
{ "expression": "source | where SeverityNumber >= 4 | extend EnrichedMsg = strcat(Host, ': ', Message)" }
```

Output schema determined by the KQL expression. Limited static validation.
