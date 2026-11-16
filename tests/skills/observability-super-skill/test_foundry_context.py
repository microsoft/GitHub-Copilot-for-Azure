"""Offline context contracts; no cloud access or runtime eager reference loading."""

from pathlib import Path
import hashlib
import json
import re
import unittest
from collections import Counter
from html import unescape
from urllib.parse import unquote, urlsplit
from _adaptation import peer_foundry_source


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "microsoft-foundry"
ENCODINGS = ("cl100k_base", "o200k_base")


def markdown_anchors(body):
    """GitHub-style ATX heading anchors and explicit HTML aliases, outside fences."""
    anchors, counts, fence = set(), Counter(), None
    for line in body.splitlines():
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            if fence is None:
                fence = marker[1][0]
            elif marker[1][0] == fence:
                fence = None
            continue
        if fence is not None:
            continue
        anchors.update(re.findall(r"<a\s+(?:id|name)=[\"']([^\"']+)[\"']", line))
        heading = re.match(r"^#{1,6}\s+(.+?)(?:\s+#+)?\s*$", line)
        if not heading:
            continue
        title = re.sub(r"<[^>]+>", "", unescape(heading[1])).casefold()
        slug = re.sub(r"[^\w\s-]", "", title).replace(" ", "-")
        index = counts[slug]
        anchors.add(slug + (f"-{index}" if index else ""))
        counts[slug] += 1
    return anchors


def markdown_links(body):
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", body):
        parsed = urlsplit(target.split(' "')[0])
        if not parsed.scheme:
            yield parsed


def selected_text(relative):
    """Reassemble retained instructions for offline assertions only."""
    path = SKILL / relative
    manifest = json.loads(
        (SKILL / "references" / "context-map.json").read_text("utf-8")
    )
    record = manifest["documents"].get(relative)
    if not record:
        return path.read_text(encoding="utf-8-sig")
    return "".join(
        payload_text(
            peer_foundry_source(
                section["path"],
                (SKILL / section["path"]).read_text("utf-8-sig"),
            ),
            section["payload_start"], section["payload_bytes"],
        )
        for section in record["sections"]
    )


def payload_text(body, start, length):
    """Coordinates address BOM-free UTF-8 bytes with platform newlines normalized."""
    normalized = body.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    return normalized.encode("utf-8")[start:start + length].decode("utf-8")


def token_counts(body):
    import tiktoken
    return {
        name: len(tiktoken.get_encoding(name).encode(body))
        for name in ENCODINGS
    }


class FoundryContextTests(unittest.TestCase):
    def test_peer_context_map_remains_unchanged_source_evidence(self):
        body = (SKILL / "references/context-map.json").read_bytes().replace(b"\r\n", b"\n")
        self.assertEqual(
            hashlib.sha256(body).hexdigest(),
            "4575bed5030e2783000e4ee10c179b22263909a660d43050512fc84c266b21b6",
            "Do not replace peer source hashes or coordinates with adapted hashes.",
        )

    def test_payload_coordinates_are_independent_of_platform_line_endings(self):
        before, payload, after = "# Guidance\n\n", "Evidence é\n\n", "## Next\n"
        start, size = len(before.encode()), len(payload.encode())
        body = before + payload + after
        for variant in (body, body.replace("\n", "\r\n"),
                        "\ufeff" + body.replace("\n", "\r\n")):
            with self.subTest(line_endings=repr(variant[:20])):
                self.assertEqual(payload_text(variant, start, size), payload)

    def test_anchor_parser_handles_formatting_aliases_duplicates_and_fences(self):
        anchors = markdown_anchors(
            '# **Hosted Variant — failures**\n## Repeat\n## Repeat\n'
            '<a id="legacy-section"></a>\n```md\n# Not a section\n```\n'
        )
        self.assertEqual(
            anchors,
            {"hosted-variant--failures", "repeat", "repeat-1", "legacy-section"},
        )

    def test_internal_markdown_links_resolve_files_and_anchors(self):
        for path in SKILL.rglob("*.md"):
            body = path.read_text("utf-8-sig")
            for link in markdown_links(body):
                target = (path.parent / unquote(link.path)).resolve() if link.path else path
                with self.subTest(path=path.relative_to(SKILL),
                                  target=link.path, anchor=link.fragment):
                    self.assertTrue(target.exists(), target)
                    if link.fragment and target.suffix == ".md":
                        self.assertIn(
                            unquote(link.fragment),
                            markdown_anchors(target.read_text("utf-8-sig")),
                        )

    def test_runtime_markdown_has_exact_named_tokenizer_bound(self):
        import tiktoken
        self.assertEqual(tiktoken.__version__, "0.12.0")
        for path in SKILL.rglob("*.md"):
            if path.name in {"host-tests.md", "integration-host-tests.md"}:
                continue
            for encoding, count in token_counts(path.read_text("utf-8-sig")).items():
                with self.subTest(path=path.relative_to(SKILL), encoding=encoding):
                    self.assertLess(count, 5000)

    def test_entry_is_small_and_conditionally_routes(self):
        entry = (SKILL / "SKILL.md").read_text("utf-8")
        body = re.sub(r"\A---\n.*?\n---\n", "", entry, flags=re.S)
        for encoding, count in token_counts(body).items():
            with self.subTest(encoding=encoding):
                self.assertLessEqual(count, 1000)
        for count in token_counts(entry).values():
            self.assertLessEqual(count, 1200)
        for phrase in ("Current-request intent", "Standalone availability",
                       "INCONCLUSIVE", "no Azure", "no Python",
                       "separately approved", "only the selected"):
            self.assertIn(phrase, entry)

    def test_native_entry_gates_precede_the_first_reference_read(self):
        entry = (SKILL / "SKILL.md").read_text("utf-8")
        first_reference = re.search(r"\[[^\]]+\]\([^)]+\)", entry).start()
        intent = entry.index("## Current-request intent gate")
        standalone = entry.index("## Standalone availability gate")
        boundaries = entry.index("## Core execution boundaries")
        self.assertLess(intent, standalone)
        self.assertLess(standalone, boundaries)
        self.assertLess(boundaries, first_reference)
        gates = entry[:first_reference]
        self.assertIn("before reads", gates)
        self.assertIn("unknown means", gates)
        self.assertIn("missing sibling-file read", gates)
        self.assertIn("Never install/download siblings", gates)

    def test_selected_entry_shared_sites_have_local_availability_and_fallback(self):
        for name in ("entry--evidence-first-entry.md", "entry--evidence-first-entry-4.md"):
            body = (SKILL / "references" / name).read_text("utf-8")
            first_shared = re.search(
                r"\]\(shared/(?:specialists|next-actions)\.md(?:#[^)]*)?\)", body
            )
            self.assertIsNotNone(first_shared, name)
            first_shared = first_shared.start()
            before = body[:first_shared]
            with self.subTest(path=name):
                self.assertIn("## Standalone availability gate", before)
                self.assertIn("unknown means missing", before)
                self.assertIn("missing sibling-file read", before)
                self.assertIn("stay local with retained evidence/scope/budgets", before)
                self.assertIn("block diagnostics/recovery", before)

    def test_split_content_and_capabilities_are_retained(self):
        manifest = json.loads(
            (SKILL / "references" / "context-map.json").read_text("utf-8")
        )
        self.assertEqual(
            manifest["payload_coordinates"], "BOM-free UTF-8 bytes; newlines normalized to LF"
        )
        for relative, record in manifest["documents"].items():
            with self.subTest(path=relative):
                body = selected_text(relative)
                self.assertEqual(
                    hashlib.sha256(body.encode()).hexdigest(),
                    record["retained_sha256"],
                )
                without_targets = re.sub(
                    r"(\[[^\]]*\])\([^)]+\)", r"\1(LINK)", body
                )
                self.assertEqual(
                    hashlib.sha256(without_targets.encode()).hexdigest(),
                    record["content_sha256"],
                )
                self.assertTrue((SKILL / relative).is_file())
                for section in record["sections"]:
                    content = (SKILL / section["path"]).read_text("utf-8")
                    self.assertIn("Reading grants no execution approval", content)
                    self.assertIn("supplied evidence", content)
                    self.assertIn("INCONCLUSIVE", content)
                    self.assertIn("supersede", content)

    def test_original_section_deep_links_remain_aliases_on_split_routers(self):
        manifest = json.loads(
            (SKILL / "references" / "context-map.json").read_text("utf-8")
        )
        for relative in manifest["documents"]:
            with self.subTest(path=relative):
                original = markdown_anchors(selected_text(relative))
                router = markdown_anchors((SKILL / relative).read_text("utf-8"))
                self.assertFalse(original - router, sorted(original - router))

    def test_catalog_index_selects_specific_bounded_files_not_all_references(self):
        relative = "foundry-agent/create/references/foundry-tool-catalog.md"
        manifest = json.loads(
            (SKILL / "references" / "context-map.json").read_text("utf-8")
        )
        path = SKILL / relative
        body = path.read_text("utf-8")
        expected = {
            (SKILL / section["path"]).resolve()
            for section in manifest["documents"][relative]["sections"]
        }
        actual = {
            (path.parent / unquote(link.path)).resolve()
            for link in markdown_links(body)
        }
        self.assertEqual(actual, expected)
        self.assertIn("Read only the selected section", body)
        self.assertIn("step/branch is reached", body)
        self.assertIn("applicable approval is covered", body)

    def test_restored_workflows_keep_their_recorded_content(self):
        manifest = json.loads(
            (SKILL / "references" / "context-map.json").read_text("utf-8")
        )
        for relative, expected in manifest["restored_markdown_sha256"].items():
            with self.subTest(path=relative):
                body = peer_foundry_source(
                    relative, (SKILL / relative).read_text("utf-8-sig")
                )
                self.assertEqual(hashlib.sha256(body.encode()).hexdigest(), expected)

    def test_every_retained_selection_is_reachable_from_its_router(self):
        manifest = json.loads(
            (SKILL / "references" / "context-map.json").read_text("utf-8")
        )
        for relative, record in manifest["documents"].items():
            if relative == "SKILL.md":
                continue  # The entry uses two conditional navigation guides.
            router = (SKILL / relative).read_text("utf-8")
            self.assertIn("Read only the selected section", router)
            for section in record["sections"]:
                with self.subTest(path=section["path"]):
                    self.assertIn(Path(section["path"]).name, router)


if __name__ == "__main__":
    unittest.main()
