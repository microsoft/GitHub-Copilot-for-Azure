"""Adapted trace-link construction regressions; no verified portal rendering."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest


SCRIPT = (
    Path(__file__).resolve().parents[3]
    / "plugins"
    / "observability-super-skill"
    / "skills"
    / "assess-observability-health"
    / "scripts"
    / "build_appinsights_trace_link.py"
)
spec = importlib.util.spec_from_file_location("build_appinsights_trace_link", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class ApplicationInsightsTraceLinkTests(unittest.TestCase):
    def test_rejects_dependency_span_id_as_event_id(self):
        with self.assertRaisesRegex(
            builder.argparse.ArgumentTypeError,
            "telemetry itemId UUID",
        ):
            builder.event_item_id("496b1462e33f087b")

    def test_accepts_availability_item_id(self):
        item_id = "a6bcdfd6-c437-11f1-b306-7c1e525c18a2"
        self.assertEqual(builder.event_item_id(item_id), item_id)

    def test_public_portal_link_encoding_is_preserved(self):
        resource_id = (
            "/subscriptions/788b6a08-f905-4935-bd92-f9005785c0b9/"
            "resourceGroups/AgentTestApp/providers/microsoft.insights/"
            "components/AgentTestApp"
        )
        expected = (
            "https://portal.azure.com/?feature.agentsBladeUseIframe=true"
            "&feature.agentsEvaluationsTab=true#view/AppInsightsExtension/"
            "DetailsV2Blade/ComponentId~/%7B%22SubscriptionId%22%3A%22788b6a08"
            "-f905-4935-bd92-f9005785c0b9%22%2C%22ResourceGroup%22%3A%22Agent"
            "TestApp%22%2C%22Name%22%3A%22AgentTestApp%22%2C%22LinkedApplication"
            "Type%22%3A0%2C%22ResourceId%22%3A%22%252Fsubscriptions%252F788b6a08"
            "-f905-4935-bd92-f9005785c0b9%252FresourceGroups%252FAgentTestApp%252F"
            "providers%252Fmicrosoft.insights%252Fcomponents%252FAgentTestApp%22%2C"
            "%22ResourceType%22%3A%22microsoft.insights%252Fcomponents%22%2C%22"
            "IsAzureFirst%22%3Afalse%7D/DataModel~/%7B%22eventId%22%3A%22a6bcdfd6"
            "-c437-11f1-b306-7c1e525c18a2%22%2C%22operationId%22%3A%22bfd266f5"
            "d11e4b410d1b85e8e5fe3d6e%22%2C%22timestamp%22%3A%222026-10-09T23%3A"
            "15%3A38.888Z%22%2C%22cacheId%22%3A%22793774a0-e17d-458c-b1c1-"
            "1801312ec387%22%2C%22eventTable%22%3A%22availabilityResults%22%2C"
            "%22timeContext%22%3A%7B%22durationMs%22%3A259200000%2C%22endTime"
            "%22%3A%222026-10-12T17%3A29%3A34.488Z%22%7D%7D"
        )
        args = SimpleNamespace(
            subscription_id="788b6a08-f905-4935-bd92-f9005785c0b9",
            resource_group="AgentTestApp",
            component_name="AgentTestApp",
            resource_id=resource_id,
            event_id="a6bcdfd6-c437-11f1-b306-7c1e525c18a2",
            operation_id="bfd266f5d11e4b410d1b85e8e5fe3d6e",
            timestamp="2026-10-09T23:15:38.888Z",
            cache_id="793774a0-e17d-458c-b1c1-1801312ec387",
            event_table="availabilityResults",
            duration_ms=259200000,
            end_time="2026-10-12T17:29:34.488Z",
            portal_host="https://portal.azure.com/",
        )

        url, cache_id = builder.build_url(args)

        self.assertEqual(url, expected)
        self.assertEqual(cache_id, args.cache_id)

    def test_cli_defaults_to_public_portal_and_allows_explicit_host(self):
        argv = ["build-link", "--subscription-id", "synthetic", "--resource-group", "example",
                "--component-name", "example", "--resource-id", "/synthetic",
                "--event-id", "a6bcdfd6-c437-11f1-b306-7c1e525c18a2",
                "--operation-id", "synthetic", "--timestamp", "2026-10-09T23:15:38Z",
                "--event-table", "requests", "--end-time", "2026-10-10T00:00:00Z"]
        from unittest.mock import patch
        with patch("sys.argv", argv):
            self.assertEqual(builder.parse_args().portal_host, "https://portal.azure.com/")
        with patch("sys.argv", argv + ["--portal-host", "https://example.invalid/"]):
            self.assertEqual(builder.parse_args().portal_host, "https://example.invalid/")


if __name__ == "__main__":
    unittest.main()