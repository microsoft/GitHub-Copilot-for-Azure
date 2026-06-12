# Processor Reference: Headers & Stage Availability

Processors are the building blocks of multi-stage transformations. Each processor has a `processor` name (format: `family.Name`) and a `configuration` object.

```jsonc
{
    "processor": "family.Name",
    "configuration": { }
}
```

## Stage Availability

| Processor | Client-side | Ingestion-side |
|-----------|:-----------:|:--------------:|
| header.Syslog | Yes | No |
| header.WindowsEvents | Yes | No |
| header.WindowsPerformanceCounters | Yes | No |
| header.LinuxPerformanceCounters | Yes | No |
| header.TextLog | Yes | No |
| header.IISLog | Yes | No |
| header.WindowsFirewallLog | Yes | No |
| header.StandardStream | No | Yes |
| header.CustomStream | No | Yes |
| filter.Basic | Yes | No |
| map.Rename | Yes | No |
| map.Drop | Yes | No |
| parse.JsonPath | Yes | No |
| parse.XmlPath | Yes | No |
| parse.CEFAttribute | Yes | No |
| aggregate.Basic | Yes | No |
| enrich.DNSLookup | Yes | No |
| transform.KQL | No | Yes |

## Header Processors

Must be the first processor in every transformation. Converts raw data into a schematized tabular format.

Header processors that take no configuration (all except `header.StandardStream` and `header.CustomStream`) should omit the `configuration` property entirely. Do not include `"configuration": {}`.

### header.Syslog
For syslog data sources. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated` (datetime), `Facility` (string), `SeverityNumber` (int), `EventTime` (datetime), `HostIP` (string), `Message` (string), `ProcessId` (string), `Severity` (string), `Host` (string), `ident` (string), `Timestamp` (datetime)

### header.WindowsEvents
For Windows event log data sources. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated` (datetime), `TimeCreated` (datetime), `PublisherId` (string), `PublisherName` (string), `Channel` (string), `LoggingComputer` (string), `EventNumber` (int), `EventCategory` (int), `EventLevel` (string), `UserName` (string), `RawXml` (string), `EventDescription` (string), `RenderingInfo` (string), `EventRecordId` (int)

### header.WindowsPerformanceCounters
For Windows perf counter data sources. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated` (datetime), `CounterName` (string), `CounterValue` (real), `SampleRate` (int), `Counter` (string), `Instance` (string)

### header.LinuxPerformanceCounters
For Linux perf counter data sources. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated` (datetime), `Timestamp` (datetime), `CounterName` (string), `ObjectName` (string), `InstanceName` (string), `Value` (int), `Host` (string)

### header.TextLog
For custom text log files. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated` (datetime), `FilePath` (string), `RawData` (string), `Computer` (string)

### header.IISLog
For IIS log data sources. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated`, `s_sitename`, `s_computername`, `s_ip`, `cs_method`, `cs_uri_stem`, `cs_uri_query`, `s_port`, `cs_username`, `c_ip`, `cs_version`, `cs_User_Agent_`, `cs_Cookie_`, `cs_Referer_`, `cs_host`, `sc_status`, `sc_substatus`, `sc_win32_status`, `sc_bytes`, `cs_bytes`, `time_taken`

### header.WindowsFirewallLog
For Windows Firewall logs. No configuration needed — omit `configuration`.

Output columns: `TimeGenerated`, `date`, `time`, `action`, `protocol`, `src_ip`, `dst_ip`, `src_port`, `dst_port`, `size`, `tcpflags`, `tcpsyn`, `tcpack`, `tcpwin`, `icmptype`, `icmpcode`, `info`, `path`, `pid`

### header.StandardStream
For ingestion-side transforms on standard streams.

```jsonc
{ "streamId": "Microsoft-Syslog" }
```

Output schema matches the standard LA table.

### header.CustomStream
For ingestion-side transforms on custom streams.

```jsonc
{ "streamId": "Custom-MyStream" }
```

Output schema matches the `streamDeclarations` definition.
