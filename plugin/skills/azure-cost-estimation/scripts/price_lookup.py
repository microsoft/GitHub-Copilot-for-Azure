#!/usr/bin/env python3
"""
Azure Retail Prices API Client

Queries the Azure Retail Prices API to get pricing information for Azure resources.
No authentication required - this is a public API.

API Documentation:
https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices

Usage:
    python price_lookup.py --service "Virtual Machines" --sku "Standard_D4s_v3" --region eastus
    python price_lookup.py --vm-size "Standard_D4s_v3" --region eastus
    python price_lookup.py --compare-regions "Standard_D4s_v3" eastus,westus2,northeurope
"""

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)


# Constants
BASE_URL = "https://prices.azure.com/api/retail/prices"
HOURS_PER_MONTH = 730  # Standard billing hours per month
HOURS_PER_YEAR = 8760


@dataclass
class PriceInfo:
    """Represents pricing information for an Azure resource."""
    retail_price: float
    unit_of_measure: str
    sku_name: str
    service_name: str
    product_name: str
    region: str
    meter_name: str
    currency: str = "USD"
    reservation_term: Optional[str] = None
    price_type: str = "Consumption"  # Consumption, Reservation, DevTestConsumption

    @property
    def monthly_cost(self) -> float:
        """Calculate monthly cost for hourly-priced resources."""
        if "Hour" in self.unit_of_measure:
            return self.retail_price * HOURS_PER_MONTH
        elif "Month" in self.unit_of_measure:
            return self.retail_price
        elif "GB" in self.unit_of_measure:
            return self.retail_price  # Per GB, needs capacity multiplier
        return self.retail_price

    @property
    def yearly_cost(self) -> float:
        """Calculate yearly cost."""
        return self.monthly_cost * 12


@dataclass
class SavingsInfo:
    """Reserved instance savings comparison."""
    payg_monthly: float
    payg_yearly: float
    reserved_1yr_monthly: Optional[float] = None
    reserved_1yr_yearly: Optional[float] = None
    reserved_3yr_monthly: Optional[float] = None
    reserved_3yr_yearly: Optional[float] = None
    savings_1yr_percent: Optional[float] = None
    savings_3yr_percent: Optional[float] = None


class AzurePricingClient:
    """Client for the Azure Retail Prices API."""

    def __init__(self, currency: str = "USD"):
        self.currency = currency
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json"
        })

    def _build_filter(self, **kwargs) -> str:
        """Build OData filter string from keyword arguments."""
        filters = []

        # Map common parameter names to API field names
        field_map = {
            "service_name": "serviceName",
            "sku_name": "armSkuName",
            "region": "armRegionName",
            "product_name": "productName",
            "meter_name": "meterName",
            "price_type": "priceType",
        }

        for key, value in kwargs.items():
            if value is None:
                continue
            api_field = field_map.get(key, key)

            # Handle contains vs equals
            if key.endswith("_contains"):
                actual_key = key.replace("_contains", "")
                api_field = field_map.get(actual_key, actual_key)
                filters.append(f"contains({api_field}, '{value}')")
            else:
                filters.append(f"{api_field} eq '{value}'")

        return " and ".join(filters)

    def _query(self, odata_filter: str, max_results: int = 100) -> list[dict]:
        """Execute a query against the pricing API."""
        all_items = []

        # Build URL with filter
        url = f"{BASE_URL}?currencyCode='{self.currency}'&$filter={quote(odata_filter)}"

        while url and len(all_items) < max_results:
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                data = response.json()

                items = data.get("Items", [])
                all_items.extend(items)

                # Handle pagination
                url = data.get("NextPageLink")

            except requests.RequestException as e:
                print(f"API request failed: {e}", file=sys.stderr)
                break

        return all_items[:max_results]

    def get_price(
        self,
        service_name: str,
        sku_name: str,
        region: str,
        price_type: str = "Consumption"
    ) -> Optional[PriceInfo]:
        """Get price for a specific SKU in a region."""
        filter_str = self._build_filter(
            service_name=service_name,
            sku_name=sku_name,
            region=region,
            price_type=price_type
        )

        items = self._query(filter_str, max_results=10)

        if not items:
            return None

        # Return the first matching item
        item = items[0]
        return PriceInfo(
            retail_price=item.get("retailPrice", 0),
            unit_of_measure=item.get("unitOfMeasure", ""),
            sku_name=item.get("armSkuName", ""),
            service_name=item.get("serviceName", ""),
            product_name=item.get("productName", ""),
            region=item.get("armRegionName", ""),
            meter_name=item.get("meterName", ""),
            currency=self.currency,
            reservation_term=item.get("reservationTerm"),
            price_type=item.get("type", "Consumption")
        )

    def get_vm_prices(
        self,
        vm_size: str,
        region: str,
        include_windows: bool = True,
        include_linux: bool = True
    ) -> list[PriceInfo]:
        """Get VM prices including OS variants."""
        filter_str = self._build_filter(
            service_name="Virtual Machines",
            sku_name=vm_size,
            region=region,
            price_type="Consumption"
        )

        items = self._query(filter_str, max_results=50)

        prices = []
        for item in items:
            product_name = item.get("productName", "")

            # Filter by OS type
            is_windows = "Windows" in product_name
            if is_windows and not include_windows:
                continue
            if not is_windows and not include_linux:
                continue

            # Skip spot and low priority
            if "Spot" in item.get("skuName", "") or "Low Priority" in item.get("skuName", ""):
                continue

            prices.append(PriceInfo(
                retail_price=item.get("retailPrice", 0),
                unit_of_measure=item.get("unitOfMeasure", ""),
                sku_name=item.get("armSkuName", ""),
                service_name=item.get("serviceName", ""),
                product_name=product_name,
                region=item.get("armRegionName", ""),
                meter_name=item.get("meterName", ""),
                currency=self.currency,
                price_type=item.get("type", "Consumption")
            ))

        return prices

    def get_storage_prices(
        self,
        sku: str,
        region: str
    ) -> list[PriceInfo]:
        """Get storage account pricing."""
        # Map common SKU names to API format
        sku_map = {
            "Standard_LRS": "Standard LRS",
            "Standard_GRS": "Standard GRS",
            "Standard_ZRS": "Standard ZRS",
            "Premium_LRS": "Premium LRS",
        }
        api_sku = sku_map.get(sku, sku)

        filter_str = f"serviceName eq 'Storage' and armRegionName eq '{region}' and contains(skuName, '{api_sku}')"

        items = self._query(filter_str, max_results=50)

        prices = []
        for item in items:
            prices.append(PriceInfo(
                retail_price=item.get("retailPrice", 0),
                unit_of_measure=item.get("unitOfMeasure", ""),
                sku_name=item.get("skuName", ""),
                service_name=item.get("serviceName", ""),
                product_name=item.get("productName", ""),
                region=item.get("armRegionName", ""),
                meter_name=item.get("meterName", ""),
                currency=self.currency
            ))

        return prices

    def compare_regions(
        self,
        service_name: str,
        sku_name: str,
        regions: list[str]
    ) -> dict[str, Optional[PriceInfo]]:
        """Compare prices across multiple regions."""
        results = {}

        for region in regions:
            price = self.get_price(service_name, sku_name, region)
            results[region] = price

        return results

    def get_reserved_savings(
        self,
        service_name: str,
        sku_name: str,
        region: str
    ) -> Optional[SavingsInfo]:
        """Calculate reserved instance savings compared to pay-as-you-go."""
        # Get PAYG price
        payg = self.get_price(service_name, sku_name, region, "Consumption")
        if not payg:
            return None

        # Get 1-year reserved
        filter_1yr = f"serviceName eq '{service_name}' and armSkuName eq '{sku_name}' and armRegionName eq '{region}' and reservationTerm eq '1 Year'"
        items_1yr = self._query(filter_1yr, max_results=5)

        # Get 3-year reserved
        filter_3yr = f"serviceName eq '{service_name}' and armSkuName eq '{sku_name}' and armRegionName eq '{region}' and reservationTerm eq '3 Years'"
        items_3yr = self._query(filter_3yr, max_results=5)

        savings = SavingsInfo(
            payg_monthly=payg.monthly_cost,
            payg_yearly=payg.yearly_cost
        )

        if items_1yr:
            # Reserved prices are often yearly totals
            item = items_1yr[0]
            yearly_price = item.get("retailPrice", 0)
            savings.reserved_1yr_yearly = yearly_price
            savings.reserved_1yr_monthly = yearly_price / 12
            savings.savings_1yr_percent = (1 - yearly_price / payg.yearly_cost) * 100 if payg.yearly_cost > 0 else 0

        if items_3yr:
            item = items_3yr[0]
            # 3-year is total for 3 years
            total_price = item.get("retailPrice", 0)
            savings.reserved_3yr_yearly = total_price / 3
            savings.reserved_3yr_monthly = total_price / 36
            savings.savings_3yr_percent = (1 - (total_price / 3) / payg.yearly_cost) * 100 if payg.yearly_cost > 0 else 0

        return savings

    def estimate_vm_cost(
        self,
        vm_size: str,
        region: str,
        os_type: str = "Linux"
    ) -> Optional[dict]:
        """Convenience method to estimate VM cost with breakdown."""
        prices = self.get_vm_prices(vm_size, region)

        # Find matching OS
        is_windows = os_type.lower() == "windows"
        matching = [p for p in prices if ("Windows" in p.product_name) == is_windows]

        if not matching:
            return None

        price = matching[0]
        savings = self.get_reserved_savings("Virtual Machines", vm_size, region)

        return {
            "vm_size": vm_size,
            "region": region,
            "os_type": os_type,
            "hourly_cost": price.retail_price,
            "monthly_cost": price.monthly_cost,
            "yearly_cost": price.yearly_cost,
            "unit": price.unit_of_measure,
            "product": price.product_name,
            "reserved_savings": asdict(savings) if savings else None
        }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Query Azure Retail Prices API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Get VM price
  python price_lookup.py --vm-size Standard_D4s_v3 --region eastus

  # Get specific service price
  python price_lookup.py --service "Virtual Machines" --sku "Standard_D4s_v3" --region eastus

  # Compare regions
  python price_lookup.py --compare-regions "Standard_D4s_v3" eastus,westus2,northeurope

  # Get reserved instance savings
  python price_lookup.py --vm-size Standard_D4s_v3 --region eastus --show-reserved
        """
    )

    parser.add_argument("--service", help="Azure service name (e.g., 'Virtual Machines')")
    parser.add_argument("--sku", help="SKU/size name (e.g., 'Standard_D4s_v3')")
    parser.add_argument("--region", help="Azure region (e.g., 'eastus')")
    parser.add_argument("--vm-size", help="VM size for quick VM price lookup")
    parser.add_argument("--os", default="Linux", help="OS type for VM (Linux or Windows)")
    parser.add_argument("--compare-regions", nargs=2, metavar=("SKU", "REGIONS"),
                       help="Compare SKU prices across regions (comma-separated)")
    parser.add_argument("--show-reserved", action="store_true",
                       help="Show reserved instance savings")
    parser.add_argument("--currency", default="USD", help="Currency code (default: USD)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    client = AzurePricingClient(currency=args.currency)

    # Handle VM size shortcut
    if args.vm_size:
        if not args.region:
            print("Error: --region required with --vm-size", file=sys.stderr)
            sys.exit(1)

        result = client.estimate_vm_cost(args.vm_size, args.region, args.os)

        if not result:
            print(f"No pricing found for {args.vm_size} in {args.region}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"\nVM Cost Estimate: {args.vm_size}")
            print(f"{'='*50}")
            print(f"Region:        {result['region']}")
            print(f"OS Type:       {result['os_type']}")
            print(f"Product:       {result['product']}")
            print(f"{'='*50}")
            print(f"Hourly Cost:   ${result['hourly_cost']:.4f}")
            print(f"Monthly Cost:  ${result['monthly_cost']:.2f}")
            print(f"Yearly Cost:   ${result['yearly_cost']:.2f}")

            if args.show_reserved and result.get('reserved_savings'):
                savings = result['reserved_savings']
                print(f"\n{'Reserved Instance Savings':^50}")
                print(f"{'='*50}")
                if savings.get('reserved_1yr_yearly'):
                    print(f"1-Year Reserved: ${savings['reserved_1yr_yearly']:.2f}/year ({savings['savings_1yr_percent']:.1f}% savings)")
                if savings.get('reserved_3yr_yearly'):
                    print(f"3-Year Reserved: ${savings['reserved_3yr_yearly']:.2f}/year ({savings['savings_3yr_percent']:.1f}% savings)")

        return

    # Handle region comparison
    if args.compare_regions:
        sku, regions_str = args.compare_regions
        regions = [r.strip() for r in regions_str.split(",")]

        results = client.compare_regions("Virtual Machines", sku, regions)

        if args.json:
            json_results = {r: asdict(p) if p else None for r, p in results.items()}
            print(json.dumps(json_results, indent=2))
        else:
            print(f"\nRegion Comparison: {sku}")
            print(f"{'='*60}")
            print(f"{'Region':<20} {'Hourly':<12} {'Monthly':<12} {'Yearly':<12}")
            print(f"{'-'*60}")

            for region, price in sorted(results.items(), key=lambda x: x[1].retail_price if x[1] else float('inf')):
                if price:
                    print(f"{region:<20} ${price.retail_price:<11.4f} ${price.monthly_cost:<11.2f} ${price.yearly_cost:<11.2f}")
                else:
                    print(f"{region:<20} {'N/A':<12} {'N/A':<12} {'N/A':<12}")

        return

    # Standard lookup
    if args.service and args.sku and args.region:
        price = client.get_price(args.service, args.sku, args.region)

        if not price:
            print(f"No pricing found for {args.sku} in {args.region}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(asdict(price), indent=2))
        else:
            print(f"\nPrice: {args.sku}")
            print(f"{'='*50}")
            print(f"Service:       {price.service_name}")
            print(f"Product:       {price.product_name}")
            print(f"Region:        {price.region}")
            print(f"Unit:          {price.unit_of_measure}")
            print(f"{'='*50}")
            print(f"Price:         ${price.retail_price:.4f} per {price.unit_of_measure}")
            print(f"Monthly Cost:  ${price.monthly_cost:.2f}")

        return

    # No valid arguments
    parser.print_help()


if __name__ == "__main__":
    main()
