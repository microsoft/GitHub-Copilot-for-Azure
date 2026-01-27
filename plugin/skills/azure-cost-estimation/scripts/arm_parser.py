#!/usr/bin/env python3
"""
ARM Template Parser

Parses ARM JSON template files to extract Azure resource definitions for cost estimation.

Usage:
    python arm_parser.py /path/to/template.json
    python arm_parser.py /path/to/template.json --params /path/to/parameters.json
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional


@dataclass
class AzureResource:
    """Represents an Azure resource extracted from a template."""
    resource_type: str           # e.g., "Microsoft.Compute/virtualMachines"
    name: str                    # Resource name (may be expression)
    location: str                # Region (may be expression)
    api_version: str             # API version
    sku: Optional[str] = None    # SKU/size if applicable
    tier: Optional[str] = None   # Tier if applicable
    kind: Optional[str] = None   # Kind if applicable
    properties: dict = field(default_factory=dict)  # Cost-relevant properties
    count: int = 1               # Number of instances (from copy)
    depends_on: list = field(default_factory=list)  # Dependencies

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
        }
        return service_map.get(self.resource_type, self.resource_type)


def parse_arm_template(content: str) -> tuple[list[AzureResource], dict, dict]:
    """
    Parse ARM template JSON content and extract resources.

    Args:
        content: Raw ARM template JSON content

    Returns:
        Tuple of (resources, parameters, variables)
    """
    try:
        template = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        return [], {}, {}

    # Validate it's an ARM template
    schema = template.get("$schema", "")
    if "deploymentTemplate" not in schema and "subscriptionDeploymentTemplate" not in schema:
        print("Warning: File may not be an ARM template (missing $schema)", file=sys.stderr)

    # Extract parameters with defaults
    parameters = {}
    for name, param in template.get("parameters", {}).items():
        parameters[name] = param.get("defaultValue", f"[parameters('{name}')]")

    # Extract variables
    variables = template.get("variables", {})

    # Parse resources
    resources = []
    for resource_def in template.get("resources", []):
        parsed = _parse_resource(resource_def)
        if parsed:
            resources.extend(parsed)

    return resources, parameters, variables


def _parse_resource(resource_def: dict) -> list[AzureResource]:
    """Parse a single resource definition, handling copy loops."""
    resources = []

    resource_type = resource_def.get("type", "")
    api_version = resource_def.get("apiVersion", "")
    name = resource_def.get("name", "")
    location = resource_def.get("location", "unknown")
    kind = resource_def.get("kind")

    # Handle copy loops
    copy = resource_def.get("copy")
    count = 1
    if copy:
        copy_count = copy.get("count", 1)
        if isinstance(copy_count, int):
            count = copy_count
        # For expressions, default to 1 but note it

    # Extract SKU
    sku_obj = resource_def.get("sku", {})
    sku = None
    tier = None
    if isinstance(sku_obj, dict):
        sku = sku_obj.get("name")
        tier = sku_obj.get("tier")
    elif isinstance(sku_obj, str):
        sku = sku_obj

    # Extract cost-relevant properties
    properties = _extract_cost_properties(resource_def, resource_type)

    resource = AzureResource(
        resource_type=resource_type,
        name=name,
        location=location,
        api_version=api_version,
        sku=sku,
        tier=tier,
        kind=kind,
        properties=properties,
        count=count,
        depends_on=resource_def.get("dependsOn", [])
    )

    resources.append(resource)

    # Handle nested resources
    for nested in resource_def.get("resources", []):
        nested_type = f"{resource_type}/{nested.get('type', '')}"
        nested["type"] = nested_type
        if "location" not in nested:
            nested["location"] = location
        nested_resources = _parse_resource(nested)
        resources.extend(nested_resources)

    return resources


def _extract_cost_properties(resource_def: dict, resource_type: str) -> dict:
    """Extract resource-specific properties that affect cost."""
    props = {}
    properties = resource_def.get("properties", {})

    # Virtual Machines
    if "virtualMachines" in resource_type:
        # VM size
        hw_profile = properties.get("hardwareProfile", {})
        vm_size = hw_profile.get("vmSize")
        if vm_size:
            props["vmSize"] = vm_size

        # OS type
        storage_profile = properties.get("storageProfile", {})
        image_ref = storage_profile.get("imageReference", {})
        offer = image_ref.get("offer", "")
        if "windows" in offer.lower():
            props["osType"] = "Windows"
        else:
            props["osType"] = "Linux"

        # OS disk size
        os_disk = storage_profile.get("osDisk", {})
        disk_size = os_disk.get("diskSizeGB")
        if disk_size:
            props["osDiskSizeGB"] = disk_size

        # Data disks
        data_disks = storage_profile.get("dataDisks", [])
        if data_disks:
            props["dataDiskCount"] = len(data_disks)

    # Storage Accounts
    elif "storageAccounts" in resource_type:
        props["accessTier"] = properties.get("accessTier")
        props["kind"] = resource_def.get("kind")

        # Large file shares
        props["largeFileShares"] = properties.get("largeFileSharesState")

    # App Service / Web Apps
    elif "sites" in resource_type or "serverfarms" in resource_type:
        # Server farm ID
        props["serverFarmId"] = properties.get("serverFarmId")

        # For App Service Plans
        sku = resource_def.get("sku", {})
        if isinstance(sku, dict):
            props["capacity"] = sku.get("capacity", 1)

    # SQL Database
    elif "databases" in resource_type:
        props["requestedServiceObjectiveName"] = properties.get("requestedServiceObjectiveName")
        props["maxSizeBytes"] = properties.get("maxSizeBytes")

        # Elastic pool
        props["elasticPoolId"] = properties.get("elasticPoolId")

    # AKS
    elif "managedClusters" in resource_type:
        agent_pools = properties.get("agentPoolProfiles", [])
        if agent_pools:
            # Sum up all node counts
            total_nodes = 0
            vm_sizes = []
            for pool in agent_pools:
                count = pool.get("count", 1)
                total_nodes += count
                vm_sizes.append(pool.get("vmSize", "unknown"))

            props["totalNodeCount"] = total_nodes
            props["nodeVmSizes"] = vm_sizes

    # Container Apps
    elif "containerApps" in resource_type:
        template = properties.get("template", {})
        containers = template.get("containers", [])
        if containers:
            # Get resources from first container
            resources = containers[0].get("resources", {})
            props["cpu"] = resources.get("cpu")
            props["memory"] = resources.get("memory")

        # Scale
        scale = template.get("scale", {})
        props["minReplicas"] = scale.get("minReplicas", 0)
        props["maxReplicas"] = scale.get("maxReplicas", 10)

    # Key Vault
    elif "vaults" in resource_type and "KeyVault" in resource_type:
        sku = resource_def.get("sku", {})
        props["family"] = sku.get("family")
        props["name"] = sku.get("name")  # standard or premium

    # PostgreSQL/MySQL Flexible Server
    elif "flexibleServers" in resource_type:
        props["storageSizeGB"] = properties.get("storage", {}).get("storageSizeGB")

    # Container Registry
    elif "registries" in resource_type:
        sku = resource_def.get("sku", {})
        props["sku"] = sku.get("name")  # Basic, Standard, Premium

    # Log Analytics
    elif "workspaces" in resource_type and "OperationalInsights" in resource_type:
        props["retentionInDays"] = properties.get("retentionInDays")
        sku = resource_def.get("sku", {})
        props["sku"] = sku.get("name")  # PerGB2018, etc.

    return props


def resolve_arm_expression(expr: Any, parameters: dict, variables: dict) -> Any:
    """
    Attempt to resolve ARM template expressions.

    Note: This is a simplified resolver. Full ARM expression evaluation
    requires the Azure deployment engine.
    """
    if not isinstance(expr, str):
        return expr

    if not expr.startswith("[") or not expr.endswith("]"):
        return expr

    inner = expr[1:-1].strip()

    # Handle parameters()
    param_match = re.match(r"parameters\('([^']+)'\)", inner)
    if param_match:
        param_name = param_match.group(1)
        return parameters.get(param_name, expr)

    # Handle variables()
    var_match = re.match(r"variables\('([^']+)'\)", inner)
    if var_match:
        var_name = var_match.group(1)
        return variables.get(var_name, expr)

    # Handle resourceGroup().location
    if "resourceGroup().location" in inner:
        return parameters.get("location", "eastus")

    # Handle concat - simplified
    concat_match = re.match(r"concat\((.+)\)", inner)
    if concat_match:
        # This is simplified - real concat is more complex
        return expr

    return expr


def resolve_resources(
    resources: list[AzureResource],
    parameters: dict,
    variables: dict
) -> list[AzureResource]:
    """Resolve expressions in resource properties."""
    for resource in resources:
        resource.name = resolve_arm_expression(resource.name, parameters, variables)
        resource.location = resolve_arm_expression(resource.location, parameters, variables)

        if resource.sku:
            resource.sku = resolve_arm_expression(resource.sku, parameters, variables)

        # Resolve properties
        for key, value in resource.properties.items():
            resource.properties[key] = resolve_arm_expression(value, parameters, variables)

    return resources


def parse_parameters_file(content: str) -> dict:
    """Parse ARM parameters file."""
    try:
        params_json = json.loads(content)
    except json.JSONDecodeError:
        return {}

    parameters = {}
    params_section = params_json.get("parameters", params_json)

    for name, param in params_section.items():
        if isinstance(param, dict):
            parameters[name] = param.get("value", param.get("defaultValue"))
        else:
            parameters[name] = param

    return parameters


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Parse ARM templates to extract Azure resources",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python arm_parser.py azuredeploy.json
  python arm_parser.py azuredeploy.json --params azuredeploy.parameters.json
  python arm_parser.py azuredeploy.json --json
        """
    )

    parser.add_argument("template", help="Path to ARM template file")
    parser.add_argument("--params", help="Path to parameters file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Read template
    template_path = Path(args.template)
    if not template_path.exists():
        print(f"Error: Template not found: {args.template}", file=sys.stderr)
        sys.exit(1)

    content = template_path.read_text(encoding="utf-8")

    # Parse template
    resources, parameters, variables = parse_arm_template(content)

    # Load parameters file if provided
    if args.params:
        params_path = Path(args.params)
        if params_path.exists():
            params_content = params_path.read_text(encoding="utf-8")
            file_params = parse_parameters_file(params_content)
            parameters.update(file_params)

    # Resolve expressions
    resources = resolve_resources(resources, parameters, variables)

    # Output
    if args.json:
        output = [asdict(r) for r in resources]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nParsed {len(resources)} resources from {args.template}\n")
        print(f"{'#':<3} {'Type':<50} {'SKU':<20} {'Count':<6}")
        print("=" * 85)

        for i, r in enumerate(resources, 1):
            sku = r.sku or r.properties.get("vmSize", "-")
            print(f"{i:<3} {r.resource_type:<50} {sku:<20} {r.count:<6}")

        print("\n" + "=" * 85)
        print("\nResource Details:\n")

        for r in resources:
            print(f"  {r.name}:")
            print(f"    Type:     {r.resource_type}")
            print(f"    Location: {r.location}")
            if r.sku:
                print(f"    SKU:      {r.sku}")
            if r.tier:
                print(f"    Tier:     {r.tier}")
            if r.count > 1:
                print(f"    Count:    {r.count}")
            if r.properties:
                print(f"    Properties: {json.dumps(r.properties, indent=6)}")
            print()


if __name__ == "__main__":
    main()
