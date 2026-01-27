#!/usr/bin/env python3
"""
Azure Cost Calculator

Main entry point for cost estimation. Parses templates and calculates total costs.

Usage:
    python cost_calculator.py /path/to/template.bicep
    python cost_calculator.py /path/to/template.json --region westus2
    python cost_calculator.py /path/to/template.bicep --compare-regions eastus,westus2,northeurope
    python cost_calculator.py /path/to/template.bicep --output report.md
"""

import argparse
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# Import sibling modules
from price_lookup import AzurePricingClient, PriceInfo, HOURS_PER_MONTH
from bicep_parser import parse_bicep, parse_parameters, parse_bicepparam, resolve_parameters as resolve_bicep_params
from arm_parser import parse_arm_template, parse_parameters_file, resolve_resources as resolve_arm_resources


@dataclass
class ResourceCost:
    """Cost breakdown for a single resource."""
    resource_name: str
    resource_type: str
    sku: Optional[str]
    location: str
    hourly_cost: float
    monthly_cost: float
    yearly_cost: float
    count: int = 1
    notes: list = field(default_factory=list)
    reserved_1yr_monthly: Optional[float] = None
    reserved_3yr_monthly: Optional[float] = None

    @property
    def total_monthly(self) -> float:
        return self.monthly_cost * self.count

    @property
    def total_yearly(self) -> float:
        return self.yearly_cost * self.count


@dataclass
class CostReport:
    """Complete cost report for a template."""
    template_path: str
    region: str
    generated_at: str
    total_monthly_cost: float
    total_yearly_cost: float
    resource_count: int
    resource_costs: list[ResourceCost]
    recommendations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    unsupported_resources: list[str] = field(default_factory=list)


class CostCalculator:
    """Calculator for Azure deployment costs."""

    def __init__(self, region: str = "eastus", currency: str = "USD"):
        self.region = region
        self.currency = currency
        self.pricing_client = AzurePricingClient(currency=currency)
        self._price_cache = {}

    def estimate_template_cost(
        self,
        template_path: str,
        param_file: Optional[str] = None
    ) -> CostReport:
        """
        Parse template and calculate total cost.

        Args:
            template_path: Path to Bicep or ARM template
            param_file: Optional path to parameter file

        Returns:
            CostReport with itemized breakdown
        """
        path = Path(template_path)

        if not path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")

        content = path.read_text(encoding="utf-8")

        # Detect template type and parse
        if path.suffix == ".bicep":
            resources = self._parse_bicep_template(content, param_file)
        elif path.suffix == ".json":
            resources = self._parse_arm_template(content, param_file)
        else:
            raise ValueError(f"Unsupported template type: {path.suffix}")

        # Calculate costs
        resource_costs = []
        warnings = []
        unsupported = []
        recommendations = []

        for resource in resources:
            try:
                cost = self._calculate_resource_cost(resource)
                if cost:
                    resource_costs.append(cost)
                else:
                    unsupported.append(f"{resource.resource_type} ({resource.name})")
            except Exception as e:
                warnings.append(f"Error calculating cost for {resource.name}: {str(e)}")

        # Calculate totals
        total_monthly = sum(rc.total_monthly for rc in resource_costs)
        total_yearly = sum(rc.total_yearly for rc in resource_costs)

        # Generate recommendations
        recommendations = self._generate_recommendations(resource_costs, total_monthly)

        return CostReport(
            template_path=str(template_path),
            region=self.region,
            generated_at=datetime.now().isoformat(),
            total_monthly_cost=total_monthly,
            total_yearly_cost=total_yearly,
            resource_count=len(resource_costs),
            resource_costs=resource_costs,
            recommendations=recommendations,
            warnings=warnings,
            unsupported_resources=unsupported
        )

    def _parse_bicep_template(self, content: str, param_file: Optional[str]) -> list:
        """Parse Bicep template."""
        resources = parse_bicep(content)

        # Get parameters
        params = parse_parameters(content)
        if param_file:
            param_path = Path(param_file)
            if param_path.exists():
                param_content = param_path.read_text(encoding="utf-8")
                if param_path.suffix == ".bicepparam":
                    params.update(parse_bicepparam(param_content))
                elif param_path.suffix == ".json":
                    # Normalize ARM-style parameters {name: {value: ...}} to {name: value}
                    raw_params = json.loads(param_content).get("parameters", {})
                    normalized = {
                        name: (val.get("value") if isinstance(val, dict) and "value" in val else val)
                        for name, val in raw_params.items()
                    }
                    params.update(normalized)

        # Set default location if not in params
        if "location" not in params:
            params["location"] = self.region

        return resolve_bicep_params(resources, params)

    def _parse_arm_template(self, content: str, param_file: Optional[str]) -> list:
        """Parse ARM template."""
        resources, parameters, variables = parse_arm_template(content)

        # Load parameters file
        if param_file:
            param_path = Path(param_file)
            if param_path.exists():
                param_content = param_path.read_text(encoding="utf-8")
                file_params = parse_parameters_file(param_content)
                parameters.update(file_params)

        # Set default location
        if "location" not in parameters:
            parameters["location"] = self.region

        return resolve_arm_resources(resources, parameters, variables)

    def _calculate_resource_cost(self, resource) -> Optional[ResourceCost]:
        """Calculate cost for a single resource."""
        resource_type = resource.resource_type
        service_name = resource.service_name

        # Get location - use template location or fall back to default
        location = resource.location
        if location.startswith("${") or location.startswith("["):
            location = self.region

        # Determine SKU
        sku = self._get_resource_sku(resource)

        if not sku:
            # Some resources don't have SKUs (networks, etc.) - may be free or consumption-based
            return self._handle_no_sku_resource(resource, location)

        # Query pricing API
        price_info = self._get_price(service_name, sku, location, resource)

        if not price_info:
            # Try alternative SKU mappings
            price_info = self._try_alternative_sku(resource, location)

        if not price_info:
            return None

        # Calculate costs
        hourly = price_info.retail_price
        monthly = price_info.monthly_cost
        yearly = price_info.yearly_cost

        # Get count from resource
        count = getattr(resource, 'count', 1)

        notes = []
        if hasattr(resource, 'properties'):
            os_type = resource.properties.get('osType')
            if os_type:
                notes.append(os_type)

        # Get reserved pricing
        reserved_1yr = None
        reserved_3yr = None
        if service_name in ("Virtual Machines", "SQL Database", "Azure Database for PostgreSQL"):
            savings = self.pricing_client.get_reserved_savings(service_name, sku, location)
            if savings:
                reserved_1yr = savings.reserved_1yr_monthly
                reserved_3yr = savings.reserved_3yr_monthly

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource_type,
            sku=sku,
            location=location,
            hourly_cost=hourly,
            monthly_cost=monthly,
            yearly_cost=yearly,
            count=count,
            notes=notes,
            reserved_1yr_monthly=reserved_1yr,
            reserved_3yr_monthly=reserved_3yr
        )

    def _get_resource_sku(self, resource) -> Optional[str]:
        """Extract SKU from resource based on type."""
        resource_type = resource.resource_type

        # Container Apps use consumption pricing - handled separately
        if "containerApps" in resource_type or "managedEnvironments" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Log Analytics workspaces - handled separately
        if "workspaces" in resource_type and "OperationalInsights" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Static Web Apps - handled separately
        if "staticSites" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Function Apps - handled separately (Consumption vs Premium)
        props = getattr(resource, 'properties', {})
        if "sites" in resource_type and props.get('isFunction'):
            return None  # Let _handle_no_sku_resource handle it

        # Container Apps Jobs - handled separately
        if "jobs" in resource_type and "App" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Container Registry - handled separately
        if "registries" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Application Insights - handled separately
        if "components" in resource_type and "Insights" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Storage Accounts - handled separately
        if "storageAccounts" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # App Service Plans - handled separately
        if "serverfarms" in resource_type:
            return None  # Let _handle_no_sku_resource handle it

        # Direct SKU property
        if resource.sku:
            return resource.sku

        # Check properties for type-specific SKU locations
        props = getattr(resource, 'properties', {})

        # VM size
        if 'vmSize' in props:
            return props['vmSize']

        # AKS node VM size
        if 'nodeVmSize' in props:
            return props['nodeVmSize']

        return None

    def _get_price(
        self,
        service_name: str,
        sku: str,
        location: str,
        resource
    ) -> Optional[PriceInfo]:
        """Get price from API with caching."""
        cache_key = f"{service_name}|{sku}|{location}"

        if cache_key in self._price_cache:
            return self._price_cache[cache_key]

        # Handle VM pricing with OS type
        if service_name == "Virtual Machines":
            os_type = getattr(resource, 'properties', {}).get('osType', 'Linux')
            prices = self.pricing_client.get_vm_prices(sku, location)

            # Filter by OS
            is_windows = os_type.lower() == "windows"
            matching = [p for p in prices if ("Windows" in p.product_name) == is_windows]

            if matching:
                self._price_cache[cache_key] = matching[0]
                return matching[0]
        else:
            # Standard pricing lookup
            price = self.pricing_client.get_price(service_name, sku, location)
            if price:
                self._price_cache[cache_key] = price
                return price

        return None

    def _try_alternative_sku(self, resource, location: str) -> Optional[PriceInfo]:
        """Try alternative SKU mappings for resources."""
        resource_type = resource.resource_type

        # App Service Plans
        if "serverfarms" in resource_type:
            sku = resource.sku or resource.tier
            if sku:
                # Map tier names to SKU names
                tier_map = {
                    "Free": "F1",
                    "Shared": "D1",
                    "Basic": "B1",
                    "Standard": "S1",
                    "Premium": "P1V2",
                    "PremiumV2": "P1V2",
                    "PremiumV3": "P1V3",
                }
                mapped_sku = tier_map.get(sku, sku)
                return self.pricing_client.get_price("Azure App Service", mapped_sku, location)

        # Storage Accounts
        if "storageAccounts" in resource_type:
            # Try looking up general block blob storage
            return self.pricing_client.get_price("Storage", "Hot GRS Data Stored", location)

        return None

    def _handle_no_sku_resource(self, resource, location: str) -> Optional[ResourceCost]:
        """Handle resources without SKUs (often free or consumption-based)."""
        resource_type = resource.resource_type
        props = getattr(resource, 'properties', {})

        # Container Apps - consumption-based pricing
        if "containerApps" in resource_type:
            return self._calculate_container_app_cost(resource, location, props)

        # Container Apps Managed Environment - base infrastructure cost
        if "managedEnvironments" in resource_type:
            plan_type = props.get('planType', 'Consumption')
            if plan_type == "Dedicated":
                # Dedicated plan has workload profile costs
                profile_type = props.get('profileType', 'D4')
                return self._calculate_container_apps_dedicated_env_cost(resource, location, props)
            else:
                # Consumption plan - no base cost
                return ResourceCost(
                    resource_name=resource.name,
                    resource_type=resource_type,
                    sku="Consumption",
                    location=location,
                    hourly_cost=0,
                    monthly_cost=0,
                    yearly_cost=0,
                    notes=["Container Apps Environment - included in app consumption costs"]
                )

        # Static Web Apps
        if "staticSites" in resource_type:
            return self._calculate_static_web_app_cost(resource, location, props)

        # Function Apps (Microsoft.Web/sites with kind=functionapp)
        if "sites" in resource_type and props.get('isFunction'):
            return self._calculate_function_app_cost(resource, location, props)

        # Container Apps Jobs
        if "jobs" in resource_type and "App" in resource_type:
            return self._calculate_container_app_job_cost(resource, location, props)

        # Container Registry
        if "registries" in resource_type:
            return self._calculate_container_registry_cost(resource, location, props)

        # Application Insights
        if "components" in resource_type and "Insights" in resource_type:
            return self._calculate_application_insights_cost(resource, location, props)

        # Storage Accounts
        if "storageAccounts" in resource_type:
            return self._calculate_storage_account_cost(resource, location)

        # App Service Plans
        if "serverfarms" in resource_type:
            return self._calculate_app_service_plan_cost(resource, location)

        # Log Analytics workspaces - per-GB ingestion pricing
        if "workspaces" in resource_type and "OperationalInsights" in resource_type:
            return self._calculate_log_analytics_cost(resource, location, props)

        # Virtual Networks - typically free
        if "virtualNetworks" in resource_type:
            return ResourceCost(
                resource_name=resource.name,
                resource_type=resource_type,
                sku=None,
                location=location,
                hourly_cost=0,
                monthly_cost=0,
                yearly_cost=0,
                notes=["Virtual Network - no direct cost (egress charges may apply)"]
            )

        # Network Interfaces - free
        if "networkInterfaces" in resource_type:
            return ResourceCost(
                resource_name=resource.name,
                resource_type=resource_type,
                sku=None,
                location=location,
                hourly_cost=0,
                monthly_cost=0,
                yearly_cost=0,
                notes=["Network Interface - no direct cost"]
            )

        # Network Security Groups - free
        if "networkSecurityGroups" in resource_type:
            return ResourceCost(
                resource_name=resource.name,
                resource_type=resource_type,
                sku=None,
                location=location,
                hourly_cost=0,
                monthly_cost=0,
                yearly_cost=0,
                notes=["NSG - no direct cost"]
            )

        return None

    def _calculate_container_app_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Container Apps cost using consumption pricing model.

        Pricing model:
        - vCPU-seconds: charged per vCPU per second
        - GiB-seconds: charged per GiB memory per second
        - Free grants per month: 180,000 vCPU-seconds, 360,000 GiB-seconds

        For always-on apps (minReplicas > 0):
        - Monthly seconds = 730 hours * 3600 = 2,628,000 seconds
        """
        # Parse CPU and memory from properties
        cpu_str = props.get('cpu', '0.5')
        memory_str = props.get('memory', '1Gi')
        min_replicas = props.get('minReplicas', 1)

        # Handle parameter references - use defaults
        if isinstance(cpu_str, str) and cpu_str.startswith('${'):
            cpu_str = '0.5'
        if isinstance(memory_str, str) and memory_str.startswith('${'):
            memory_str = '1Gi'
        if isinstance(min_replicas, str):
            if min_replicas.startswith('${'):
                min_replicas = 1
            else:
                try:
                    min_replicas = int(min_replicas)
                except ValueError:
                    min_replicas = 1

        # Parse CPU cores
        try:
            cpu_cores = float(cpu_str)
        except (ValueError, TypeError):
            cpu_cores = 0.5

        # Parse memory (convert Gi to GB)
        try:
            if isinstance(memory_str, str):
                if memory_str.endswith('Gi'):
                    memory_gb = float(memory_str.replace('Gi', ''))
                elif memory_str.endswith('Mi'):
                    memory_gb = float(memory_str.replace('Mi', '')) / 1024
                else:
                    memory_gb = float(memory_str)
            else:
                memory_gb = float(memory_str)
        except (ValueError, TypeError):
            memory_gb = 1.0

        # Azure Container Apps consumption pricing (East US, Jan 2024)
        # Source: https://azure.microsoft.com/pricing/details/container-apps/
        # Pricing is per vCPU-second and per GiB-second
        #
        # Active usage rates:
        # - vCPU: $0.000024 per vCPU-second (~$0.0864 per vCPU-hour)
        # - Memory: $0.000003 per GiB-second (~$0.0108 per GiB-hour)
        #
        # Note: Azure Pricing API returns hourly rates, so we convert
        vcpu_per_second = 0.000024
        memory_per_gb_second = 0.000003

        # Try to get actual prices from API (convert from hourly to per-second)
        try:
            # Query for Container Apps vCPU pricing
            filter_str = f"serviceName eq 'Azure Container Apps' and armRegionName eq '{location}' and contains(meterName, 'vCPU') and contains(skuName, 'Consumption')"
            items = self.pricing_client._query(filter_str, max_results=10)
            if items:
                for item in items:
                    meter_name = item.get('meterName', '')
                    unit = item.get('unitOfMeasure', '')
                    # Look for active (non-idle) vCPU pricing
                    if 'vCPU' in meter_name and 'Idle' not in meter_name and 'Spot' not in item.get('skuName', ''):
                        price = item.get('retailPrice', 0)
                        # Convert based on unit
                        if '1 Hour' in unit:
                            vcpu_per_second = price / 3600  # Convert hourly to per-second
                        elif '1 Second' in unit or 'Second' in unit:
                            vcpu_per_second = price
                        break

            # Query for Container Apps memory pricing
            filter_str = f"serviceName eq 'Azure Container Apps' and armRegionName eq '{location}' and contains(meterName, 'Memory') and contains(skuName, 'Consumption')"
            items = self.pricing_client._query(filter_str, max_results=10)
            if items:
                for item in items:
                    meter_name = item.get('meterName', '')
                    unit = item.get('unitOfMeasure', '')
                    # Look for active (non-idle) memory pricing
                    if 'Memory' in meter_name and 'Idle' not in meter_name and 'Spot' not in item.get('skuName', ''):
                        price = item.get('retailPrice', 0)
                        # Convert based on unit
                        if '1 Hour' in unit:
                            memory_per_gb_second = price / 3600
                        elif '1 Second' in unit or 'Second' in unit:
                            memory_per_gb_second = price
                        break
        except Exception:
            pass  # Use default prices if API fails

        # Calculate monthly seconds (assuming always running with min replicas)
        seconds_per_month = HOURS_PER_MONTH * 3600  # 730 * 3600 = 2,628,000

        # Calculate raw costs
        vcpu_cost = cpu_cores * vcpu_per_second * seconds_per_month * min_replicas
        memory_cost = memory_gb * memory_per_gb_second * seconds_per_month * min_replicas

        # Free grants (per subscription, but we'll note it)
        # 180,000 vCPU-seconds = ~$4.32 free
        # 360,000 GiB-seconds = ~$1.08 free
        free_vcpu_seconds = 180000
        free_memory_seconds = 360000

        # Calculate effective costs (assuming single app gets full free grant)
        effective_vcpu_seconds = max(0, (cpu_cores * seconds_per_month * min_replicas) - free_vcpu_seconds)
        effective_memory_seconds = max(0, (memory_gb * seconds_per_month * min_replicas) - free_memory_seconds)

        monthly_cost = (effective_vcpu_seconds * vcpu_per_second) + (effective_memory_seconds * memory_per_gb_second)
        yearly_cost = monthly_cost * 12

        # Create SKU description
        sku = f"{cpu_cores} vCPU, {memory_gb}Gi"

        notes = [
            f"Consumption plan",
            f"{min_replicas} min replica(s)",
            "Free grant: 180K vCPU-sec, 360K GiB-sec/month"
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_log_analytics_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Log Analytics workspace cost.

        Pricing model:
        - Per-GB data ingestion (first 5GB/day free with Pay-As-You-Go)
        - Retention: First 31 days free, then per-GB/month
        """
        sku_name = props.get('sku', 'PerGB2018')
        retention_days = props.get('retentionInDays', 30)

        # Handle parameter references
        if isinstance(retention_days, str):
            if retention_days.startswith('${'):
                retention_days = 30
            else:
                try:
                    retention_days = int(retention_days)
                except ValueError:
                    retention_days = 30

        # Default ingestion rate assumption (5 GB/day is typical for small workloads)
        # For Container Apps, actual ingestion is usually 1-10 GB/month
        estimated_gb_per_month = 5  # Conservative estimate

        # Try to get actual pricing from API
        ingestion_price_per_gb = 2.76  # Default East US price per GB
        retention_price_per_gb = 0.12  # Default price per GB/month for retention > 31 days

        try:
            # Query for Log Analytics pricing
            filter_str = f"serviceName eq 'Log Analytics' and armRegionName eq '{location}' and contains(meterName, 'Data Ingestion')"
            items = self.pricing_client._query(filter_str, max_results=5)
            if items:
                for item in items:
                    if 'Pay-as-you-go' in item.get('skuName', '') or 'Data Ingestion' in item.get('meterName', ''):
                        ingestion_price_per_gb = item.get('retailPrice', ingestion_price_per_gb)
                        break
        except Exception:
            pass

        # Calculate monthly cost
        # Note: First 5 GB/day free with Pay-As-You-Go, but we estimate conservatively
        monthly_ingestion_cost = estimated_gb_per_month * ingestion_price_per_gb

        # Retention cost (first 31 days free)
        extra_retention_days = max(0, retention_days - 31)
        monthly_retention_cost = 0
        if extra_retention_days > 0:
            # Estimate retained data (assuming 30 days of ingestion)
            retained_gb = estimated_gb_per_month * 30
            monthly_retention_cost = retained_gb * retention_price_per_gb * (extra_retention_days / 30)

        monthly_cost = monthly_ingestion_cost + monthly_retention_cost
        yearly_cost = monthly_cost * 12

        notes = [
            f"Est. {estimated_gb_per_month} GB/month ingestion",
            f"{retention_days} days retention"
        ]
        if retention_days <= 31:
            notes.append("Retention: free (<=31 days)")

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku_name,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_static_web_app_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Azure Static Web Apps cost.

        Pricing:
        - Free tier: $0/month (250MB storage, 2 custom domains, 3 staging envs)
        - Standard tier: ~$9/month per app (500MB storage, 5 custom domains, 10 staging envs)
        """
        sku = props.get('sku', 'Free')
        tier = props.get('tier', sku)

        # Normalize SKU name
        if isinstance(sku, str):
            sku_lower = sku.lower()
        else:
            sku_lower = 'free'

        if 'standard' in sku_lower or tier and 'standard' in str(tier).lower():
            sku_display = "Standard"
            notes = ["500MB storage", "5 custom domains", "10 staging envs", "SLA included"]
            default_monthly = 9.00

            # Try API first
            monthly_cost = None
            try:
                price_info = self.pricing_client.get_static_web_app_price("Standard", location)
                if price_info and price_info.retail_price > 0:
                    # API may return hourly or monthly
                    if "Hour" in price_info.unit_of_measure:
                        monthly_cost = price_info.retail_price * HOURS_PER_MONTH
                    else:
                        monthly_cost = price_info.retail_price
                    notes.append("(API pricing)")
            except Exception:
                pass

            if monthly_cost is None:
                monthly_cost = default_monthly
                notes.append("(Default pricing)")
        else:
            # Free tier
            monthly_cost = 0.0
            sku_display = "Free"
            notes = ["250MB storage", "2 custom domains", "3 staging envs", "No SLA"]

        yearly_cost = monthly_cost * 12

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku_display,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_container_apps_dedicated_env_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Container Apps Dedicated plan environment cost.

        Dedicated plan pricing:
        - Fixed management fee per workload profile
        - Per-instance charges based on profile type (D4, D8, D16, etc.)

        Common workload profiles:
        - D4: 4 vCPU, 16 GiB - ~$0.12/hour per instance
        - D8: 8 vCPU, 32 GiB - ~$0.24/hour per instance
        - D16: 16 vCPU, 64 GiB - ~$0.48/hour per instance
        """
        profile_type = props.get('profileType', 'D4')

        # Workload profile pricing (approximate, varies by region)
        profile_pricing = {
            'D4': {'vcpu': 4, 'memory': 16, 'hourly': 0.12},
            'D8': {'vcpu': 8, 'memory': 32, 'hourly': 0.24},
            'D16': {'vcpu': 16, 'memory': 64, 'hourly': 0.48},
            'D32': {'vcpu': 32, 'memory': 128, 'hourly': 0.96},
            'E4': {'vcpu': 4, 'memory': 32, 'hourly': 0.15},  # Memory optimized
            'E8': {'vcpu': 8, 'memory': 64, 'hourly': 0.30},
            'E16': {'vcpu': 16, 'memory': 128, 'hourly': 0.60},
        }

        # Get profile info or default to D4
        profile_info = profile_pricing.get(profile_type, profile_pricing['D4'])

        # Assume 1 instance minimum
        hourly_cost = profile_info['hourly']
        monthly_cost = hourly_cost * HOURS_PER_MONTH
        yearly_cost = monthly_cost * 12

        sku_display = f"Dedicated ({profile_type})"
        notes = [
            f"{profile_info['vcpu']} vCPU, {profile_info['memory']} GiB per instance",
            "Fixed management fee included",
            "Per-instance pricing"
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku_display,
            location=location,
            hourly_cost=hourly_cost,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_function_app_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Azure Function App cost.

        Pricing models:
        - Consumption: Pay per execution + execution time (first 1M executions free)
        - Premium (EP1, EP2, EP3): Per-instance hourly rate
        - Dedicated: Uses App Service Plan pricing
        """
        kind = props.get('kind', 'functionapp')

        # Check if it's consumption or premium based on kind
        is_linux = 'linux' in kind.lower() if kind else False

        # Get pricing from API with fallback defaults
        execution_price = 0.20  # Default: $0.20 per million executions
        gb_second_price = 0.000016  # Default: $0.000016 per GB-second
        pricing_source = "(Default pricing)"

        try:
            prices = self.pricing_client.get_function_app_prices(location)
            if prices:
                if prices.get('execution_price', 0) > 0:
                    execution_price = prices['execution_price']
                if prices.get('gb_second_price', 0) > 0:
                    gb_second_price = prices['gb_second_price']
                pricing_source = "(API pricing)"
        except Exception:
            pass

        # Estimate based on typical light usage (100K executions/month, 1s avg duration, 256MB)
        estimated_executions = 100000
        avg_duration_sec = 1
        memory_gb = 0.25  # 256MB

        # Free tier covers most light workloads
        # First 1M executions free
        billable_executions = max(0, estimated_executions - 1000000)
        execution_cost = (billable_executions / 1000000) * execution_price

        # First 400,000 GB-s free
        gb_seconds = estimated_executions * avg_duration_sec * memory_gb
        if gb_seconds > 400000:
            time_cost = (gb_seconds - 400000) * gb_second_price
        else:
            time_cost = 0

        monthly_cost = execution_cost + time_cost
        yearly_cost = monthly_cost * 12

        notes = [
            "Consumption plan",
            f"Est. {estimated_executions:,} executions/month",
            "First 1M executions free",
            "First 400K GB-s free",
            pricing_source
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku="Consumption",
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_container_app_job_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Container Apps Job cost.

        Jobs use same consumption pricing as Container Apps but only when running.
        Pricing: vCPU-seconds + GiB-seconds during execution
        """
        # Parse CPU and memory
        cpu_str = props.get('cpu', '0.25')
        memory_str = props.get('memory', '0.5Gi')
        trigger_type = props.get('triggerType', 'Manual')

        # Handle parameter references
        if isinstance(cpu_str, str) and cpu_str.startswith('${'):
            cpu_str = '0.25'
        if isinstance(memory_str, str) and memory_str.startswith('${'):
            memory_str = '0.5Gi'

        try:
            cpu_cores = float(cpu_str)
        except (ValueError, TypeError):
            cpu_cores = 0.25

        try:
            if isinstance(memory_str, str):
                if memory_str.endswith('Gi'):
                    memory_gb = float(memory_str.replace('Gi', ''))
                elif memory_str.endswith('Mi'):
                    memory_gb = float(memory_str.replace('Mi', '')) / 1024
                else:
                    memory_gb = float(memory_str)
            else:
                memory_gb = float(memory_str)
        except (ValueError, TypeError):
            memory_gb = 0.5

        # Estimate job execution time based on trigger type
        # Manual: assume 10 executions/month, 5 min each
        # Scheduled: estimate based on typical cron (daily = 30 runs, 5 min each)
        # Event: estimate 100 executions/month, 1 min each
        if trigger_type == 'Schedule':
            executions_per_month = 30
            seconds_per_execution = 300  # 5 minutes
        elif trigger_type == 'Event':
            executions_per_month = 100
            seconds_per_execution = 60  # 1 minute
        else:  # Manual
            executions_per_month = 10
            seconds_per_execution = 300

        total_seconds = executions_per_month * seconds_per_execution

        # Pricing rates
        vcpu_per_second = 0.000024
        memory_per_gb_second = 0.000003

        vcpu_cost = cpu_cores * vcpu_per_second * total_seconds
        memory_cost = memory_gb * memory_per_gb_second * total_seconds

        monthly_cost = vcpu_cost + memory_cost
        yearly_cost = monthly_cost * 12

        sku = f"{cpu_cores} vCPU, {memory_gb}Gi"
        notes = [
            f"{trigger_type} trigger",
            f"Est. {executions_per_month} runs/month",
            f"Est. {seconds_per_execution}s per run"
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_container_registry_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Azure Container Registry cost.

        Pricing tiers:
        - Basic: ~$5/month (10GB storage, 2 webhooks)
        - Standard: ~$20/month (100GB storage, 10 webhooks, geo-replication)
        - Premium: ~$50/month (500GB storage, 100 webhooks, content trust, private link)
        """
        sku = props.get('sku', 'Basic')

        # Normalize SKU
        if isinstance(sku, str):
            sku_lower = sku.lower()
        else:
            sku_lower = 'basic'

        if 'premium' in sku_lower:
            sku_display = "Premium"
            notes = ["500GB included storage", "Private endpoints", "Geo-replication"]
            default_daily = 1.667  # ~$50/month
        elif 'standard' in sku_lower:
            sku_display = "Standard"
            notes = ["100GB included storage", "Geo-replication available"]
            default_daily = 0.667  # ~$20/month
        else:
            sku_display = "Basic"
            notes = ["10GB included storage", "Development workloads"]
            default_daily = 0.167  # ~$5/month

        # Try API first
        try:
            price_info = self.pricing_client.get_container_registry_price(sku_display, location)
            if price_info and price_info.retail_price > 0:
                # API returns daily price
                if "Day" in price_info.unit_of_measure:
                    monthly_cost = price_info.retail_price * 30
                else:
                    monthly_cost = price_info.retail_price
                notes.append("(API pricing)")
            else:
                monthly_cost = default_daily * 30
                notes.append("(Default pricing)")
        except Exception:
            monthly_cost = default_daily * 30
            notes.append("(Default pricing)")

        yearly_cost = monthly_cost * 12

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku_display,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_storage_account_cost(self, resource, location: str) -> ResourceCost:
        """
        Calculate Azure Storage Account cost.

        Pricing varies by:
        - SKU (Standard_LRS, Standard_GRS, Premium_LRS, etc.)
        - Tier (Hot, Cool, Archive)
        - Capacity (per GB)

        Base estimate assumes 100GB storage for a typical app.
        """
        sku = resource.sku or "Standard_LRS"
        props = getattr(resource, 'properties', {})
        access_tier = props.get('accessTier', 'Hot')
        kind = props.get('kind', 'StorageV2')

        # Fallback pricing per GB/month (approximate, varies by region)
        sku_pricing = {
            'Standard_LRS': 0.018,   # ~$0.018/GB/month
            'Standard_GRS': 0.036,   # ~$0.036/GB/month
            'Standard_ZRS': 0.023,   # ~$0.023/GB/month
            'Standard_GZRS': 0.040,  # ~$0.040/GB/month
            'Premium_LRS': 0.15,     # ~$0.15/GB/month
        }

        # Estimate storage size (100GB for typical app)
        estimated_gb = 100

        # Try API first
        price_per_gb = None
        pricing_source = "(Default pricing)"
        try:
            price_info = self.pricing_client.get_storage_account_price(sku, location)
            if price_info and price_info.retail_price > 0:
                price_per_gb = price_info.retail_price
                pricing_source = "(API pricing)"
        except Exception:
            pass

        if price_per_gb is None:
            price_per_gb = sku_pricing.get(sku, 0.02)

        monthly_cost = estimated_gb * price_per_gb
        yearly_cost = monthly_cost * 12

        notes = [
            f"Est. {estimated_gb}GB storage",
            f"{access_tier} tier" if access_tier else "Hot tier",
            "Excludes transactions/egress",
            pricing_source
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_app_service_plan_cost(self, resource, location: str) -> ResourceCost:
        """
        Calculate App Service Plan cost.

        Pricing tiers:
        - Free (F1): $0
        - Shared (D1): ~$10/month
        - Basic (B1, B2, B3): ~$55-220/month
        - Standard (S1, S2, S3): ~$73-292/month
        - Premium (P1V2, P2V2, P3V2): ~$81-324/month
        - Premium V3 (P1V3, P2V3, P3V3): ~$138-552/month
        - Dynamic (Y1): Consumption plan for Functions - pay per execution
        """
        sku = resource.sku or "B1"
        tier = resource.tier or "Basic"

        # Fallback pricing per month (approximate East US prices)
        sku_pricing = {
            # Free and Shared
            'F1': (0, "Free", "Shared compute, 1GB, 60min/day"),
            'D1': (10, "Shared", "Shared compute, 1GB, 240min/day"),
            # Basic
            'B1': (55, "Basic", "1 core, 1.75GB RAM"),
            'B2': (109, "Basic", "2 cores, 3.5GB RAM"),
            'B3': (219, "Basic", "4 cores, 7GB RAM"),
            # Standard
            'S1': (73, "Standard", "1 core, 1.75GB RAM, auto-scale"),
            'S2': (146, "Standard", "2 cores, 3.5GB RAM, auto-scale"),
            'S3': (292, "Standard", "4 cores, 7GB RAM, auto-scale"),
            # Premium V2
            'P1V2': (81, "PremiumV2", "1 core, 3.5GB RAM"),
            'P2V2': (162, "PremiumV2", "2 cores, 7GB RAM"),
            'P3V2': (324, "PremiumV2", "4 cores, 14GB RAM"),
            # Premium V3
            'P1V3': (138, "PremiumV3", "2 cores, 8GB RAM"),
            'P2V3': (276, "PremiumV3", "4 cores, 16GB RAM"),
            'P3V3': (552, "PremiumV3", "8 cores, 32GB RAM"),
            # Consumption (Dynamic) for Functions
            'Y1': (0, "Consumption", "Pay per execution"),
            'Dynamic': (0, "Consumption", "Pay per execution"),
        }

        default_info = sku_pricing.get(sku, (55, "Basic", "Default B1 estimate"))
        default_monthly, tier_name, description = default_info

        # Try API first (except for free/consumption tiers)
        monthly_cost = None
        pricing_source = "(Default pricing)"
        if sku not in ('F1', 'Y1', 'Dynamic'):
            try:
                price_info = self.pricing_client.get_app_service_plan_price(sku, location)
                if price_info and price_info.retail_price > 0:
                    # API returns hourly price
                    if "Hour" in price_info.unit_of_measure:
                        monthly_cost = price_info.retail_price * HOURS_PER_MONTH
                    else:
                        monthly_cost = price_info.retail_price
                    pricing_source = "(API pricing)"
            except Exception:
                pass

        if monthly_cost is None:
            monthly_cost = default_monthly

        yearly_cost = monthly_cost * 12

        notes = [description, pricing_source]
        if sku in ('Y1', 'Dynamic'):
            notes.insert(1, "Function Apps billed separately per execution")

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku=sku,
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH if monthly_cost > 0 else 0,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _calculate_application_insights_cost(self, resource, location: str, props: dict) -> ResourceCost:
        """
        Calculate Application Insights cost.

        Pricing:
        - Data ingestion: ~$2.76/GB (first 5GB free per billing account)
        - Data retention: First 90 days free, then ~$0.12/GB/month

        Note: Workspace-based App Insights uses Log Analytics pricing.
        """
        # Estimate data ingestion based on typical web app
        # Small app: 1-5 GB/month
        # Medium app: 5-20 GB/month
        # Large app: 20-100 GB/month
        estimated_gb_per_month = 5  # Conservative estimate

        # Default pricing
        ingestion_price = 2.76  # per GB
        free_gb = 5  # First 5GB free
        pricing_source = "(Default pricing)"

        # Try API - App Insights uses Log Analytics pricing for workspace-based
        try:
            price_info = self.pricing_client.get_log_analytics_price(location)
            if price_info and price_info.retail_price > 0:
                ingestion_price = price_info.retail_price
                pricing_source = "(API pricing)"
        except Exception:
            pass

        billable_gb = max(0, estimated_gb_per_month - free_gb)
        monthly_cost = billable_gb * ingestion_price
        yearly_cost = monthly_cost * 12

        notes = [
            f"Est. {estimated_gb_per_month} GB/month",
            f"First {free_gb}GB free",
            "90 days retention free",
            pricing_source
        ]

        return ResourceCost(
            resource_name=resource.name,
            resource_type=resource.resource_type,
            sku="Pay-as-you-go",
            location=location,
            hourly_cost=monthly_cost / HOURS_PER_MONTH,
            monthly_cost=monthly_cost,
            yearly_cost=yearly_cost,
            count=1,
            notes=notes
        )

    def _generate_recommendations(
        self,
        costs: list[ResourceCost],
        total_monthly: float
    ) -> list[str]:
        """Generate cost optimization recommendations."""
        recommendations = []

        # Check for VMs that could use reserved instances
        vm_costs = [c for c in costs if "virtualMachines" in c.resource_type]
        for vm in vm_costs:
            if vm.reserved_3yr_monthly and vm.monthly_cost > 100:
                # Account for instance count in savings calculation
                current_total_monthly = vm.total_monthly  # Uses count
                reserved_total_monthly = vm.reserved_3yr_monthly * vm.count
                savings = (current_total_monthly - reserved_total_monthly) * 12
                if savings > 500:
                    reduction_pct = ((current_total_monthly - reserved_total_monthly) / current_total_monthly * 100) if current_total_monthly > 0 else 0
                    recommendations.append(
                        f"Consider 3-year reserved instance for {vm.resource_name}: "
                        f"Save ~${savings:.0f}/year ({reduction_pct:.0f}% reduction)"
                    )

        # Check for expensive SQL databases
        sql_costs = [c for c in costs if "databases" in c.resource_type or "SQL" in c.resource_type]
        for sql in sql_costs:
            if sql.monthly_cost > 500:
                recommendations.append(
                    f"Review {sql.resource_name} sizing - consider serverless or elastic pools for variable workloads"
                )

        # Check for Premium storage when Standard might suffice
        storage_costs = [c for c in costs if "storageAccounts" in c.resource_type]
        for storage in storage_costs:
            if storage.sku and "Premium" in storage.sku:
                recommendations.append(
                    f"Evaluate if {storage.resource_name} requires Premium storage - Standard may be sufficient"
                )

        # General recommendations based on total
        if total_monthly > 1000:
            recommendations.append(
                "Consider Azure Hybrid Benefit if you have existing Windows Server or SQL Server licenses"
            )

        if total_monthly > 5000:
            recommendations.append(
                "Review resource utilization with Azure Advisor for right-sizing recommendations"
            )

        return recommendations


def generate_markdown_report(report: CostReport) -> str:
    """Generate a markdown cost report."""
    lines = [
        "# Azure Cost Estimation Report",
        "",
        f"**Template:** `{report.template_path}`",
        f"**Region:** {report.region}",
        f"**Generated:** {report.generated_at}",
        "",
        "---",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| **Total Monthly Cost** | ${report.total_monthly_cost:,.2f} |",
        f"| **Total Yearly Cost** | ${report.total_yearly_cost:,.2f} |",
        f"| **Resources Analyzed** | {report.resource_count} |",
        "",
        "---",
        "",
        "## Resource Breakdown",
        "",
        "| Resource | Type | SKU | Monthly Cost | Notes |",
        "|----------|------|-----|-------------|-------|",
    ]

    for rc in sorted(report.resource_costs, key=lambda x: -x.total_monthly):
        notes = ", ".join(rc.notes) if rc.notes else ""
        count_note = f" (x{rc.count})" if rc.count > 1 else ""
        lines.append(
            f"| {rc.resource_name}{count_note} | {rc.resource_type.split('/')[-1]} | "
            f"{rc.sku or '-'} | ${rc.total_monthly:,.2f} | {notes} |"
        )

    lines.extend([
        "",
        "---",
        "",
    ])

    # Recommendations
    if report.recommendations:
        lines.extend([
            "## Cost Optimization Opportunities",
            "",
        ])
        for rec in report.recommendations:
            lines.append(f"- {rec}")
        lines.extend(["", "---", ""])

    # Warnings
    if report.warnings:
        lines.extend([
            "## Warnings",
            "",
        ])
        for warn in report.warnings:
            lines.append(f"- {warn}")
        lines.extend(["", "---", ""])

    # Unsupported resources
    if report.unsupported_resources:
        lines.extend([
            "## Unsupported Resources (not included in estimate)",
            "",
        ])
        for res in report.unsupported_resources:
            lines.append(f"- {res}")
        lines.extend(["", "---", ""])

    # Assumptions
    lines.extend([
        "## Assumptions",
        "",
        "- Pricing based on Pay-As-You-Go rates",
        "- 730 hours per month for compute resources",
        "- Storage costs exclude egress and transaction costs",
        "- Costs are estimates and may vary based on actual usage",
        "",
        "---",
        "",
        "*Generated by Azure Cost Estimation Skill*",
    ])

    return "\n".join(lines)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Estimate Azure deployment costs from templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cost_calculator.py main.bicep
  python cost_calculator.py main.bicep --region westus2
  python cost_calculator.py main.bicep --params main.bicepparam
  python cost_calculator.py main.bicep --output cost-report.md
  python cost_calculator.py main.bicep --compare-regions eastus,westus2,northeurope
  python cost_calculator.py main.bicep --json
        """
    )

    parser.add_argument("template", help="Path to Bicep or ARM template")
    parser.add_argument("--params", help="Path to parameter file")
    parser.add_argument("--region", default="eastus", help="Azure region (default: eastus)")
    parser.add_argument("--currency", default="USD", help="Currency code (default: USD)")
    parser.add_argument("--output", "-o", help="Output file path (markdown)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--compare-regions", help="Compare costs across regions (comma-separated)")

    args = parser.parse_args()

    try:
        if args.compare_regions:
            # Region comparison mode
            regions = [r.strip() for r in args.compare_regions.split(",")]
            print(f"\nComparing costs across regions: {', '.join(regions)}\n")
            print(f"{'Region':<20} {'Monthly Cost':<15} {'Yearly Cost':<15}")
            print("=" * 50)

            reports = []
            for region in regions:
                calculator = CostCalculator(region=region, currency=args.currency)
                report = calculator.estimate_template_cost(args.template, args.params)
                reports.append((region, report))
                print(f"{region:<20} ${report.total_monthly_cost:<14,.2f} ${report.total_yearly_cost:<14,.2f}")

            # Find cheapest
            cheapest = min(reports, key=lambda x: x[1].total_monthly_cost)
            print(f"\n{'='*50}")
            print(f"Cheapest region: {cheapest[0]} (${cheapest[1].total_monthly_cost:,.2f}/month)")

        else:
            # Single region mode
            calculator = CostCalculator(region=args.region, currency=args.currency)
            report = calculator.estimate_template_cost(args.template, args.params)

            if args.json:
                # JSON output
                output = {
                    "template": report.template_path,
                    "region": report.region,
                    "generated_at": report.generated_at,
                    "total_monthly_cost": report.total_monthly_cost,
                    "total_yearly_cost": report.total_yearly_cost,
                    "resource_count": report.resource_count,
                    "resources": [asdict(rc) for rc in report.resource_costs],
                    "recommendations": report.recommendations,
                    "warnings": report.warnings,
                    "unsupported_resources": report.unsupported_resources,
                }
                print(json.dumps(output, indent=2))

            else:
                # Markdown output
                markdown = generate_markdown_report(report)

                if args.output:
                    Path(args.output).write_text(markdown, encoding="utf-8")
                    print(f"Report saved to: {args.output}")
                else:
                    print(markdown)

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
