import contextlib
import copy
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "connect-observability"
SPEC = importlib.util.spec_from_file_location(
    "onboarding", SKILL / "scripts" / "onboarding.py"
)
api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api)
NOW = dt.datetime(2026, 10, 29, 12, 0, tzinfo=dt.timezone.utc)
PREFIX = (
    "/subscriptions/11111111-1111-1111-1111-111111111111"
    "/resourceGroups/synthetic/providers/"
)
APP = PREFIX + "Microsoft.Web/sites/synthetic-app"
SOURCE = PREFIX + "Microsoft.Insights/components/synthetic-ai"


def mapping():
    return {
        "schema_version": 1,
        "application": "synthetic-app",
        "environment": "test",
        "workload": "web-api",
        "confirmed_at": "2026-10-29T11:00:00Z",
        "resources": [{"resource_id": APP, "basis": "user-confirmed"}],
        "telemetry_sources": [{
            "resource_id": SOURCE, "kind": "application-insights",
            "basis": "resource-metadata",
        }],
    }


def signal(state="usable", required=True, name="requests"):
    value = {
        "name": name, "source_resource_id": SOURCE,
        "required": required, "state": state,
        "checked_at": "2026-10-29T12:00:00Z",
        "window_start": "2026-10-29T11:00:00Z",
        "window_end": "2026-10-29T12:00:00Z",
        "freshness_seconds": 300,
        "record_count": 10, "latest_event_at": "2026-10-29T11:59:00Z",
        "complete": True,
    }
    if state == "empty":
        value.update(record_count=0, latest_event_at=None)
    if state == "partial":
        value["complete"] = False
    if state in {"missing", "denied", "failed", "unsupported",
                 "unverified", "throttled"}:
        value.update(record_count=None, latest_event_at=None, complete=False)
    return value


def report(*signals):
    return {
        "schema_version": 1, "mapping": mapping(),
        "checked_at": "2026-10-29T12:00:00Z",
        "max_check_age_seconds": 600,
        "prerequisites": {
            "tools": "verified", "identity": "verified", "mapping": "verified",
        },
        "signals": list(signals) if signals else [signal()],
    }


class MappingTests(unittest.TestCase):
    def test_synthetic_mapping_validates_without_cloud_claim(self):
        self.assertEqual(api.validate_mapping(mapping(), NOW), mapping())

    def test_both_workload_lenses(self):
        value = mapping()
        for workload in ("web-api", "foundry-agent"):
            with self.subTest(workload=workload):
                value["workload"] = workload
                api.validate_mapping(value, NOW)

    def test_unknown_fields_rejected_without_echoing_secret(self):
        value = mapping()
        value["token"] = "synthetic-secret-never-echo"
        with self.assertRaises(api.InputError) as error:
            api.validate_mapping(value, NOW)
        self.assertNotIn(value["token"], str(error.exception))

    def test_strict_version(self):
        for version in (True, "1", 2, None):
            with self.subTest(version=version):
                value = mapping()
                value["schema_version"] = version
                with self.assertRaises(api.InputError):
                    api.validate_mapping(value, NOW)

    def test_invalid_resource_ids(self):
        for rid in (
            "https://portal.azure.com/#resource/" + APP,
            APP + "?token=synthetic-secret",
            APP + "#fragment",
            APP.replace("11111111", "zzzzzzzz"),
            PREFIX,
            "/subscriptions/11111111-1111-1111-1111-111111111111",
        ):
            with self.subTest(rid=rid):
                value = mapping()
                value["resources"][0]["resource_id"] = rid
                with self.assertRaises(api.InputError):
                    api.validate_mapping(value, NOW)

    def test_nested_resources(self):
        value = mapping()
        value["resources"][0]["resource_id"] = (
            PREFIX + "Microsoft.CognitiveServices/accounts/synthetic/projects/test"
        )
        api.validate_mapping(value, NOW)

    def test_source_kind_must_match_provider_and_type(self):
        value = mapping()
        value["telemetry_sources"][0]["kind"] = "azure-monitor-workspace"
        with self.assertRaises(api.InputError):
            api.validate_mapping(value, NOW)

    def test_each_supported_source_kind(self):
        for kind, suffix in {
            "application-insights": "Microsoft.Insights/components/test",
            "log-analytics": "Microsoft.OperationalInsights/workspaces/test",
            "azure-monitor-workspace": "Microsoft.Monitor/accounts/test",
            "grafana": "Microsoft.Dashboard/grafana/test",
            "foundry-project": "Microsoft.CognitiveServices/accounts/test/projects/test",
        }.items():
            with self.subTest(kind=kind):
                value = mapping()
                value["telemetry_sources"][0].update(
                    kind=kind, resource_id=PREFIX + suffix,
                )
                api.validate_mapping(value, NOW)

    def test_duplicate_ids_case_insensitive(self):
        for key in ("resources", "telemetry_sources"):
            value = mapping()
            duplicate = copy.deepcopy(value[key][0])
            duplicate["resource_id"] = duplicate["resource_id"].upper()
            value[key].append(duplicate)
            with self.subTest(key=key), self.assertRaises(api.InputError):
                api.validate_mapping(value, NOW)

    def test_label_constraints(self):
        for label in ("", "user input with spaces", "https://example.test", "x" * 65):
            value = mapping()
            value["application"] = label
            with self.subTest(label=label), self.assertRaises(api.InputError):
                api.validate_mapping(value, NOW)

    def test_future_and_naive_confirmation_rejected(self):
        for time in ("2026-10-29T12:01:00Z", "2026-10-29T11:00:00",
                     "2026-10-29T11:00:00+01:00"):
            value = mapping()
            value["confirmed_at"] = time
            with self.subTest(time=time), self.assertRaises(api.InputError):
                api.validate_mapping(value, NOW)

    def test_empty_and_oversized_lists_rejected(self):
        for entries in ([], [mapping()["resources"][0]] * 51):
            value = mapping()
            value["resources"] = entries
            with self.assertRaises(api.InputError):
                api.validate_mapping(value, NOW)


class ReadinessTests(unittest.TestCase):
    def test_ready_is_not_a_health_or_independent_evidence_claim(self):
        result = api.assess(report(), NOW)
        self.assertEqual(result["readiness"], "ready")
        self.assertEqual(result["basis"],
                         "supplied-observations-not-independent-verification")
        self.assertNotIn("healthy", result)

    def test_all_signal_states_preserved(self):
        expected = {
            "usable": "ready", "missing": "blocked", "denied": "blocked",
            "failed": "blocked", "unsupported": "blocked",
            "empty": "telemetry-unverified", "stale": "telemetry-unverified",
            "throttled": "telemetry-unverified", "partial": "telemetry-unverified",
            "unverified": "telemetry-unverified",
        }
        for state, readiness in expected.items():
            with self.subTest(state=state):
                result = api.assess(report(signal(state)), NOW)
                self.assertEqual(result["readiness"], readiness)
                self.assertEqual(result["signals"][0]["state"], state)

    def test_missing_metadata_access_does_not_hide_log_denial(self):
        value = report(signal("denied"))
        result = api.assess(value, NOW)
        self.assertEqual(result["prerequisites"]["mapping"], "verified")
        self.assertEqual(result["signals"][0]["effective_state"], "denied")
        self.assertEqual(result["readiness"], "blocked")

    def test_each_prerequisite_failure(self):
        for name in ("tools", "identity", "mapping"):
            for state in ("missing", "denied", "failed", "unverified"):
                with self.subTest(name=name, state=state):
                    value = report()
                    value["prerequisites"][name] = state
                    result = api.assess(value, NOW)
                    expected = "telemetry-unverified" if state == "unverified" else "blocked"
                    self.assertEqual(result["readiness"], expected)

    def test_unresolved_mapping_can_report_blocked_without_signals(self):
        value = report()
        value.update(mapping=None, signals=[])
        value["prerequisites"]["mapping"] = "missing"
        self.assertEqual(api.assess(value, NOW)["readiness"], "blocked")

    def test_verified_mapping_requires_object(self):
        value = report()
        value["mapping"] = None
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)

    def test_optional_gaps_limit_coverage(self):
        for state in api.STATES - {"usable"}:
            with self.subTest(state=state):
                value = report(signal(), signal(state, False, "metrics"))
                self.assertEqual(api.assess(value, NOW)["readiness"], "limited-coverage")

    def test_some_core_data_with_other_core_empty_is_limited(self):
        value = report(signal(), signal("empty", True, "dependencies"))
        self.assertEqual(api.assess(value, NOW)["readiness"], "limited-coverage")

    def test_optional_data_cannot_establish_core_readiness(self):
        value = report(signal("empty"), signal("usable", False, "metrics"))
        self.assertEqual(api.assess(value, NOW)["readiness"], "telemetry-unverified")

    def test_no_core_signal_cannot_be_vacuously_ready(self):
        for signals in ([], [signal(required=False)]):
            value = report()
            value["signals"] = signals
            with self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_stale_data_uses_current_time(self):
        value = report()
        result = api.assess(value, NOW + dt.timedelta(seconds=241))
        self.assertEqual(result["signals"][0]["state"], "usable")
        self.assertEqual(result["signals"][0]["effective_state"], "stale")
        self.assertEqual(result["readiness"], "telemetry-unverified")

    def test_exact_freshness_boundary(self):
        result = api.assess(report(), NOW + dt.timedelta(seconds=240))
        self.assertEqual(result["readiness"], "ready")

    def test_expired_report_and_check_cannot_be_ready(self):
        result = api.assess(report(), NOW + dt.timedelta(seconds=601))
        self.assertEqual(result["readiness"], "telemetry-unverified")
        self.assertEqual(result["reasons"], ["assessment-expired"])
        self.assertTrue(result["signals"][0]["check_expired"])

    def test_old_individual_check_in_recent_report_is_unverified(self):
        value = report()
        value["signals"][0].update(
            checked_at="2026-10-29T11:30:00Z",
            window_end="2026-10-29T11:30:00Z",
            latest_event_at="2026-10-29T11:29:00Z",
        )
        self.assertEqual(api.assess(value, NOW)["signals"][0]["effective_state"],
                         "unverified")

    def test_expired_denial_remains_visible_and_blocking(self):
        result = api.assess(report(signal("denied")), NOW + dt.timedelta(hours=1))
        self.assertEqual(result["readiness"], "blocked")
        self.assertEqual(result["signals"][0]["effective_state"], "denied")

    def test_future_assessment_rejected(self):
        with self.assertRaises(api.InputError):
            api.assess(report(), NOW - dt.timedelta(seconds=1))

    def test_check_before_confirmation_rejected(self):
        value = report()
        value["mapping"]["confirmed_at"] = "2026-10-29T12:00:00Z"
        value["signals"][0]["checked_at"] = "2026-10-29T11:59:00Z"
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)

    def test_window_and_latest_event_validation(self):
        for changes in (
            {"window_start": "2026-10-29T12:00:00Z"},
            {"window_end": "2026-10-29T12:01:00Z"},
            {"latest_event_at": "2026-10-29T10:00:00Z"},
            {"latest_event_at": "2026-10-29T12:01:00Z"},
        ):
            value = report()
            value["signals"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_invalid_usable_evidence_rejected(self):
        for changes in (
            {"complete": False}, {"record_count": 0, "latest_event_at": None},
            {"record_count": None}, {"latest_event_at": None},
            {"record_count": True}, {"required": "yes"},
            {"record_count": -1},
        ):
            value = report()
            value["signals"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_partial_cannot_claim_complete(self):
        value = report(signal("partial"))
        value["signals"][0]["complete"] = True
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)

    def test_empty_aggregate_row_not_counted_as_one_event(self):
        value = report(signal("empty"))
        result = api.assess(value, NOW)
        self.assertEqual(result["signals"][0]["record_count"], 0)
        self.assertEqual(result["readiness"], "telemetry-unverified")

    def test_wrong_source_and_duplicate_observation_rejected(self):
        value = report()
        value["signals"][0]["source_resource_id"] = APP
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)
        with self.assertRaises(api.InputError):
            api.assess(report(signal(), signal()), NOW)

    def test_thresholds_have_no_silent_defaults(self):
        for key in ("freshness_seconds",):
            for threshold in (0, -1, True, None, "300"):
                value = report()
                value["signals"][0][key] = threshold
                with self.subTest(threshold=threshold), self.assertRaises(api.InputError):
                    api.assess(value, NOW)
        value = report()
        del value["max_check_age_seconds"]
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)


class LocalIOTests(unittest.TestCase):
    def setUp(self):
        scratch = Path(__file__).resolve().parent / ".test-work"
        scratch.mkdir(exist_ok=True)
        self.addCleanup(lambda: scratch.rmdir() if not any(scratch.iterdir()) else None)
        self.temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        previous_ceiling = os.environ.get("GIT_CEILING_DIRECTORIES")
        os.environ["GIT_CEILING_DIRECTORIES"] = str(scratch)

        def restore_git_boundary():
            if previous_ceiling is None:
                os.environ.pop("GIT_CEILING_DIRECTORIES", None)
            else:
                os.environ["GIT_CEILING_DIRECTORIES"] = previous_ceiling

        self.addCleanup(restore_git_boundary)

    def write(self, text):
        path = self.root / "input.json"
        path.write_text(text, encoding="utf-8")
        return path

    def git(self, *args):
        result = subprocess.run(
            ["git", "-C", str(self.root), *args],
            check=False, capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        return result

    def prepare_repo(self, ignore=True):
        self.git("init", "--quiet")
        if ignore:
            (self.root / ".gitignore").write_text(".obs/\n", encoding="utf-8")

    def test_malformed_and_duplicate_json_do_not_echo_contents(self):
        for text in ('{"secret":"never-echo",}', '{"token":1,"token":2}',
                     '{"value":NaN}', '{"value":Infinity}'):
            path = self.write(text)
            with self.subTest(text=text), self.assertRaises(api.InputError) as error:
                api.read_json(path)
            self.assertNotIn("never-echo", str(error.exception))

    def test_size_limit(self):
        with self.assertRaises(api.InputError):
            api.read_json(self.write(" " * (api.MAX_BYTES + 1)))

    def test_invalid_utf8(self):
        path = self.root / "bad.json"
        path.write_bytes(b"\xff")
        with self.assertRaises(api.InputError):
            api.read_json(path)

    def test_consent_required_before_any_write(self):
        with self.assertRaises(api.InputError):
            api.save_mapping(mapping(), self.root)
        self.assertFalse((self.root / ".obs").exists())

    def test_refuse_nonignored_or_nongit_destination(self):
        with self.assertRaises(api.InputError):
            api.save_mapping(mapping(), self.root, consent=True)
        self.prepare_repo(ignore=False)
        with self.assertRaises(api.InputError):
            api.save_mapping(mapping(), self.root, consent=True)
        self.assertFalse((self.root / ".obs").exists())

    def test_save_round_trip_and_explicit_replacement(self):
        self.prepare_repo()
        result = api.save_mapping(mapping(), self.root, consent=True)
        self.assertTrue(result["saved"])
        self.assertFalse(result["cloud_access_verified"])
        destination = self.root / ".obs" / "application.json"
        self.assertEqual(api.read_json(destination), mapping())
        with self.assertRaises(api.InputError):
            api.save_mapping(mapping(), self.root, consent=True)
        changed = mapping()
        changed["environment"] = "staging"
        api.save_mapping(changed, self.root, consent=True, replace=True)
        self.assertEqual(api.read_json(destination), changed)
        self.assertEqual([p.name for p in destination.parent.iterdir()],
                         ["application.json"])

    def test_tracked_destination_is_rejected(self):
        self.prepare_repo()
        destination = self.root / ".obs" / "application.json"
        destination.parent.mkdir()
        destination.write_text(json.dumps(mapping()), encoding="utf-8")
        self.git("add", "--force", ".obs/application.json")
        with self.assertRaises(api.InputError):
            api.save_mapping(mapping(), self.root, consent=True, replace=True)

    def test_report_cannot_be_saved_as_mapping(self):
        self.prepare_repo()
        with self.assertRaises(api.InputError):
            api.save_mapping(report(), self.root, consent=True)
        self.assertFalse((self.root / ".obs").exists())

    def test_cli_classification_and_error_exit_are_distinct(self):
        path = self.write(json.dumps(report(signal("denied"))))
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = api.main(["assess", str(path)])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["readiness"], "blocked")
        path = self.write('{"secret":"never-echo",}')
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = api.main(["validate", str(path)])
        self.assertEqual(code, 2)
        self.assertNotIn("never-echo", error.getvalue())

    def test_cli_missing_file_has_explicit_sanitized_error(self):
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = api.main(["validate", str(self.root / "private-name.json")])
        self.assertEqual(code, 2)
        self.assertIn("Error:", error.getvalue())
        self.assertNotIn("private-name", error.getvalue())

    def test_load_requires_live_revalidation(self):
        self.prepare_repo()
        api.save_mapping(mapping(), self.root, consent=True)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = api.main(["load", "--project", str(self.root)])
        self.assertEqual(code, 0)
        self.assertTrue(json.loads(output.getvalue())["requires_live_revalidation"])

    def test_corrupt_saved_mapping_is_not_silently_ignored(self):
        directory = self.root / ".obs"
        directory.mkdir()
        (directory / "application.json").write_text("{", encoding="utf-8")
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = api.main(["load", "--project", str(self.root)])
        self.assertEqual(code, 2)

    def test_nonclobber_write_is_atomic_and_cleans_temp_on_collision(self):
        self.prepare_repo()
        destination = self.root / ".obs" / "application.json"

        def collision(_source, target):
            Path(target).write_text("existing", encoding="utf-8")
            raise FileExistsError()

        with patch.object(api.os, "link", side_effect=collision):
            with self.assertRaises(FileExistsError):
                api.save_mapping(mapping(), self.root, consent=True)
        self.assertEqual(destination.read_text(encoding="utf-8"), "existing")
        self.assertEqual(len(list(destination.parent.iterdir())), 1)

    def test_git_timeout_produces_error_not_success(self):
        path = self.write(json.dumps(mapping()))
        error = io.StringIO()
        with patch.object(api.subprocess, "run",
                          side_effect=subprocess.TimeoutExpired("git", 15)):
            with contextlib.redirect_stderr(error):
                code = api.main(["save", str(path), "--project",
                                 str(self.root), "--consent"])
        self.assertEqual(code, 2)
        self.assertFalse((self.root / ".obs").exists())

    def test_missing_git_has_actionable_error(self):
        self.prepare_repo()
        with patch.object(api.subprocess, "run", side_effect=FileNotFoundError()):
            with self.assertRaisesRegex(api.InputError, "Git is required"):
                api.save_mapping(mapping(), self.root, consent=True)

    def test_redirected_destination_is_rejected(self):
        expected = self.root.resolve() / ".obs"
        original_resolve = Path.resolve

        def redirected(path, *args, **kwargs):
            if path == expected:
                return self.root / "different-directory"
            return original_resolve(path, *args, **kwargs)

        with patch.object(Path, "resolve", redirected):
            with self.assertRaisesRegex(api.InputError, "redirected"):
                api.mapping_path(self.root)

    def test_symlink_destination_is_rejected(self):
        with patch.object(Path, "is_symlink", return_value=True):
            with self.assertRaisesRegex(api.InputError, "Symlink"):
                api.mapping_path(self.root)

    def test_cli_subprocess_produces_machine_readable_result(self):
        path = self.write(json.dumps(report(signal("empty"))))
        completed = subprocess.run(
            [sys.executable, "-B", str(SKILL / "scripts" / "onboarding.py"),
             "assess", str(path)],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(json.loads(completed.stdout)["readiness"],
                         "telemetry-unverified")
        self.assertFalse((self.root / ".obs").exists())

    def test_replace_failure_preserves_original_and_cleans_temp(self):
        self.prepare_repo()
        api.save_mapping(mapping(), self.root, consent=True)
        destination = self.root / ".obs" / "application.json"
        original = destination.read_bytes()
        with patch.object(api.os, "replace", side_effect=OSError()):
            with self.assertRaises(OSError):
                api.save_mapping(mapping(), self.root, consent=True, replace=True)
        self.assertEqual(destination.read_bytes(), original)
        self.assertEqual(len(list(destination.parent.iterdir())), 1)


class SkillPackageTests(unittest.TestCase):
    def test_metadata_and_relative_references(self):
        content = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(content.startswith("---\nname: connect-observability\n"))
        self.assertIn("\ndescription:", content)
        self.assertNotIn("allowed-tools:", content)
        references = re.findall(r"\]\(([^)]+)\)", content)
        self.assertGreaterEqual(len(references), 2)
        for reference in references:
            with self.subTest(reference=reference):
                self.assertTrue((SKILL / reference).is_file())
        self.assertTrue((SKILL / "scripts" / "onboarding.py").is_file())

    def test_all_skill_directories_have_matching_metadata(self):
        skill_files = sorted((ROOT / "skills").glob("*/SKILL.md"))
        self.assertGreaterEqual(len(skill_files), 2)
        names = set()
        for path in skill_files:
            with self.subTest(skill=path.parent.name):
                content = path.read_text(encoding="utf-8")
                metadata = content.split("---", 2)
                self.assertEqual(len(metadata), 3)
                name = re.search(r"^name: ([a-z0-9-]+)$", metadata[1], re.MULTILINE)
                description = re.search(r"^description: .+$", metadata[1], re.MULTILINE)
                self.assertIsNotNone(name)
                self.assertIsNotNone(description)
                self.assertEqual(name.group(1), path.parent.name)
                self.assertNotIn(name.group(1), names)
                names.add(name.group(1))

    def test_all_skill_markdown_links_resolve_inside_complete_package(self):
        for directory in sorted((ROOT / "skills").iterdir()):
            if not directory.is_dir():
                continue
            for path in directory.rglob("*.md"):
                content = path.read_text(encoding="utf-8")
                for target in re.findall(r"\]\(([^)]+)\)", content):
                    if target.startswith(("https://", "http://", "#")):
                        continue
                    relative = target.split("#", 1)[0]
                    destination = (path.parent / relative).resolve()
                    with self.subTest(path=path.name, target=target):
                        shared = {
                            (ROOT / "skills/troubleshoot-observability/references" / name).resolve()
                            for name in ("trace-capabilities.md", "next-actions.md",
                                         "specialists.md", "host-tests.md")
                        }
                        self.assertTrue(destination.is_relative_to(directory.resolve())
                                        or destination in shared)
                        self.assertTrue(destination.is_file())

    def test_public_health_package_has_complete_lenses_and_handoff(self):
        directory = ROOT / "skills" / "assess-observability-health"
        for name in ("web-api", "foundry-agent", "evidence",
                     "query-guidance", "host-tests"):
            with self.subTest(resource=name):
                self.assertTrue((directory / "references" / (name + ".md")).is_file())

    def test_health_continuation_preserves_specialist_fields_without_reassessment(self):
        health = ROOT / "skills" / "assess-observability-health"
        entry = (health / "SKILL.md").read_text(encoding="utf-8")
        evidence = (health / "references" / "evidence.md").read_text(
            encoding="utf-8"
        )
        routing = (
            ROOT / "skills" / "connect-observability"
            / "references" / "routing.md"
        ).read_text(encoding="utf-8")
        self.assertIn("continuation of a completed one", entry)
        self.assertIn("rank, finding state, ranking basis", evidence)
        self.assertIn("unknown rank/state stays unknown", evidence)
        self.assertIn("VERIFIED_RECOVERED", evidence)
        self.assertIn("do not repeat health assessment", routing)
        self.assertIn("ask for that selection", routing)


if __name__ == "__main__":
    unittest.main()
