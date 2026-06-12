# Standard Tables Accepting Custom Streams

These standard tables accept data from custom streams via the Log Ingestion API or custom stream routing. Tables not on this list require standard streams.

> **Note:** This list may change. Check the [current documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/logs-ingestion-api-overview#supported-tables) for updates.

### Assessment & Recommendations
- ADAssessmentRecommendation
- ADSecurityAssessmentRecommendation
- AzureAssessmentRecommendation
- ExchangeAssessmentRecommendation
- ExchangeOnlineAssessmentRecommendation
- SCCMAssessmentRecommendation
- SCOMAssessmentRecommendation
- SfBAssessmentRecommendation
- SfBOnlineAssessmentRecommendation
- SharePointOnlineAssessmentRecommendation
- SPAssessmentRecommendation
- SQLAssessmentRecommendation
- WindowsClientAssessmentRecommendation
- WindowsServerAssessmentRecommendation

### Core Monitoring
- AzureMetricsV2
- CommonSecurityLog
- Event
- OTelLogs
- SecurityEvent
- Syslog
- WindowsEvent

### ASIM (Normalized Security)
- ASimAuditEventLogs
- ASimAuthenticationEventLogs
- ASimDhcpEventLogs
- ASimDnsActivityLogs
- ASimFileEventLogs
- ASimNetworkSessionLogs
- ASimProcessEventLogs
- ASimRegistryEventLogs
- ASimUserManagementActivityLogs
- ASimWebSessionLogs

### SAP (ABAP)
- ABAPAuditLog
- ABAPAuthorizationDetails
- ABAPChangeDocsLog
- ABAPUserDetails

### AWS
- AWSALBAccessLogs
- AWSCloudTrail
- AWSCloudWatch
- AWSEKS
- AWSELBFlowLogs
- AWSGuardDuty
- AWSNetworkFirewallAlert
- AWSNetworkFirewallFlow
- AWSNetworkFirewallTls
- AWSNLBAccessLogs
- AWSRoute53Resolver
- AWSS3ServerAccess
- AWSSecurityHubFindings
- AWSVPCFlow
- AWSWAF

### GCP
- GCPApigee
- GCPAuditLogs
- GCPCDN
- GCPCloudRun
- GCPCloudSQL
- GCPComputeEngine
- GCPDNS
- GCPFirewallLogs
- GCPIAM
- GCPIDS
- GCPMonitoring
- GCPNAT
- GCPNATAudit
- GCPResourceManager
- GCPVPCFlow
- GKEAPIServer
- GKEApplication
- GKEAudit
- GKEControllerManager
- GKEHPADecision
- GKEScheduler
- GoogleCloudSCC
- GoogleWorkspaceReports

### Third-Party Security
- Anomalies
- CrowdStrikeAlerts
- CrowdStrikeAPIActivityAudit
- CrowdStrikeAuthActivityAudit
- CrowdStrikeCases
- CrowdStrikeCSPMIOAStreaming
- CrowdStrikeCSPMSearchStreaming
- CrowdStrikeCustomerIOC
- CrowdStrikeDetections
- CrowdStrikeHosts
- CrowdStrikeIncidents
- CrowdStrikeReconNotificationSummary
- CrowdStrikeRemoteResponseSessionEnd
- CrowdStrikeRemoteResponseSessionStart
- CrowdStrikeScheduledReportNotification
- CrowdStrikeUserActivityAudit
- CrowdStrikeVulnerabilities
- IlumioInsights
- QualysKnowledgeBase
- Rapid7InsightVMCloudAssets
- Rapid7InsightVMCloudVulnerabilities
- SentinelAlibabaCloudAPIGatewayLogs
- SentinelAlibabaCloudVPCFlowLogs
- SentinelAlibabaCloudWAFLogs
- SentinelTheHiveData

### Threat Intelligence
- ThreatIntelIndicators
- ThreatIntelligenceIndicator
- ThreatIntelObjects

### DNS
- DnsAuditEvents

### Vulnerability Management
- DeviceTvmSecureConfigurationAssessmentKB
- DeviceTvmSoftwareVulnerabilitiesKB

### Windows Update
- UCClient
- UCClientReadinessStatus
- UCClientUpdateStatus
- UCDeviceAlert
- UCDOAggregatedStatus
- UCDOStatus
- UCServiceUpdateStatus
- UCUpdateAlert

### Storage Insights
- StorageInsightsAccountPropertiesDaily
- StorageInsightsDailyMetrics
- StorageInsightsHourlyMetrics
- StorageInsightsMonthlyMetrics
- StorageInsightsWeeklyMetrics
