import json
from pathlib import Path
import runpy
import tempfile
import unittest


ARTIFACT_TOOL = runpy.run_path(str(Path(__file__).with_name("deep-research-artifact.py")))
REVISION = "9" * 40
MODEL = "gpt-5.6-sol"


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.workspace = self.root / "workspaces"
        self.source = self.workspace / "trial"
        self.source.mkdir(parents=True)
        (self.source / "azure.yaml").write_text("name: deep-research\n", encoding="utf-8")
        (self.source / ".env.example").write_text("MODEL=\n", encoding="utf-8")
        self.trajectory = self.root / "trajectory.jsonl"
        self.artifact = self.root / "artifact"
        self.output = self.root / "restored"
        self.trial = {
            "type": "trial-result", "evalName": "microsoft-foundry-e2e-eval",
            "stimulus": "Migration - Deep Research to Foundry", "status": "success", "model": MODEL,
            "trajectory": {
                "endReason": "completed", "workDir": str(self.source),
                "metadata": {"model": MODEL, "executor": "copilot-sdk"},
                "events": [{"type": "skill_activation", "data": {"name": "microsoft-foundry"}}],
            },
        }

    def freeze(self):
        self.trajectory.write_text(json.dumps(self.trial) + "\n", encoding="utf-8")
        return ARTIFACT_TOOL["freeze"](self.trajectory, self.workspace, self.artifact, REVISION, MODEL)

    def test_round_trip_excludes_runtime_and_keeps_source(self):
        for directory in (".venv", ".azure", "__pycache__", "candidate.egg-info"):
            generated = self.source / directory
            generated.mkdir()
            (generated / "transient").write_text("generated", encoding="utf-8")
        generated_link = self.source / ".venv" / "interpreter"
        try:
            generated_link.symlink_to(self.source / "azure.yaml")
        except OSError:
            pass
        manifest = self.freeze()
        restored = ARTIFACT_TOOL["restore"](self.artifact, self.output, REVISION)
        self.assertEqual(restored, manifest)
        self.assertEqual({path.name for path in self.output.iterdir()}, {"azure.yaml", ".env.example"})
        self.assertEqual((self.output / "azure.yaml").read_bytes(), (self.source / "azure.yaml").read_bytes())
        self.assertFalse((self.artifact / self.trajectory.name).exists())

    def test_activation_is_not_the_same_as_loading_the_skill(self):
        self.trial["trajectory"]["metadata"]["skillsLoaded"] = ["microsoft-foundry"]
        self.trial["trajectory"]["events"] = []
        with self.assertRaisesRegex(ValueError, "did not invoke"):
            self.freeze()

    def test_rejects_a_model_fallback(self):
        self.trial["trajectory"]["metadata"]["model"] = "gpt-4.1-mini"
        with self.assertRaisesRegex(ValueError, "requested Copilot SDK model"):
            self.freeze()

    def test_rejects_a_link_in_candidate_source(self):
        try:
            (self.source / "linked.yaml").symlink_to(self.source / "azure.yaml")
        except OSError as error:
            self.skipTest(f"Symlinks not available on this runner: {error}")
        with self.assertRaisesRegex(ValueError, "must not contain links"):
            self.freeze()

    def test_rejects_a_populated_environment_file(self):
        (self.source / ".env").write_text("TEST=private\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Do not publish"):
            self.freeze()

    def test_rejects_a_mutated_archive(self):
        self.freeze()
        with (self.artifact / "candidate.tar.gz").open("ab") as archive:
            archive.write(b"tampered")
        with self.assertRaisesRegex(ValueError, "does not match"):
            ARTIFACT_TOOL["restore"](self.artifact, self.output, REVISION)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
