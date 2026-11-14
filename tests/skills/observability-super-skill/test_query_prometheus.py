"""Reused supplied Prometheus regressions; nested path and no-redirect transport adapted."""

import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch


SCRIPT = (
    Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
    / "skills/troubleshoot-observability/references/azure-diagnostics/investigation/scripts/query_prometheus.py"
)
spec = importlib.util.spec_from_file_location("query_prometheus", SCRIPT)
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class Tests(unittest.TestCase):
    def test_endpoint_accepts_only_azure_monitor_prometheus(self):
        endpoint = "https://westus2.prometheus.monitor.azure.com/workspace"
        self.assertEqual(api.validate_endpoint(endpoint + "/"), endpoint)
        for invalid in (
            "http://westus2.prometheus.monitor.azure.com/workspace",
            "https://example.com/workspace",
            "https://user:password@westus2.prometheus.monitor.azure.com/workspace",
            "https://westus2.prometheus.monitor.azure.com/workspace?token=secret",
        ):
            with self.subTest(invalid=invalid), self.assertRaises(api.QueryError):
                api.validate_endpoint(invalid)

    def test_range_query_requires_complete_window(self):
        endpoint = "https://westus2.prometheus.monitor.azure.com/workspace"
        with self.assertRaises(api.QueryError):
            api.query_url(endpoint, "up", start="1", end="2")
        url, mode = api.query_url(
            endpoint, "up{namespace=\"manual-cache\"}", start="1", end="2", step="60s"
        )
        self.assertEqual(mode, "range")
        self.assertIn("/api/v1/query_range?", url)
        self.assertIn("step=60s", url)

    def test_metric_name_regex_is_rejected_before_request(self):
        endpoint = "https://westus2.prometheus.monitor.azure.com/workspace"
        for query in ('{__name__=~"redis_.*"}', '{__name__!~"go_.*"}'):
            with self.subTest(query=query), self.assertRaisesRegex(
                api.QueryError, "explicit metric names"
            ):
                api.query_url(endpoint, query)

    def test_workspace_discovery_reads_prometheus_endpoint(self):
        resource_id = (
            "/subscriptions/11111111-1111-1111-1111-111111111111"
            "/resourceGroups/test/providers/Microsoft.Monitor/accounts/amw"
        )
        response = {
            "properties": {
                "metrics": {
                    "prometheusQueryEndpoint": (
                        "https://westus2.prometheus.monitor.azure.com/workspace"
                    )
                }
            }
        }
        with patch.object(api, "run_az", return_value=response) as run:
            endpoint = api.discover_endpoint(resource_id)
        self.assertEqual(
            endpoint, "https://westus2.prometheus.monitor.azure.com/workspace"
        )
        self.assertNotIn("access-token", " ".join(run.call_args.args[0]))

    def test_query_returns_data_without_token(self):
        response = Mock()
        response.read.return_value = json.dumps(
            {"status": "success", "data": {"resultType": "vector", "result": []}}
        ).encode()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        endpoint = "https://westus2.prometheus.monitor.azure.com/workspace"
        with patch.object(api, "acquire_token", return_value="secret-token"), patch.object(
            api.urllib.request, "build_opener"
        ) as opener:
            opener.return_value.open.return_value = response
            result = api.execute_query(endpoint, "up")
        self.assertTrue(result["ok"])
        self.assertNotIn("secret-token", json.dumps(result))
        self.assertEqual(
            opener.return_value.open.call_args.args[0].headers["Authorization"], "Bearer secret-token"
        )


if __name__ == "__main__":
    unittest.main()
