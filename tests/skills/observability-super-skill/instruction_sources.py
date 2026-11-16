"""Explicit extracted instruction sources for offline contract assertions."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS = ROOT / "skills"
COORDINATOR_GUIDES = ("intent.md", "scope-permissions.md", "selection.md", "reporting.md")


def read_contract(relative):
    path = SKILLS / relative
    content = path.read_text("utf-8")
    if relative == "troubleshoot-observability/SKILL.md":
        references = path.parent / "references"
        content += "\n" + "\n".join(
            (references / name).read_text("utf-8")
            for name in COORDINATOR_GUIDES
        )
    elif relative == "microsoft-foundry/SKILL.md":
        from test_foundry_context import selected_text
        content = selected_text("SKILL.md")
    return content


def host_contract():
    return "\n".join(
        path.read_text("utf-8")
        for path in sorted((Path(__file__).resolve().parent / "host-acceptance").glob("*.md"))
    )
