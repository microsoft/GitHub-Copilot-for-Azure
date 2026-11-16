"""Declared packaging additions; original specialist inventories remain pinned."""

import re
from pathlib import Path
import posixpath


SHARED_NAMES = {
    "acceptance.json", "acquire-capability.md", "handoff.md", "host-tests.md",
    "intent-cases.json", "journey-indicator.md", "matching-cases.json",
    "matching.md", "monitoring-follow-up.md", "next-action-cases.json",
    "next-actions.md", "specialists.md",
    "trace-capabilities.md", "trace-selection-cases.json", "visual-evidence.md",
}
LOCAL_SHARED_ASSETS = {"references/shared/" + name for name in SHARED_NAMES}
SHARED_SKILLS = {
    "azure-diagnostics", "connect-observability",
    "microsoft-foundry", "verify-observability-fix",
}
MARKDOWN_LINK = re.compile(r"(\[[^\]]*\]\()([^)]+)(\))")


def peer_foundry_source(relative, text):
    """Undo only the declared shared-link relocation for peer hash coordinates.

    The peer context map remains immutable source evidence. Restore its exact
    link destinations *before* slicing its original byte offsets, rather than
    regenerating hashes or accepting arbitrary link changes.
    """
    parent = posixpath.dirname(relative)

    def replace(match):
        path, separator, fragment = match[2].partition("#")
        for name in SHARED_NAMES:
            local = posixpath.relpath("references/shared/" + name, parent or ".")
            if path == local:
                original = posixpath.relpath(
                    "../troubleshoot-observability/references/" + name,
                    parent or ".",
                )
                return match[1] + original + separator + fragment + match[3]
        return match[0]

    return MARKDOWN_LINK.sub(replace, text)


def normalize_contract_links(text):
    """Compare contract text while allowing only relative link path relocation."""
    def replace(match):
        target = match[2]
        if "://" in target or target.startswith("#"):
            return match[0]
        path, separator, fragment = target.partition("#")
        return match[1] + Path(path).name + separator + fragment + match[3]

    return MARKDOWN_LINK.sub(replace, text)
