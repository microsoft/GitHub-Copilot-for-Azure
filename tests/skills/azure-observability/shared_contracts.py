"""Compare declared local copies of our guidance, never external specialist pins."""

from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


SHARED_SKILLS = ("connect-observability", "verify-observability-fix")
SHARED_FILES = {
    "acquire-capability.md", "canonical-dependencies.md", "handoff.md",
    "journey-indicator.md", "matching.md", "monitoring-follow-up.md",
    "next-actions.md", "specialists.md", "trace-capabilities.md",
    "visual-evidence.md", "investigation/README.md",
    "investigation/SOURCE-NOTICE.md",
    "investigation/scripts/query_prometheus.py",
    *("investigation/references/" + name + ".md" for name in (
        "confidence-assessment", "foundry-agent-routing", "managed-prometheus",
        "portal-links", "trace-query-patterns",
    )),
}
INLINE_LINK = re.compile(r"(\[[^\]]*\]\()([^)]+)(\))")
REFERENCE_LINK = re.compile(r"(?m)^(\s{0,3}\[[^\]]+\]:\s*)(<?[^\s>]+>?)(.*)$")


def normalized_shared_markdown(path, root):
    """Canonicalize local link destinations only; retain all other contract text."""
    root = Path(root).resolve()
    path = Path(path).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Shared contract is outside its declared root")

    def normalize(target):
        destination, separator, title = target.partition(' "')
        angled = destination.startswith("<") and destination.endswith(">")
        parsed = urlsplit(destination[1:-1] if angled else destination)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return target
        decoded = unquote(parsed.path)
        if decoded.startswith("/") or "\\" in decoded:
            raise ValueError("Shared links must be portable relative destinations")
        resolved = (path.parent / decoded).resolve()
        if not resolved.is_relative_to(root):
            raise ValueError("Shared link escapes its declared closure")
        relative = resolved.relative_to(root).as_posix()
        if relative not in SHARED_FILES or not resolved.is_file():
            raise ValueError("Shared link is missing from the declared closure: " + relative)
        result = relative
        if parsed.query:
            result += "?" + parsed.query
        if parsed.fragment:
            result += "#" + parsed.fragment
        if angled:
            result = "<" + result + ">"
        return result + separator + title

    text = path.read_text("utf-8")
    text = INLINE_LINK.sub(lambda match: match[1] + normalize(match[2]) + match[3], text)
    return REFERENCE_LINK.sub(lambda match: match[1] + normalize(match[2]) + match[3], text)
