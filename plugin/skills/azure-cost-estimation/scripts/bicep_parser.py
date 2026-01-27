#!/usr/bin/env python3
"""
Bicep Template Parser

Parses Bicep (.bicep) files to extract Azure resource definitions for cost estimation.
Uses regex-based parsing since Bicep is not JSON and requires the Bicep CLI for full parsing.

Usage:
    python bicep_parser.py /path/to/template.bicep
    python bicep_parser.py /path/to/template.bicep --params /path/to/params.bicepparam
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class AzureResource:
    """Represents an Azure resource extracted from a template."""
    resource_type: str           # e.g., "Microsoft.Compute/virtualMachines"
    symbolic_name: str           # Bicep symbolic name (e.g., "myVm")
    name: str                    # Resource name (may be parameter reference)
    location: str                # Region (may be parameter reference)
    api_version: str             # API version
    sku: Optional[str] = None    # SKU/size if applicable
    tier: Optional[str] = None   # Tier if applicable
    kind: Optional[str] = None   # Kind if applicable
    properties: dict = field(default_factory=dict)  # Cost-relevant properties
    count: int = 1               # Number of instances (from copy)
    line_number: int = 0         # Source line number

    @property
    def service_name(self) -> str:
        """Map resource type to Azure service name for pricing API."""
        service_map = {
            "Microsoft.Compute/virtualMachines": "Virtual Machines",
            "Microsoft.Storage/storageAccounts": "Storage",
            "Microsoft.Sql/servers/databases": "SQL Database",
            "Microsoft.Sql/servers": "SQL Database",
            "Microsoft.Web/sites": "Azure App Service",
            "Microsoft.Web/serverfarms": "Azure App Service",
            "Microsoft.ContainerService/managedClusters": "Azure Kubernetes Service",
            "Microsoft.App/containerApps": "Azure Container Apps",
            "Microsoft.App/managedEnvironments": "Azure Container Apps",
            "Microsoft.DBforPostgreSQL/flexibleServers": "Azure Database for PostgreSQL",
            "Microsoft.DBforMySQL/flexibleServers": "Azure Database for MySQL",
            "Microsoft.KeyVault/vaults": "Key Vault",
            "Microsoft.ContainerRegistry/registries": "Container Registry",
            "Microsoft.OperationalInsights/workspaces": "Log Analytics",
            "Microsoft.Insights/components": "Application Insights",
            "Microsoft.Network/virtualNetworks": "Virtual Network",
            "Microsoft.Network/publicIPAddresses": "Virtual Network",
            "Microsoft.Network/loadBalancers": "Load Balancer",
            "Microsoft.Network/applicationGateways": "Application Gateway",
            "Microsoft.Cache/Redis": "Azure Cache for Redis",
            "Microsoft.ServiceBus/namespaces": "Service Bus",
            "Microsoft.EventHub/namespaces": "Event Hubs",
            "Microsoft.CognitiveServices/accounts": "Cognitive Services",
            "Microsoft.Web/staticSites": "Azure Static Web Apps",
        }
        return service_map.get(self.resource_type, self.resource_type)


def parse_bicep(content: str) -> list[AzureResource]:
    """
    Parse Bicep template content and extract resources.

    Args:
        content: Raw Bicep template content

    Returns:
        List of AzureResource objects
    """
    resources = []

    # Pattern to match resource declarations
    # resource <name> '<type>@<version>' = { ... }
    resource_pattern = re.compile(
        r"resource\s+(\w+)\s+'([^']+)@([^']+)'\s*=\s*\{",
        re.MULTILINE
    )

    # Find all resource declarations
    for match in resource_pattern.finditer(content):
        symbolic_name = match.group(1)
        resource_type = match.group(2)
        api_version = match.group(3)
        start_pos = match.end()
        line_number = content[:match.start()].count('\n') + 1

        # Extract the resource block content
        block_content = _extract_block(content, start_pos - 1)

        # Parse resource properties
        resource = _parse_resource_block(
            block_content,
            symbolic_name,
            resource_type,
            api_version,
            line_number
        )

        if resource:
            resources.append(resource)

    return resources


def _extract_block(content: str, start_pos: int) -> str:
    """Extract content between matching braces starting at start_pos."""
    brace_count = 0
    in_string = False
    string_char = None
    block_start = None

    i = start_pos
    while i < len(content):
        char = content[i]

        # Handle string literals
        if char in ('"', "'") and (i == 0 or content[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
            i += 1
            continue

        if in_string:
            i += 1
            continue

        # Handle braces
        if char == '{':
            if brace_count == 0:
                block_start = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                return content[block_start:i+1]

        i += 1

    return ""


def _parse_resource_block(
    block: str,
    symbolic_name: str,
    resource_type: str,
    api_version: str,
    line_number: int
) -> Optional[AzureResource]:
    """Parse a resource block to extract properties."""
    resource = AzureResource(
        resource_type=resource_type,
        symbolic_name=symbolic_name,
        name=_extract_property(block, "name") or symbolic_name,
        location=_extract_property(block, "location") or "unknown",
        api_version=api_version,
        line_number=line_number
    )

    # Extract SKU - can be nested
    sku_block = _extract_nested_block(block, "sku")
    if sku_block:
        resource.sku = _extract_property(sku_block, "name")
        resource.tier = _extract_property(sku_block, "tier")

    # Extract kind
    resource.kind = _extract_property(block, "kind")

    # Resource-specific property extraction
    resource.properties = _extract_cost_properties(block, resource_type)

    return resource


def _extract_property(block: str, prop_name: str) -> Optional[str]:
    """Extract a simple property value from a block."""
    # Match: propertyName: 'value' or propertyName: "value"
    pattern = re.compile(
        rf"\b{prop_name}\s*:\s*['\"]([^'\"]+)['\"]",
        re.IGNORECASE
    )
    match = pattern.search(block)
    if match:
        return match.group(1)

    # Match: propertyName: variableName (reference)
    pattern_ref = re.compile(
        rf"\b{prop_name}\s*:\s*(\w+)\b",
        re.IGNORECASE
    )
    match = pattern_ref.search(block)
    if match:
        value = match.group(1)
        # Skip keywords
        if value.lower() not in ('true', 'false', 'null', 'if', 'for'):
            return f"${{{value}}}"  # Return as parameter reference

    return None


def _extract_nested_block(content: str, block_name: str) -> Optional[str]:
    """Extract a nested block by name."""
    # Match: blockName: { ... }
    pattern = re.compile(
        rf"\b{block_name}\s*:\s*\{{",
        re.IGNORECASE
    )
    match = pattern.search(content)
    if match:
        return _extract_block(content, match.end() - 1)
    return None


def _extract_array(content: str, start_pos: int) -> str:
    """Extract content between matching brackets starting at start_pos."""
    bracket_count = 0
    in_string = False
    string_char = None
    array_start = None

    i = start_pos
    while i < len(content):
        char = content[i]

        # Handle string literals
        if char in ('"', "'") and (i == 0 or content[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
            i += 1
            continue

        if in_string:
            i += 1
            continue

        # Handle brackets
        if char == '[':
            if bracket_count == 0:
                array_start = i
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1
            if bracket_count == 0:
                return content[array_start:i+1]

        i += 1

    return ""


def _extract_cost_properties(block: str, resource_type: str) -> dict:
    """Extract resource-specific properties that affect cost."""
    props = {}

    # Virtual Machines
    if "virtualMachines" in resource_type:
        # Hardware profile -> vmSize
        hw_block = _extract_nested_block(block, "hardwareProfile")
        if hw_block:
            vm_size = _extract_property(hw_block, "vmSize")
            if vm_size:
                props["vmSize"] = vm_size

        # OS type from imageReference
        image_block = _extract_nested_block(block, "imageReference")
        if image_block:
            offer = _extract_property(image_block, "offer")
            if offer:
                props["osType"] = "Windows" if "windows" in offer.lower() else "Linux"

        # Disk size
        os_disk_block = _extract_nested_block(block, "osDisk")
        if os_disk_block:
            disk_size = _extract_property(os_disk_block, "diskSizeGB")
            if disk_size:
                props["osDiskSizeGB"] = disk_size

    # Storage Accounts
    elif "storageAccounts" in resource_type:
        # Access tier
        access_tier = _extract_property(block, "accessTier")
        if access_tier:
            props["accessTier"] = access_tier

        # Kind (StorageV2, BlobStorage, etc.)
        kind = _extract_property(block, "kind")
        if kind:
            props["kind"] = kind

    # App Service Plans (serverfarms only - sites handled separately for Function Apps)
    elif "serverfarms" in resource_type:
        # Capacity (number of instances)
        capacity = _extract_property(block, "capacity")
        if capacity:
            props["capacity"] = capacity

    # SQL Database
    elif "databases" in resource_type:
        # DTU/vCore
        dtu = _extract_property(block, "requestedServiceObjectiveName")
        if dtu:
            props["dtu"] = dtu

    # AKS
    elif "managedClusters" in resource_type:
        # Agent pool profiles
        agent_block = _extract_nested_block(block, "agentPoolProfiles")
        if agent_block:
            count = _extract_property(agent_block, "count")
            vm_size = _extract_property(agent_block, "vmSize")
            if count:
                props["nodeCount"] = count
            if vm_size:
                props["nodeVmSize"] = vm_size

    # Container Apps
    elif "containerApps" in resource_type:
        # Container Apps have deeply nested resources: template > containers > [item] > resources
        template_block = _extract_nested_block(block, "template")
        if template_block:
            # Find containers array - look for resources inside it
            containers_match = re.search(r'containers\s*:\s*\[', template_block)
            if containers_match:
                # Extract the array content
                array_content = _extract_array(template_block, containers_match.end() - 1)
                if array_content:
                    # Find resources block inside the container
                    resources_block = _extract_nested_block(array_content, "resources")
                    if resources_block:
                        cpu = _extract_property(resources_block, "cpu")
                        memory = _extract_property(resources_block, "memory")
                        if cpu:
                            # Handle json(cpu) function - extract the parameter
                            json_match = re.search(r'json\s*\(\s*(\w+)\s*\)', cpu)
                            if json_match:
                                props["cpu"] = f"${{{json_match.group(1)}}}"
                            else:
                                props["cpu"] = cpu
                        if memory:
                            props["memory"] = memory

            # Also extract scale settings for replica count
            scale_block = _extract_nested_block(template_block, "scale")
            if scale_block:
                min_replicas = _extract_property(scale_block, "minReplicas")
                max_replicas = _extract_property(scale_block, "maxReplicas")
                if min_replicas:
                    props["minReplicas"] = min_replicas
                if max_replicas:
                    props["maxReplicas"] = max_replicas

    # Log Analytics workspaces
    elif "workspaces" in resource_type and "OperationalInsights" in resource_type:
        # Extract SKU and retention
        sku_block = _extract_nested_block(block, "sku")
        if sku_block:
            sku_name = _extract_property(sku_block, "name")
            if sku_name:
                props["sku"] = sku_name
        retention = _extract_property(block, "retentionInDays")
        if retention:
            props["retentionInDays"] = retention

    # Static Web Apps
    elif "staticSites" in resource_type:
        # Extract SKU (Free or Standard)
        sku_block = _extract_nested_block(block, "sku")
        if sku_block:
            sku_name = _extract_property(sku_block, "name")
            tier = _extract_property(sku_block, "tier")
            if sku_name:
                props["sku"] = sku_name
            if tier:
                props["tier"] = tier

    # Function Apps / Web Apps (Microsoft.Web/sites)
    elif "sites" in resource_type and "Web" in resource_type:
        # Check if it's a Function App - kind is at top level in Bicep
        # Look for: kind: 'functionapp' or kind: 'functionapp,linux'
        kind_match = re.search(r"\bkind\s*:\s*['\"]([^'\"]+)['\"]", block)
        if kind_match:
            kind = kind_match.group(1)
            props["kind"] = kind
            if "functionapp" in kind.lower():
                props["isFunction"] = True
        # Get the server farm (App Service Plan) reference
        server_farm = _extract_property(block, "serverFarmId")
        if server_farm:
            props["serverFarmId"] = server_farm

    # Container Apps Jobs
    elif "jobs" in resource_type and "App" in resource_type:
        # Extract job configuration
        config_block = _extract_nested_block(block, "configuration")
        if config_block:
            trigger_type = _extract_property(config_block, "triggerType")
            if trigger_type:
                props["triggerType"] = trigger_type
            replica_timeout = _extract_property(config_block, "replicaTimeout")
            if replica_timeout:
                props["replicaTimeout"] = replica_timeout
        # Extract resources from template
        template_block = _extract_nested_block(block, "template")
        if template_block:
            containers_match = re.search(r'containers\s*:\s*\[', template_block)
            if containers_match:
                array_content = _extract_array(template_block, containers_match.end() - 1)
                if array_content:
                    resources_block = _extract_nested_block(array_content, "resources")
                    if resources_block:
                        cpu = _extract_property(resources_block, "cpu")
                        memory = _extract_property(resources_block, "memory")
                        if cpu:
                            json_match = re.search(r'json\s*\(\s*(\w+)\s*\)', cpu)
                            if json_match:
                                props["cpu"] = f"${{{json_match.group(1)}}}"
                            else:
                                props["cpu"] = cpu
                        if memory:
                            props["memory"] = memory

    # Container Registry
    elif "registries" in resource_type and "ContainerRegistry" in resource_type:
        sku_block = _extract_nested_block(block, "sku")
        if sku_block:
            sku_name = _extract_property(sku_block, "name")
            if sku_name:
                props["sku"] = sku_name

    # Application Insights
    elif "components" in resource_type and "Insights" in resource_type:
        # Application type
        app_type = _extract_property(block, "Application_Type")
        if app_type:
            props["applicationType"] = app_type
        # Ingestion mode
        ingestion_mode = _extract_property(block, "IngestionMode")
        if ingestion_mode:
            props["ingestionMode"] = ingestion_mode

    # Container Apps - check for workload profile (Dedicated vs Consumption)
    elif "managedEnvironments" in resource_type:
        # Check for workload profiles (indicates Dedicated plan)
        workload_profiles = _extract_nested_block(block, "workloadProfiles")
        if workload_profiles:
            props["planType"] = "Dedicated"
            # Try to extract profile details
            profile_name = _extract_property(workload_profiles, "name")
            profile_type = _extract_property(workload_profiles, "workloadProfileType")
            if profile_name:
                props["profileName"] = profile_name
            if profile_type:
                props["profileType"] = profile_type
        else:
            props["planType"] = "Consumption"

    # Key Vault
    elif "vaults" in resource_type and "KeyVault" in resource_type:
        # SKU family
        family = _extract_property(block, "family")
        if family:
            props["family"] = family

    return props


def parse_parameters(content: str) -> dict:
    """Parse Bicep parameter declarations to get default values."""
    params = {}

    # Pattern: param <name> <type> = '<value>'
    param_pattern = re.compile(
        r"param\s+(\w+)\s+\w+\s*=\s*['\"]([^'\"]+)['\"]",
        re.MULTILINE
    )

    for match in param_pattern.finditer(content):
        params[match.group(1)] = match.group(2)

    return params


def parse_bicepparam(content: str) -> dict:
    """Parse .bicepparam file to get parameter values."""
    params = {}

    # Pattern: param <name> = '<value>'
    param_pattern = re.compile(
        r"param\s+(\w+)\s*=\s*['\"]([^'\"]+)['\"]",
        re.MULTILINE
    )

    for match in param_pattern.finditer(content):
        params[match.group(1)] = match.group(2)

    return params


def resolve_parameters(resources: list[AzureResource], params: dict) -> list[AzureResource]:
    """Resolve parameter references in resources."""
    for resource in resources:
        # Resolve name
        if resource.name.startswith("${"):
            param_name = resource.name[2:-1]
            if param_name in params:
                resource.name = params[param_name]

        # Resolve location
        if resource.location.startswith("${"):
            param_name = resource.location[2:-1]
            if param_name in params:
                resource.location = params[param_name]

        # Resolve SKU
        if resource.sku and resource.sku.startswith("${"):
            param_name = resource.sku[2:-1]
            if param_name in params:
                resource.sku = params[param_name]

        # Resolve properties
        for key, value in resource.properties.items():
            if isinstance(value, str) and value.startswith("${"):
                param_name = value[2:-1]
                if param_name in params:
                    resource.properties[key] = params[param_name]

    return resources


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Parse Bicep templates to extract Azure resources",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python bicep_parser.py main.bicep
  python bicep_parser.py main.bicep --params main.bicepparam
  python bicep_parser.py main.bicep --json
        """
    )

    parser.add_argument("template", help="Path to Bicep template file")
    parser.add_argument("--params", help="Path to parameter file (.bicepparam or .json)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Read template
    template_path = Path(args.template)
    if not template_path.exists():
        print(f"Error: Template not found: {args.template}", file=sys.stderr)
        sys.exit(1)

    content = template_path.read_text(encoding="utf-8")

    # Parse resources
    resources = parse_bicep(content)

    # Parse and resolve parameters
    params = parse_parameters(content)  # Get defaults from template

    if args.params:
        params_path = Path(args.params)
        if params_path.exists():
            params_content = params_path.read_text(encoding="utf-8")
            if params_path.suffix == ".bicepparam":
                params.update(parse_bicepparam(params_content))
            elif params_path.suffix == ".json":
                params.update(json.loads(params_content).get("parameters", {}))

    resources = resolve_parameters(resources, params)

    # Output
    if args.json:
        output = [asdict(r) for r in resources]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nParsed {len(resources)} resources from {args.template}\n")
        print(f"{'#':<3} {'Symbolic Name':<20} {'Type':<45} {'SKU':<20}")
        print("=" * 90)

        for i, r in enumerate(resources, 1):
            sku = r.sku or r.properties.get("vmSize", "-")
            print(f"{i:<3} {r.symbolic_name:<20} {r.resource_type:<45} {sku:<20}")

        print("\n" + "=" * 90)
        print("\nResource Details:\n")

        for r in resources:
            print(f"  {r.symbolic_name}:")
            print(f"    Type:     {r.resource_type}")
            print(f"    Name:     {r.name}")
            print(f"    Location: {r.location}")
            if r.sku:
                print(f"    SKU:      {r.sku}")
            if r.tier:
                print(f"    Tier:     {r.tier}")
            if r.properties:
                print(f"    Properties: {json.dumps(r.properties, indent=6)}")
            print()


if __name__ == "__main__":
    main()
