<#
.SYNOPSIS
    Validates a DCR JSON file for common structural issues before deployment.
.PARAMETER DcrFilePath
    Path to the DCR JSON file.
.EXAMPLE
    .\validate-dcr.ps1 -DcrFilePath "dcr.json"
#>
param(
    [Parameter(Mandatory)][string]$DcrFilePath
)

if (-not (Test-Path $DcrFilePath)) {
    Write-Error "File not found: $DcrFilePath"
    exit 1
}

$errors = @()
$warnings = @()

try {
    $dcr = Get-Content -Path $DcrFilePath -Raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "Invalid JSON: $_"
    exit 1
}

# Navigate to properties
$props = $dcr.properties
if (-not $props) {
    $props = $dcr  # Maybe the file IS the properties object
}

# Check required sections
$isDirect = $false
if ($dcr.kind -eq 'Direct') {
    $isDirect = $true
}

if (-not $isDirect -and -not $props.dataSources) { $errors += "Missing 'dataSources' section (required for non-Direct DCRs)" }
if ($isDirect -and $props.dataSources) { $warnings += "Direct DCR should not have a 'dataSources' section" }
if (-not $props.destinations) { $errors += "Missing 'destinations' section" }
if (-not $props.dataFlows) { $errors += "Missing 'dataFlows' section" }

# Collect declared custom streams
$declaredStreams = @()
if ($props.streamDeclarations) {
    $declaredStreams = $props.streamDeclarations.PSObject.Properties.Name
}

# Collect named transformations
$namedTransforms = @()
if ($props.transformations) {
    $namedTransforms = $props.transformations | ForEach-Object { $_.name }
}

# Collect destination names
$destNames = @()
if ($props.destinations) {
    foreach ($destType in $props.destinations.PSObject.Properties) {
        foreach ($dest in $destType.Value) {
            if ($dest.name) { $destNames += $dest.name }
        }
    }
}

# Validate data sources
if ($props.dataSources) {
    foreach ($dsType in $props.dataSources.PSObject.Properties) {
        foreach ($ds in $dsType.Value) {
            # Check transform references
            if ($ds.transform -and $ds.transform -notin $namedTransforms) {
                $errors += "DataSource '$($ds.name)' references transform '$($ds.transform)' which is not defined in transformations"
            }
            # Check custom stream declarations
            # Note: data sources with a 'transform' reference use implicitly-derived custom streams
            # that should NOT be in streamDeclarations (except logFiles). Skip this check for those.
            if ($ds.streams) {
                foreach ($stream in $ds.streams) {
                    if ($stream.StartsWith("Custom-") -and $stream -notin $declaredStreams) {
                        if ($ds.transform) {
                            # Transform-derived custom stream — implicit schema, OK to skip declaration
                        } elseif ($dsType.Name -eq 'logFiles') {
                            $errors += "DataSource '$($ds.name)' uses stream '$stream' not declared in streamDeclarations"
                        } else {
                            $errors += "DataSource '$($ds.name)' uses stream '$stream' not declared in streamDeclarations"
                        }
                    }
                }
            }
        }
    }
}

# Validate data flows
# Standard tables that accept custom streams (from Log Ingestion API supported tables list)
$supportedStandardTables = @(
    'ABAPAuditLog','ABAPAuthorizationDetails','ABAPChangeDocsLog','ABAPUserDetails',
    'ADAssessmentRecommendation','ADSecurityAssessmentRecommendation','Anomalies',
    'ASimAuditEventLogs','ASimAuthenticationEventLogs','ASimDhcpEventLogs','ASimDnsActivityLogs',
    'ASimFileEventLogs','ASimNetworkSessionLogs','ASimProcessEventLogs','ASimRegistryEventLogs',
    'ASimUserManagementActivityLogs','ASimWebSessionLogs',
    'AWSALBAccessLogs','AWSCloudTrail','AWSCloudWatch','AWSEKS','AWSELBFlowLogs','AWSGuardDuty',
    'AWSNetworkFirewallAlert','AWSNetworkFirewallFlow','AWSNetworkFirewallTls','AWSNLBAccessLogs',
    'AWSRoute53Resolver','AWSS3ServerAccess','AWSSecurityHubFindings','AWSVPCFlow','AWSWAF',
    'AzureAssessmentRecommendation','AzureMetricsV2','CommonSecurityLog',
    'CrowdStrikeAlerts','CrowdStrikeCases','CrowdStrikeDetections','CrowdStrikeHosts',
    'CrowdStrikeIncidents','CrowdStrikeVulnerabilities',
    'DeviceTvmSecureConfigurationAssessmentKB','DeviceTvmSoftwareVulnerabilitiesKB',
    'DnsAuditEvents','Event',
    'ExchangeAssessmentRecommendation','ExchangeOnlineAssessmentRecommendation',
    'GCPApigee','GCPAuditLogs','GCPCDN','GCPCloudRun','GCPCloudSQL','GCPComputeEngine',
    'GCPDNS','GCPFirewallLogs','GCPIAM','GCPIDS','GCPMonitoring','GCPNAT','GCPNATAudit',
    'GCPResourceManager','GCPVPCFlow','GKEAPIServer','GKEApplication','GKEAudit',
    'GKEControllerManager','GKEHPADecision','GKEScheduler','GoogleCloudSCC','GoogleWorkspaceReports',
    'IlumioInsights','OTelLogs','QualysKnowledgeBase',
    'Rapid7InsightVMCloudAssets','Rapid7InsightVMCloudVulnerabilities',
    'SCCMAssessmentRecommendation','SCOMAssessmentRecommendation','SecurityEvent',
    'SfBAssessmentRecommendation','SfBOnlineAssessmentRecommendation',
    'SharePointOnlineAssessmentRecommendation','SPAssessmentRecommendation','SQLAssessmentRecommendation',
    'Syslog','ThreatIntelIndicators','ThreatIntelligenceIndicator','ThreatIntelObjects',
    'UCClient','UCClientReadinessStatus','UCClientUpdateStatus','UCDeviceAlert',
    'UCDOAggregatedStatus','UCDOStatus','UCServiceUpdateStatus','UCUpdateAlert',
    'WindowsClientAssessmentRecommendation','WindowsEvent','WindowsServerAssessmentRecommendation'
)

if ($props.dataFlows) {
    foreach ($df in $props.dataFlows) {
        # Check mutual exclusivity
        if ($df.transform -and $df.transformKql) {
            $errors += "DataFlow has both 'transform' and 'transformKql' (mutually exclusive)"
        }
        # Check transform references
        if ($df.transform -and $df.transform -notin $namedTransforms) {
            $errors += "DataFlow references transform '$($df.transform)' which is not defined in transformations"
        }
        # Check destination references
        if ($df.destinations) {
            foreach ($dest in $df.destinations) {
                if ($dest -notin $destNames) {
                    $errors += "DataFlow references destination '$dest' which is not defined in destinations"
                }
            }
        }
        # Check custom streams
        # Note: transform-derived custom streams from data sources are implicitly declared
        if ($df.streams) {
            $transformDerivedStreams = @()
            if ($props.dataSources) {
                foreach ($dsType2 in $props.dataSources.PSObject.Properties) {
                    foreach ($ds2 in $dsType2.Value) {
                        if ($ds2.transform -and $ds2.streams) { $transformDerivedStreams += $ds2.streams }
                    }
                }
            }
            foreach ($stream in $df.streams) {
                if ($stream.StartsWith("Custom-") -and $stream -notin $declaredStreams -and $stream -notin $transformDerivedStreams) {
                    $errors += "DataFlow uses stream '$stream' not declared in streamDeclarations"
                }
            }
        }
        # Check routing rules
        if ($df.outputStream -and $df.streams) {
            $inputIsCustom = $df.streams | Where-Object { $_.StartsWith("Custom-") }
            $outputIsStandard = $df.outputStream.StartsWith("Microsoft-")
            $outputIsCustom = $df.outputStream.StartsWith("Custom-")

            # Rule: standard stream cannot route to custom table (unless transformKql is present)
            $inputIsStandard = $df.streams | Where-Object { $_.StartsWith("Microsoft-") }
            if ($inputIsStandard -and $outputIsCustom -and -not $df.transformKql) {
                $errors += "DataFlow routes standard stream to custom table '$($df.outputStream)'. Standard streams cannot route to custom tables without transformKql. Add transformKql (even 'source' for pass-through) or use a custom stream."
            }

            # Rule: custom stream to standard table must be on supported list
            if ($inputIsCustom -and $outputIsStandard) {
                $tableName = $df.outputStream -replace '^Microsoft-', ''
                if ($tableName -notin $supportedStandardTables) {
                    $errors += "DataFlow routes custom stream to standard table '$tableName' which is not on the supported tables list. Use the standard stream or route to a custom table."
                }
            }
        }
    }
}

# Validate transformations
if ($props.transformations) {
    foreach ($t in $props.transformations) {
        if (-not $t.name) { $errors += "Transformation missing 'name'" }
        if (-not $t.headerProcessor) { $errors += "Transformation '$($t.name)' missing 'headerProcessor'" }
    }
}

# ── Limits validation (from references/limits.md) ──

# DCR Structure Limits
$dataSourceTypes = @('syslog','windowsEventLogs','performanceCounters','logFiles','iisLogs','extensions')
$dsCount = 0
if ($props.dataSources) {
    foreach ($dsType in $props.dataSources.PSObject.Properties) {
        if ($dsType.Value -is [System.Collections.IEnumerable] -and $dsType.Value -isnot [string]) {
            $dsCount += @($dsType.Value).Count
        } else {
            $dsCount++
        }
    }
}
if ($dsCount -gt 10) { $errors += "DCR has $dsCount data sources (limit: 10)" }

if ($props.dataFlows -and @($props.dataFlows).Count -gt 10) {
    $errors += "DCR has $(@($props.dataFlows).Count) data flows (limit: 10)"
}

$streamCount = 0
if ($props.streamDeclarations) { $streamCount += $props.streamDeclarations.PSObject.Properties.Count }
# Count Microsoft-* streams referenced in dataFlows
$msStreams = @()
if ($props.dataFlows) {
    foreach ($df in $props.dataFlows) {
        if ($df.streams) {
            foreach ($s in $df.streams) {
                if ($s.StartsWith("Microsoft-") -and $s -notin $msStreams) { $msStreams += $s }
            }
        }
    }
}
$totalStreams = $streamCount + $msStreams.Count
if ($totalStreams -gt 20) { $errors += "DCR has $totalStreams streams (limit: 20)" }

$laDestCount = 0
if ($props.destinations -and $props.destinations.logAnalytics) {
    $laDestCount = @($props.destinations.logAnalytics).Count
}
if ($laDestCount -gt 10) { $errors += "DCR has $laDestCount Log Analytics destinations (limit: 10)" }

# transformKql character limit (15,360)
if ($props.dataFlows) {
    foreach ($df in $props.dataFlows) {
        if ($df.transformKql -and $df.transformKql.Length -gt 15360) {
            $errors += "DataFlow transformKql is $($df.transformKql.Length) chars (limit: 15,360)"
        }
    }
}

# Performance counter specifiers limit (100 per data source)
if ($props.dataSources -and $props.dataSources.performanceCounters) {
    foreach ($pc in $props.dataSources.performanceCounters) {
        if ($pc.counterSpecifiers -and @($pc.counterSpecifiers).Count -gt 100) {
            $errors += "Performance counter '$($pc.name)' has $(@($pc.counterSpecifiers).Count) specifiers (limit: 100)"
        }
    }
}

# Syslog facility names limit (20 per data source)
if ($props.dataSources -and $props.dataSources.syslog) {
    foreach ($sl in $props.dataSources.syslog) {
        if ($sl.facilityNames -and @($sl.facilityNames).Count -gt 20) {
            $errors += "Syslog '$($sl.name)' has $(@($sl.facilityNames).Count) facility names (limit: 20)"
        }
    }
}

# Windows Event Log xPathQueries limit (100 per data source)
if ($props.dataSources -and $props.dataSources.windowsEventLogs) {
    foreach ($wel in $props.dataSources.windowsEventLogs) {
        if ($wel.xPathQueries -and @($wel.xPathQueries).Count -gt 100) {
            $errors += "WindowsEventLog '$($wel.name)' has $(@($wel.xPathQueries).Count) xPathQueries (limit: 100)"
        }
    }
}

# DCR name validation for Direct kind
if ($dcr.kind -eq 'Direct' -and $dcr.name) {
    if ($dcr.name.Length -lt 3 -or $dcr.name.Length -gt 30) {
        $errors += "Direct DCR name '$($dcr.name)' must be 3-30 characters (current: $($dcr.name.Length))"
    }
    if ($dcr.name -notmatch '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$') {
        $errors += "Direct DCR name '$($dcr.name)' must be alphanumeric + hyphens only (DNS-safe)"
    }
}

# Stream declaration column validation
if ($props.streamDeclarations) {
    $validColTypes = @('string','int','long','real','boolean','dynamic','datetime')
    foreach ($streamProp in $props.streamDeclarations.PSObject.Properties) {
        $streamName = $streamProp.Name
        $stream = $streamProp.Value
        if ($stream.columns) {
            $cols = @($stream.columns)
            if ($cols.Count -gt 1000) {
                $errors += "Stream '$streamName' has $($cols.Count) columns (limit: 1,000)"
            }
            foreach ($col in $cols) {
                if ($col.name.Length -gt 60) {
                    $errors += "Stream '$streamName' column '$($col.name)' exceeds 60 char name limit"
                }
                if ($col.name -notmatch '^[a-zA-Z][a-zA-Z0-9_]*$') {
                    $errors += "Stream '$streamName' column '$($col.name)' has invalid name (must start with letter, only alphanumeric + underscore)"
                }
                if ($col.type -and $col.type -notin $validColTypes) {
                    $errors += "Stream '$streamName' column '$($col.name)' has unsupported type '$($col.type)' (use: $($validColTypes -join ', '))"
                }
            }
        }
        # Custom stream naming
        if (-not $streamName.StartsWith('Custom-') -and -not $streamName.StartsWith('Microsoft-')) {
            $errors += "Stream '$streamName' must start with 'Custom-' or 'Microsoft-'"
        }
    }
}

# Report
if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "Validation PASSED. No issues found." -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "ERRORS ($($errors.Count)):" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if ($warnings.Count -gt 0) {
        Write-Host "WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
    if ($errors.Count -gt 0) { exit 1 }
}
