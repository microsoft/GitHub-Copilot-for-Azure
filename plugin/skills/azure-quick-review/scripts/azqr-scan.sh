#!/bin/bash
# Azure Quick Review (azqr) Scan Scripts
# Common scanning scenarios for Azure compliance assessment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# =============================================================================
# Prerequisites
# =============================================================================

# Check if azqr is installed
check_azqr_installed() {
    if command -v azqr &> /dev/null; then
        echo -e "${GREEN}azqr is installed: $(azqr --version)${NC}"
        return 0
    else
        echo -e "${RED}azqr is not installed.${NC}"
        echo "Install with: bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/azure/azqr/main/scripts/install.sh)\""
        return 1
    fi
}

# Check Azure CLI authentication
check_azure_auth() {
    if account=$(az account show 2>/dev/null); then
        user=$(echo "$account" | jq -r '.user.name')
        sub_name=$(echo "$account" | jq -r '.name')
        sub_id=$(echo "$account" | jq -r '.id')
        echo -e "${GREEN}Authenticated as: $user${NC}"
        echo -e "${GREEN}Subscription: $sub_name ($sub_id)${NC}"
        return 0
    else
        echo -e "${RED}Not authenticated. Run 'az login' first.${NC}"
        return 1
    fi
}

# =============================================================================
# Basic Scans
# =============================================================================

# Full subscription scan with all outputs
full_subscription_scan() {
    local subscription_id="$1"
    local output_name="${2:-azqr-scan-$(date +%Y%m%d-%H%M%S)}"
    
    if [[ -z "$subscription_id" ]]; then
        echo -e "${RED}Usage: full_subscription_scan <subscription-id> [output-name]${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting full subscription scan...${NC}"
    azqr scan -s "$subscription_id" --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved:${NC}"
        echo -e "${GRAY}  - ${output_name}.xlsx${NC}"
        echo -e "${GRAY}  - ${output_name}.json${NC}"
    fi
}

# Resource group scan
resource_group_scan() {
    local subscription_id="$1"
    local resource_group="$2"
    local output_name="${3:-azqr-rg-scan-$(date +%Y%m%d-%H%M%S)}"
    
    if [[ -z "$subscription_id" || -z "$resource_group" ]]; then
        echo -e "${RED}Usage: resource_group_scan <subscription-id> <resource-group> [output-name]${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting resource group scan: $resource_group...${NC}"
    azqr scan -s "$subscription_id" -g "$resource_group" --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved to ${output_name}.*${NC}"
    fi
}

# Management group scan (enterprise-wide)
management_group_scan() {
    local mg_id="$1"
    local output_name="${2:-azqr-mg-scan-$(date +%Y%m%d-%H%M%S)}"
    
    if [[ -z "$mg_id" ]]; then
        echo -e "${RED}Usage: management_group_scan <management-group-id> [output-name]${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting management group scan: $mg_id...${NC}"
    echo -e "${YELLOW}This may take a while for large environments...${NC}"
    azqr scan --management-group-id "$mg_id" --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved to ${output_name}.*${NC}"
    fi
}

# =============================================================================
# Service-Specific Scans
# =============================================================================

# Scan specific service type only
service_scan() {
    local subscription_id="$1"
    local service_type="$2"
    local output_name="${3:-azqr-${service_type}-scan-$(date +%Y%m%d-%H%M%S)}"
    
    local valid_services="aa adf afd afw agw aif aks amg apim appcs appi arc asp ca cosmos cr kv lb mysql psql redis sb sql st vm vmss vnet"
    
    if [[ -z "$subscription_id" || -z "$service_type" ]]; then
        echo -e "${RED}Usage: service_scan <subscription-id> <service-type> [output-name]${NC}"
        echo -e "${GRAY}Valid service types: $valid_services${NC}"
        return 1
    fi
    
    if ! echo "$valid_services" | grep -qw "$service_type"; then
        echo -e "${RED}Invalid service type: $service_type${NC}"
        echo -e "${GRAY}Valid service types: $valid_services${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting $service_type service scan...${NC}"
    azqr scan "$service_type" -s "$subscription_id" --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved to ${output_name}.*${NC}"
    fi
}

# =============================================================================
# Advanced Scans
# =============================================================================

# Scan without cost analysis (for users without Cost Management access)
scan_no_cost() {
    local subscription_id="$1"
    local output_name="${2:-azqr-scan-nocost-$(date +%Y%m%d-%H%M%S)}"
    
    if [[ -z "$subscription_id" ]]; then
        echo -e "${RED}Usage: scan_no_cost <subscription-id> [output-name]${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting scan (cost analysis disabled)...${NC}"
    azqr scan -s "$subscription_id" -c=false --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved to ${output_name}.*${NC}"
    fi
}

# Scan with plugins
scan_with_plugins() {
    local subscription_id="$1"
    shift
    local plugins=("$@")
    local output_name="azqr-scan-plugins-$(date +%Y%m%d-%H%M%S)"
    
    if [[ -z "$subscription_id" ]]; then
        echo -e "${RED}Usage: scan_with_plugins <subscription-id> [plugin1] [plugin2] ...${NC}"
        echo -e "${GRAY}Available plugins: carbon-emissions, zone-mapping, openai-throttling${NC}"
        return 1
    fi
    
    local plugin_args=""
    for plugin in "${plugins[@]}"; do
        case "$plugin" in
            carbon-emissions|zone-mapping|openai-throttling)
                plugin_args="$plugin_args --plugin $plugin"
                ;;
            *)
                echo -e "${YELLOW}Unknown plugin: $plugin (skipping)${NC}"
                ;;
        esac
    done
    
    if [[ -z "$plugin_args" ]]; then
        echo -e "${YELLOW}No valid plugins specified.${NC}"
        echo -e "${GRAY}Available plugins: carbon-emissions, zone-mapping, openai-throttling${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Starting scan with plugins:$plugin_args...${NC}"
    azqr scan -s "$subscription_id" $plugin_args --json --xlsx --output-name "$output_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Scan complete. Reports saved to ${output_name}.*${NC}"
    fi
}

# =============================================================================
# Comparison Workflows
# =============================================================================

# Create baseline scan for later comparison
create_baseline() {
    local subscription_id="$1"
    local baseline_name="${2:-baseline-$(date +%Y%m%d)}"
    
    if [[ -z "$subscription_id" ]]; then
        echo -e "${RED}Usage: create_baseline <subscription-id> [baseline-name]${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Creating baseline scan: $baseline_name...${NC}"
    azqr scan -s "$subscription_id" --xlsx --output-name "$baseline_name"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Baseline saved: ${baseline_name}.xlsx${NC}"
        echo -e "${GRAY}Use compare_scans to compare with future scans.${NC}"
    fi
}

# Compare two scan reports
compare_scans() {
    local baseline_report="$1"
    local current_report="$2"
    local output_file="${3:-comparison-$(date +%Y%m%d-%H%M%S).txt}"
    
    if [[ -z "$baseline_report" || -z "$current_report" ]]; then
        echo -e "${RED}Usage: compare_scans <baseline-report> <current-report> [output-file]${NC}"
        return 1
    fi
    
    if [[ ! -f "$baseline_report" ]]; then
        echo -e "${RED}Baseline report not found: $baseline_report${NC}"
        return 1
    fi
    
    if [[ ! -f "$current_report" ]]; then
        echo -e "${RED}Current report not found: $current_report${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Comparing scans...${NC}"
    azqr compare --file1 "$baseline_report" --file2 "$current_report" --output "$output_file"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Comparison saved: $output_file${NC}"
        cat "$output_file"
    fi
}

# =============================================================================
# Interactive Dashboard
# =============================================================================

# Launch web dashboard for a report
show_dashboard() {
    local report_file="$1"
    
    if [[ -z "$report_file" ]]; then
        echo -e "${RED}Usage: show_dashboard <report-file>${NC}"
        return 1
    fi
    
    if [[ ! -f "$report_file" ]]; then
        echo -e "${RED}Report not found: $report_file${NC}"
        return 1
    fi
    
    echo -e "${CYAN}Launching dashboard for $report_file...${NC}"
    azqr show -f "$report_file" --open
}

# =============================================================================
# Utility Functions
# =============================================================================

# List all supported service types
list_service_types() {
    echo -e "${CYAN}Supported Azure service types:${NC}"
    azqr types
}

# List all recommendations
list_rules() {
    local as_json="$1"
    
    if [[ "$as_json" == "--json" ]]; then
        azqr rules --json
    else
        azqr rules
    fi
}

# =============================================================================
# Help
# =============================================================================

show_help() {
    echo -e "
${CYAN}Azure Quick Review (azqr) Scan Functions${NC}
=========================================

${YELLOW}Prerequisites:${NC}
  check_azqr_installed              Check if azqr is installed
  check_azure_auth                  Check Azure CLI authentication

${YELLOW}Basic Scans:${NC}
  full_subscription_scan <sub-id> [output-name]
  resource_group_scan <sub-id> <rg-name> [output-name]
  management_group_scan <mg-id> [output-name]

${YELLOW}Service-Specific Scans:${NC}
  service_scan <sub-id> <service-type> [output-name]
    Service types: aks, apim, appcs, asp, ca, cosmos, cr, kv, lb,
                   mysql, psql, redis, sb, sql, st, vm, vmss, vnet

${YELLOW}Advanced Scans:${NC}
  scan_no_cost <sub-id> [output-name]
  scan_with_plugins <sub-id> <plugin1> [plugin2] ...
    Plugins: carbon-emissions, zone-mapping, openai-throttling

${YELLOW}Comparison Workflows:${NC}
  create_baseline <sub-id> [baseline-name]
  compare_scans <baseline.xlsx> <current.xlsx> [output-file]

${YELLOW}Dashboard:${NC}
  show_dashboard <report-file>

${YELLOW}Utilities:${NC}
  list_service_types                List supported service types
  list_rules [--json]               List all recommendations

${YELLOW}Examples:${NC}
  ${GRAY}# Full subscription scan${NC}
  full_subscription_scan 00000000-0000-0000-0000-000000000000

  ${GRAY}# Scan storage accounts only${NC}
  service_scan 00000000-0000-0000-0000-000000000000 st

  ${GRAY}# Scan with carbon emissions plugin${NC}
  scan_with_plugins 00000000-0000-0000-0000-000000000000 carbon-emissions

  ${GRAY}# Create and compare baselines${NC}
  create_baseline 00000000-0000-0000-0000-000000000000 before-deploy
  # ... make changes ...
  full_subscription_scan 00000000-0000-0000-0000-000000000000 after-deploy
  compare_scans before-deploy.xlsx after-deploy.xlsx
"
}

# =============================================================================
# Main
# =============================================================================

# If sourced, just load functions. If executed directly, show help.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        check-azqr)
            check_azqr_installed
            ;;
        check-auth)
            check_azure_auth
            ;;
        scan)
            full_subscription_scan "$2" "$3"
            ;;
        scan-rg)
            resource_group_scan "$2" "$3" "$4"
            ;;
        scan-mg)
            management_group_scan "$2" "$3"
            ;;
        scan-service)
            service_scan "$2" "$3" "$4"
            ;;
        scan-no-cost)
            scan_no_cost "$2" "$3"
            ;;
        scan-plugins)
            shift
            scan_with_plugins "$@"
            ;;
        baseline)
            create_baseline "$2" "$3"
            ;;
        compare)
            compare_scans "$2" "$3" "$4"
            ;;
        dashboard)
            show_dashboard "$2"
            ;;
        types)
            list_service_types
            ;;
        rules)
            list_rules "$2"
            ;;
        help|--help|-h|*)
            show_help
            ;;
    esac
fi
