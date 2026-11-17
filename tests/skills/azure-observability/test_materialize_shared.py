"""Offline shared-materializer contracts against isolated synthetic directories."""

import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


TESTS = Path(__file__).resolve().parent
REPOSITORY = TESTS.parents[2]
SPEC = importlib.util.spec_from_file_location(
    "observability_materializer",
    REPOSITORY / "eng/azure-observability/materialize-shared.py",
)
materializer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(materializer)


class SharedMaterializerTests(unittest.TestCase):
    def setUp(self):
        scratch = TESTS / ".test-work"
        scratch.mkdir(exist_ok=True)
        self.addCleanup(lambda: scratch.rmdir() if scratch.is_dir()
                        and not any(scratch.iterdir()) else None)
        temporary = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.skills = self.root / "skills"
        self.source = self.skills / "troubleshoot-observability/references"
        self.skill = self.skills / "connect-observability"
        self.destination = self.skill / "references/shared"
        self.write(self.source / "next-actions.md",
                   b'[Selection](specialists.md#selection)\r\n')
        self.write(self.source / "specialists.md",
                   b'[Investigation](investigation/README.md)\n'
                   b'[External](https://example.invalid/instructions)\n')
        self.write(self.source / "investigation/README.md",
                   b'[Helper](scripts/query.py)\n[Notice](SOURCE-NOTICE.md)\n')
        self.write(self.source / "investigation/SOURCE-NOTICE.md", b"# Notice\n")
        self.write(self.source / "investigation/scripts/query.py", b'print("fixture")\n')
        self.write(self.skill / "SKILL.md",
                   b'[Policy](../troubleshoot-observability/references/'
                   b'next-actions.md#decision "title")\n')
        for name, value in {
            "ROOT": self.root, "SKILLS": self.skills, "SOURCE": self.source,
            "SEEDS": {"connect-observability": ("next-actions.md",)},
        }.items():
            override = patch.object(materializer, name, value)
            override.start()
            self.addCleanup(override.stop)
        output = contextlib.redirect_stdout(io.StringIO())
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)

    def write(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def snapshot(self):
        return {path.relative_to(self.root).as_posix(): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def test_check_reports_missing_and_stale_resources_without_writing(self):
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "stale"):
            materializer.materialize()
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(self.destination.exists())
        materializer.materialize(write=True)
        (self.destination / "next-actions.md").write_bytes(b"stale fixture\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "stale"):
            materializer.materialize()
        self.assertEqual(self.snapshot(), before)

    def test_write_copies_complete_selected_bytes_and_rebases_incoming_links(self):
        materializer.materialize(write=True)
        selected = materializer.shared_files(("next-actions.md",))
        actual = {path.relative_to(self.destination)
                  for path in self.destination.rglob("*") if path.is_file()}
        self.assertEqual(actual, {path.relative_to(self.source) for path in selected})
        self.assertEqual(len(actual), 5)
        for relative in actual:
            with self.subTest(resource=relative):
                self.assertEqual((self.destination / relative).read_bytes(),
                                 (self.source / relative).read_bytes())
        self.assertEqual((self.skill / "SKILL.md").read_text("utf-8"),
                         '[Policy](references/shared/next-actions.md#decision "title")\n')
        before = self.snapshot()
        materializer.materialize()
        materializer.materialize(write=True)
        self.assertEqual(self.snapshot(), before)

    def test_unexpected_derived_file_is_rejected_without_deletion_or_overwrite(self):
        materializer.materialize(write=True)
        self.write(self.destination / "unexpected.json", b'{"keep": true}\n')
        before = self.snapshot()
        for write in (False, True):
            with self.subTest(write=write):
                with self.assertRaisesRegex(ValueError, "Unexpected shared files"):
                    materializer.materialize(write=write)
                self.assertEqual(self.snapshot(), before)

    def test_missing_and_escaping_sources_are_rejected(self):
        self.write(self.source.parent / "outside.md", b"# Outside\n")
        for seed in ("missing.md", "../outside.md"):
            with self.subTest(seed=seed):
                with self.assertRaisesRegex(ValueError, "Invalid shared source"):
                    materializer.shared_files((seed,))
        self.write(self.source / "next-actions.md", b"[Escape](../outside.md)\n")
        with self.assertRaisesRegex(ValueError, "Invalid shared source"):
            materializer.shared_files(("next-actions.md",))
        self.assertFalse(self.destination.exists())

    def test_symlinked_source_and_destination_files_or_root_are_rejected(self):
        original = Path.is_symlink
        source = self.source / "next-actions.md"
        with patch.object(Path, "is_symlink",
                          lambda path: path == source or original(path)):
            with self.assertRaisesRegex(ValueError, "Invalid shared source"):
                materializer.materialize(write=True)
        self.assertFalse(self.destination.exists())
        with patch.object(Path, "is_symlink",
                          lambda path: path == self.destination or original(path)):
            with self.assertRaisesRegex(ValueError, "symlink"):
                materializer.materialize(write=True)
        materializer.materialize(write=True)
        target = self.destination / "next-actions.md"
        before = self.snapshot()
        with patch.object(Path, "is_symlink",
                          lambda path: path == target or original(path)):
            with self.assertRaisesRegex(ValueError, "symlink"):
                materializer.materialize(write=True)
        self.assertEqual(self.snapshot(), before)

    def test_symlinked_destination_parent_is_rejected_before_writing(self):
        self.destination.mkdir(parents=True)
        original = Path.is_symlink
        parent = self.destination / "investigation"
        parent.mkdir()
        before = self.snapshot()
        with patch.object(Path, "is_symlink",
                          lambda path: path == parent or original(path)):
            with self.assertRaisesRegex(ValueError, "symlink"):
                materializer.materialize(write=True)
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
