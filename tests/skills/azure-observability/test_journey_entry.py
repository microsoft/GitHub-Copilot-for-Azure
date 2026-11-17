"""Static presentation contracts; actual host emission/rendering needs a retest."""

from pathlib import Path
import unittest


SKILLS = Path(__file__).resolve().parents[3] / "plugins" / "azure-observability" / "skills"


class JourneyEntryTests(unittest.TestCase):
    def test_coordinator_requires_indicator_before_approval_or_handoff(self):
        text = (SKILLS / "troubleshoot-observability/SKILL.md").read_text("utf-8")
        for phrase in ("At journey entry, before a scope/approval question",
                       "references/journey-indicator.md", "fenced Mermaid",
                       "it does not postpone presentation", "not an SVG file"):
            self.assertIn(phrase, text)

    def test_connection_inherits_coordinated_presentation_not_standalone(self):
        text = (SKILLS / "connect-observability/SKILL.md").read_text("utf-8")
        for phrase in ("inherit its Detect or Investigate focus",
                       "references/shared/journey-indicator.md",
                       "first substantive mapping/approval response",
                       "not a fifth stage", "standalone connection request"):
            self.assertIn(phrase, text)

    def test_absent_output_is_not_mislabeled_as_rendering_failure(self):
        text = (SKILLS / "troubleshoot-observability/references/journey-indicator.md"
                ).read_text("utf-8")
        for phrase in ("header alone is not the indicator",
                       "do not claim a rendering failure", "absent Mermaid output",
                       "not HTML, an image file", "text fallback"):
            self.assertIn(phrase, text)


if __name__ == "__main__":
    unittest.main()
