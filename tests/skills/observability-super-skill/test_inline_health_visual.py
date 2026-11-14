"""Supplied renderer regressions; import path adapted 2026-11-11."""

import importlib.util
from pathlib import Path
import unittest


SCRIPT = (
    Path(__file__).resolve().parents[3]
    / "plugins"
    / "observability-super-skill"
    / "skills"
    / "assess-observability-health"
    / "scripts"
    / "render_inline_health_visual.py"
)
spec = importlib.util.spec_from_file_location("render_inline_health_visual", SCRIPT)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class InlineHealthVisualThemeTests(unittest.TestCase):
    def test_all_theme_values_emit_identical_dark_css(self):
        variants = {
            theme: renderer.theme_css(theme)
            for theme in ("auto", "light", "dark")
        }

        self.assertEqual(variants["auto"], variants["dark"])
        self.assertEqual(variants["light"], variants["dark"])
        self.assertIn("color-scheme: dark", variants["dark"])
        self.assertIn("--canvas: #172033", variants["dark"])
        self.assertIn("--panel: #25324A", variants["dark"])
        self.assertIn("--healthy: #55D98A", variants["dark"])
        self.assertIn("--degraded: #FF7B72", variants["dark"])
        self.assertNotIn("prefers-color-scheme", variants["dark"])
        self.assertNotIn("#F2F4F7", variants["dark"])

    def test_render_includes_comparison_annotation_and_infrastructure(self):
        data = {
            "title": "Customer support health",
            "window": {
                "start": "2026-10-10T00:00:00Z",
                "end": "2026-10-10T01:00:00Z",
            },
            "source_summary": "Application Insights and managed Prometheus",
            "kpis": [{
                "label": "Manual lookup",
                "value": "Healthy",
                "context": "30 of 30 passed",
                "state": "healthy",
            }],
            "charts": [{
                "title": "Lookup latency",
                "caption": "Production baseline vs candidate current",
                "maximum": 25,
                "series": [{
                    "name": "p95 seconds",
                    "points": [
                        {
                            "x": "Baseline",
                            "y": 20,
                            "display": "20 s",
                            "state": "degraded",
                        },
                        {
                            "x": "Current",
                            "y": 0.031,
                            "display": "31 ms",
                            "state": "healthy",
                        },
                    ],
                }],
                "annotations": [{
                    "label": "Gate: p95 < 5 s",
                    "y": 5,
                    "state": "healthy",
                }],
            }],
            "infrastructure_metrics": [{
                "label": "Redis throttling",
                "value": "1.7%",
                "context": "p95 candidate",
                "state": "healthy",
            }],
        }

        svg = renderer.render(data, "dark")

        self.assertIn("Production baseline vs candidate current", svg)
        self.assertIn(">Baseline<", svg)
        self.assertIn(">Current<", svg)
        self.assertIn("Gate: p95 &lt; 5 s", svg)
        self.assertIn("INFRASTRUCTURE SIGNALS", svg)
        self.assertIn("Redis throttling", svg)
        self.assertIn("1.7%", svg)


if __name__ == "__main__":
    unittest.main()
