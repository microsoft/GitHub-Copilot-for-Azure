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
from bicep_parser import AzureResource as BicepResource
from arm_parser import parse_arm_template, parse_parameters_file, resolve_resources as resolve_arm_resources
from arm_parser import AzureResource as ArmResource


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
                    params.update(json.loads(param_content).get("parameters", {}))

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

        # Container Apps resources
        if 'cpu' in props and 'memory' in props:
            return f"{props['cpu']}vCPU-{props['memory']}"

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
                savings = (vm.monthly_cost - vm.reserved_3yr_monthly) * 12
                if savings > 500:
                    recommendations.append(
                        f"Consider 3-year reserved instance for {vm.resource_name}: "
                        f"Save ~${savings:.0f}/year ({((vm.monthly_cost - vm.reserved_3yr_monthly) / vm.monthly_cost * 100):.0f}% reduction)"
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
