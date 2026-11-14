import contextlib
import copy
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "verify-observability-fix"
SCRIPT = SKILL / "scripts" / "recovery.py"
FIXTURE = SKILL / "references" / "fixture.json"
P95_FIXTURE = SKILL / "references" / "fixture-p95.json"
SPEC = importlib.util.spec_from_file_location("recovery", SCRIPT)
api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api)
NOW = dt.datetime(2026, 10, 30, 12, 0, tzinfo=dt.timezone.utc)


def report():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def unavailable(evidence, state):
    evidence.update(
        state=state, complete=False, sample_count=None, total=None,
        first_event_at=None, latest_event_at=None,
    )
    if state == "empty":
        evidence.update(complete=True, sample_count=0, total=0)


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.value = report()
        self.check = self.value["checks"][0]

    def result(self, now=NOW):
        return api.assess(self.value, now)

    def assertVerdict(self, verdict):
        self.assertEqual(self.result()["verdict"], verdict)

    def test_fixture_recovers_from_measured_fraction(self):
        result = self.result()
        self.assertEqual(result["verdict"], "VERIFIED_RECOVERED")
        self.assertEqual(result["checks"][0]["original_value"], 0.2)
        self.assertEqual(result["checks"][0]["post_value"], 0.01)
        self.assertAlmostEqual(result["checks"][0]["delta"], -0.19)
        self.assertFalse(result["supporting_results_establish_recovery"])
        self.assertNotIn("supporting_results_used_as_gates", result)

    def test_mean_compares_measured_sum_not_response_rows(self):
        self.check.update(kind="mean", unit="milliseconds", threshold=100)
        self.check["original"]["total"] = 20000
        self.check["post"]["total"] = 5000
        self.assertVerdict("VERIFIED_RECOVERED")
        self.assertEqual(self.result()["checks"][0]["post_value"], 50)

    def test_gte_and_threshold_equality(self):
        self.check.update(operator="gte", threshold=0.98)
        self.check["original"]["total"] = 80
        self.check["post"]["total"] = 98
        self.assertVerdict("VERIFIED_RECOVERED")
        self.check["post"]["total"] = 97
        self.assertVerdict("NOT_RECOVERED")

    def test_lte_boundary(self):
        self.check["post"]["total"] = 2
        self.assertVerdict("VERIFIED_RECOVERED")
        self.check["post"]["total"] = 3
        self.assertVerdict("NOT_RECOVERED")
        self.assertIn("post_threshold_violation", self.result()["checks"][0]["reasons"])
        self.assertAlmostEqual(self.result()["checks"][0]["delta"], -0.17)

    def test_required_violation_not_hidden_by_unrelated_failed_check(self):
        guardrail = copy.deepcopy(self.check)
        guardrail.update(id="guardrail", role="guardrail")
        unavailable(guardrail["post"], "failed")
        self.value["checks"].append(guardrail)
        self.check["post"]["total"] = 20
        self.assertVerdict("NOT_RECOVERED")
        self.assertEqual(self.result()["checks"][1]["verdict"], "INCONCLUSIVE")

    def test_guardrail_violation_not_hidden_by_uncertain_original_symptom(self):
        guardrail = copy.deepcopy(self.check)
        guardrail.update(id="guardrail", role="guardrail")
        guardrail["post"]["total"] = 10
        unavailable(self.check["original"], "denied")
        self.value["checks"].append(guardrail)
        self.assertVerdict("NOT_RECOVERED")

    def test_missing_original_does_not_hide_sufficient_current_violation(self):
        unavailable(self.check["original"], "missing")
        self.check["post"]["total"] = 20
        self.assertVerdict("NOT_RECOVERED")
        self.assertIsNone(self.result()["checks"][0]["delta"])

    def test_passing_original_symptom_cannot_be_called_recovered(self):
        self.check["original"]["total"] = 1
        self.assertVerdict("INCONCLUSIVE")
        self.assertIn("original_symptom_not_established", self.result()["checks"][0]["reasons"])

    def test_guardrail_need_not_have_originally_failed(self):
        guardrail = copy.deepcopy(self.check)
        guardrail.update(id="guardrail", role="guardrail")
        guardrail["original"]["total"] = 0
        self.value["checks"].append(guardrail)
        self.assertVerdict("VERIFIED_RECOVERED")

    def test_all_unavailable_states_remain_distinct(self):
        for state in sorted(api.STATES - {"usable"}):
            with self.subTest(state=state):
                self.value = report()
                unavailable(self.value["checks"][0]["post"], state)
                self.assertVerdict("INCONCLUSIVE")
                self.assertIn("post_source_" + state, self.result()["checks"][0]["reasons"])

    def test_original_missing_denied_partial_cannot_recover(self):
        for state in ("missing", "denied", "partial", "unsupported"):
            with self.subTest(state=state):
                self.value = report()
                unavailable(self.value["checks"][0]["original"], state)
                self.assertVerdict("INCONCLUSIVE")

    def test_optional_gaps_and_failures_do_not_gate_required_recovery(self):
        optional = copy.deepcopy(self.check)
        optional.update(id="optional", required=False)
        self.value["checks"].append(optional)
        unavailable(optional["post"], "denied")
        self.assertVerdict("VERIFIED_RECOVERED")
        optional["post"] = copy.deepcopy(self.check["post"])
        optional["post"]["total"] = 30
        self.assertVerdict("VERIFIED_RECOVERED")
        self.assertEqual(self.result()["checks"][1]["verdict"], "NOT_RECOVERED")

    def test_empty_optional_only_and_guardrail_only_plans(self):
        self.value["checks"] = []
        self.assertVerdict("INCONCLUSIVE")
        self.value = report()
        self.value["checks"][0]["required"] = False
        self.assertVerdict("INCONCLUSIVE")
        self.value["checks"][0].update(required=True, role="guardrail")
        self.assertVerdict("INCONCLUSIVE")

    def test_every_target_needs_a_required_original_symptom(self):
        self.value["scope"]["targets"].append("synthetic-second-target")
        self.assertVerdict("INCONCLUSIVE")
        second = copy.deepcopy(self.check)
        second.update(id="second", target="synthetic-second-target")
        self.value["checks"].append(second)
        self.assertVerdict("VERIFIED_RECOVERED")

    def test_uncovered_target_does_not_hide_current_violation(self):
        self.value["scope"]["targets"].append("synthetic-second-target")
        self.check["post"]["total"] = 30
        self.assertVerdict("NOT_RECOVERED")

    def test_source_incomplete_even_with_usable_state_cannot_prove_failure(self):
        self.check["post"].update(complete=False, total=90)
        self.assertVerdict("INCONCLUSIVE")

    def test_expired_collection_and_assessment(self):
        self.assertEqual(
            self.result(NOW + dt.timedelta(seconds=301))["verdict"], "INCONCLUSIVE"
        )
        self.value["evaluated_at"] = "2026-10-30T12:06:00Z"
        result = self.result(NOW + dt.timedelta(seconds=360))
        self.assertIn("post_expired_evidence", result["checks"][0]["reasons"])

    def test_current_time_not_supplied_assessment_controls_event_freshness(self):
        result = self.result(NOW + dt.timedelta(seconds=61))
        self.assertEqual(result["verdict"], "INCONCLUSIVE")
        self.assertIn("post_stale_or_missing_events", result["checks"][0]["reasons"])

    def test_stale_original_relative_to_its_own_window(self):
        self.check["original"]["latest_event_at"] = "2026-10-30T10:55:00Z"
        self.assertVerdict("INCONCLUSIVE")

    def test_exact_freshness_sample_span_and_reuse_boundaries(self):
        self.check["freshness_seconds"] = 360
        self.value["max_evidence_age_seconds"] = 300
        self.check["min_observation_seconds"] = 3480
        result = self.result(NOW + dt.timedelta(seconds=300))
        self.assertEqual(result["verdict"], "VERIFIED_RECOVERED")

    def test_window_length_does_not_proxy_actual_observation_span(self):
        self.check["post"]["first_event_at"] = "2026-10-30T11:58:00Z"
        self.assertVerdict("INCONCLUSIVE")
        self.assertIn("post_insufficient_observed_span", self.result()["checks"][0]["reasons"])

    def test_insufficient_window_and_samples(self):
        self.check["min_observation_seconds"] = 3601
        self.assertVerdict("INCONCLUSIVE")
        self.check["min_observation_seconds"] = 600
        self.check["min_samples"] = 101
        self.assertVerdict("INCONCLUSIVE")

    def test_null_measurements_and_zero_samples(self):
        self.check["post"]["total"] = None
        self.assertVerdict("INCONCLUSIVE")
        unavailable(self.check["post"], "usable")
        self.assertVerdict("INCONCLUSIVE")
        self.check["post"].update(sample_count=0, total=0)
        self.assertVerdict("INCONCLUSIVE")

    def test_noncomparable_or_wrong_workload_cannot_recover(self):
        self.check["comparable"] = False
        self.assertVerdict("INCONCLUSIVE")
        self.check["post"]["total"] = 90
        self.assertVerdict("INCONCLUSIVE")
        self.check["comparable"] = True
        self.check["post"]["workload"] = "different-cohort"
        self.check["post"]["total"] = 90
        self.assertVerdict("INCONCLUSIVE")

    def test_wrong_candidate_version_cannot_prove_recovery_or_failure(self):
        self.check["post"].update(version="different-version", total=90)
        self.assertVerdict("INCONCLUSIVE")

    def test_unconfirmed_scope_or_change_cannot_prove_recovery_or_failure(self):
        self.check["post"]["total"] = 90
        for key in ("scope", "change"):
            with self.subTest(key=key):
                self.value[key]["confirmed"] = False
                self.assertVerdict("INCONCLUSIVE")
                self.value[key]["confirmed"] = True

    def test_unsupported_kind_does_not_use_numeric_proxy(self):
        self.check["kind"] = "unsupported"
        self.check["post"]["total"] = 90
        self.assertVerdict("INCONCLUSIVE")

    def test_supporting_deploy_or_evaluation_alone_never_proves_recovery(self):
        self.value["checks"] = []
        self.assertVerdict("INCONCLUSIVE")

    def test_nonpassed_support_is_unresolved_not_recovery_or_nonrecovery(self):
        for kind in ("deployment", "evaluation"):
            for state in ("failed", "partial", "unknown"):
                self.value = report()
                self.value["supporting_results"] = [{
                    "kind": kind, "reference": "synthetic-support", "state": state,
                }]
                with self.subTest(kind=kind, state=state):
                    self.assertVerdict("INCONCLUSIVE")
                    self.assertIn("unresolved_supporting_evidence", self.result()["reasons"])
                    self.assertEqual(self.result()["checks"][0]["verdict"], "VERIFIED_RECOVERED")
                    self.assertFalse(self.result()["supporting_results_establish_recovery"])

    def test_required_post_violation_wins_over_unresolved_support(self):
        for kind in ("deployment", "evaluation"):
            for state in ("failed", "partial", "unknown"):
                self.value = report()
                self.value["checks"][0]["post"]["total"] = 20
                self.value["supporting_results"] = [{
                    "kind": kind, "reference": "synthetic-support", "state": state,
                }]
                with self.subTest(kind=kind, state=state):
                    self.assertVerdict("NOT_RECOVERED")
                    self.assertIn("unresolved_supporting_evidence", self.result()["reasons"])

    def test_empty_support_allowed_for_confirmed_change(self):
        self.value["supporting_results"] = []
        self.assertVerdict("VERIFIED_RECOVERED")
        self.value["change"]["confirmed"] = False
        self.assertVerdict("INCONCLUSIVE")

    def test_passed_support_does_not_override_missing_measurements(self):
        unavailable(self.check["post"], "missing")
        self.assertVerdict("INCONCLUSIVE")
        self.assertNotIn("unresolved_supporting_evidence", self.result()["reasons"])

    def test_no_mutation(self):
        previous = copy.deepcopy(self.value)
        self.result()
        self.assertEqual(previous, self.value)


class InvalidInputTests(unittest.TestCase):
    def test_rejects_bad_numbers_and_boolean_numbers(self):
        for bad in (True, False, float("nan"), float("inf"), -1, "1", None, 10**400):
            with self.subTest(bad_type=type(bad).__name__):
                value = report()
                value["checks"][0]["threshold"] = bad
                with self.assertRaises(api.InputError):
                    api.assess(value, NOW)

    def test_rejects_nonfinite_or_boolean_aggregates(self):
        for bad in (True, float("inf"), float("nan"), -1, "1", 10**400):
            value = report()
            value["checks"][0].update(kind="mean", unit="milliseconds")
            value["checks"][0]["post"]["total"] = bad
            with self.subTest(bad_type=type(bad).__name__), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_fraction_requires_integer_numerator_and_matching_unit(self):
        for bad in (1.0, 101):
            value = report()
            value["checks"][0]["post"]["total"] = bad
            with self.assertRaises(api.InputError):
                api.assess(value, NOW)
        value = report()
        value["checks"][0]["unit"] = "percent"
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)

    def test_rejects_boolean_and_out_of_bound_integer_fields(self):
        for key in ("min_samples", "min_observation_seconds", "freshness_seconds"):
            for bad in (True, 0, -1, 1.5, 2147483648):
                value = report()
                value["checks"][0][key] = bad
                with self.subTest(key=key, bad=bad), self.assertRaises(api.InputError):
                    api.assess(value, NOW)
        for bad in (True, -1, 1.5, 2147483648):
            value = report()
            value["checks"][0]["post"]["sample_count"] = bad
            with self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_rejects_bad_timestamps(self):
        for bad in ("not-a-time", "2026-10-30", "2026-10-30T12:00:00",
                    "2026-10-30T12:00:00+01:00", "2026-02-30T12:00:00Z",
                    "2026-10-30T12:00:01Z", True):
            value = report()
            value["evaluated_at"] = bad
            with self.subTest(bad=bad), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_rejects_ordering_predeployment_and_future_evidence(self):
        mutations = (
            ("original", "window_end", "2026-10-30T11:01:00Z"),
            ("post", "window_start", "2026-10-30T10:59:00Z"),
            ("post", "window_start", "2026-10-30T12:00:00Z"),
            ("post", "collected_at", "2026-10-30T11:59:00Z"),
            ("post", "collected_at", "2026-10-30T12:00:01Z"),
            ("post", "first_event_at", "2026-10-30T10:00:00Z"),
            ("post", "latest_event_at", "2026-10-30T12:00:01Z"),
            ("post", "first_event_at", "2026-10-30T12:00:00Z"),
        )
        for window, key, bad in mutations:
            value = report()
            value["checks"][0][window][key] = bad
            with self.subTest(window=window, key=key), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_rejects_inconsistent_count_null_event_and_partial_states(self):
        mutations = (
            {"sample_count": None},
            {"sample_count": 0},
            {"sample_count": 1},
            {"first_event_at": None},
            {"latest_event_at": None},
            {"state": "partial", "complete": True},
            {"state": "empty"},
        )
        for update in mutations:
            value = report()
            value["checks"][0]["post"].update(update)
            with self.subTest(update=update), self.assertRaises(api.InputError):
                api.assess(value, NOW)

    def test_rejects_invalid_structure_even_for_optional_checks(self):
        for field in ("token", "raw_prompt"):
            value = report()
            value["checks"][0]["required"] = False
            value["checks"][0][field] = "synthetic-secret-never-echo"
            with self.assertRaises(api.InputError) as error:
                api.assess(value, NOW)
            self.assertNotIn("synthetic-secret", str(error.exception))

    def test_rejects_duplicate_check_ids_targets_and_out_of_scope_target(self):
        value = report()
        value["checks"].append(copy.deepcopy(value["checks"][0]))
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)
        value = report()
        value["scope"]["targets"] *= 2
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)
        value = report()
        value["checks"][0]["target"] = "another-target"
        with self.assertRaises(api.InputError):
            api.assess(value, NOW)

    def test_rejects_unrecognized_enums_versions_and_labels(self):
        mutations = (
            ("kind", "expression"),
            ("operator", "approximately"),
            ("role", "deployment"),
            ("metric", "https://sensitive.example"),
            ("id", "raw prompt with spaces"),
            ("required", 1),
            ("comparable", "true"),
            ("threshold", 2),
        )
        for key, bad in mutations:
            value = report()
            value["checks"][0][key] = bad
            with self.subTest(key=key), self.assertRaises(api.InputError):
                api.assess(value, NOW)
        for bad in (True, 2, "1"):
            value = report()
            value["schema_version"] = bad
            with self.assertRaises(api.InputError):
                api.assess(value, NOW)


class PercentileTests(unittest.TestCase):
    def setUp(self):
        self.value = json.loads(P95_FIXTURE.read_text(encoding="utf-8"))
        self.check = self.value["checks"][0]

    def result(self):
        return api.assess(self.value, NOW)

    def test_p95_fixture_uses_source_value_without_division_or_fabricated_total(self):
        result = self.result()
        self.assertEqual(result["verdict"], "VERIFIED_RECOVERED")
        self.assertEqual(result["checks"][0]["original_value"], 12000)
        self.assertEqual(result["checks"][0]["post_value"], 4000)
        self.assertEqual(result["checks"][0]["delta"], -8000)
        self.assertIsNone(self.check["post"]["total"])
        self.check["post"]["sample_count"] = 1000
        self.assertEqual(self.result()["checks"][0]["post_value"], 4000)

    def test_exact_p95_acceptance_bound_and_just_above(self):
        self.check["post"]["percentile_value"] = 5000
        self.assertEqual(self.result()["verdict"], "VERIFIED_RECOVERED")
        self.check["post"]["percentile_value"] = 5000.01
        self.assertEqual(self.result()["verdict"], "NOT_RECOVERED")
        self.assertIn("post_threshold_violation", self.result()["checks"][0]["reasons"])

    def test_original_p95_at_bound_does_not_establish_original_symptom(self):
        self.check["original"]["percentile_value"] = 5000
        self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")
        self.assertIn("original_symptom_not_established", self.result()["checks"][0]["reasons"])

    def test_null_percentile_value_cannot_prove_recovery(self):
        for window in ("original", "post"):
            original = self.check[window]["percentile_value"]
            self.check[window]["percentile_value"] = None
            with self.subTest(window=window):
                result = self.result()
                self.assertEqual(result["verdict"], "INCONCLUSIVE")
                self.assertIn(window + "_measurement_missing", result["checks"][0]["reasons"])
            self.check[window]["percentile_value"] = original

    def test_insufficient_percentile_volume_cannot_prove_failure_or_recovery(self):
        self.check["post"]["sample_count"] = 249
        for measured in (4000, 9000):
            self.check["post"]["percentile_value"] = measured
            with self.subTest(measured=measured):
                self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")
                self.assertIn("post_insufficient_samples", self.result()["checks"][0]["reasons"])
        self.check["post"].update(sample_count=250, percentile_value=4000)
        self.assertEqual(self.result()["verdict"], "VERIFIED_RECOVERED")

    def test_percentile_mismatch_does_not_compare_p90_or_p99_against_p95(self):
        for window in ("original", "post"):
            for measured_percentile in (90, 99):
                self.check[window]["percentile"] = measured_percentile
                with self.subTest(window=window, percentile=measured_percentile):
                    result = self.result()
                    self.assertEqual(result["verdict"], "INCONCLUSIVE")
                    self.assertIn(window + "_percentile_mismatch", result["checks"][0]["reasons"])
                self.check[window]["percentile"] = 95
        self.check["post"].update(percentile=90, percentile_value=9000)
        self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")

    def test_missing_original_p95_does_not_hide_sufficient_current_violation(self):
        self.check["original"]["percentile_value"] = None
        self.check["post"]["percentile_value"] = 9000
        self.assertEqual(self.result()["verdict"], "NOT_RECOVERED")

    def test_nonfinite_boolean_negative_and_non_numeric_percentile_values_invalid(self):
        for window in ("original", "post"):
            for bad in (True, False, float("nan"), float("inf"), -1, "4000", 10**400):
                old = self.check[window]["percentile_value"]
                self.check[window]["percentile_value"] = bad
                with self.subTest(window=window, bad_type=type(bad).__name__), \
                        self.assertRaises(api.InputError):
                    self.result()
                self.check[window]["percentile_value"] = old

    def test_percentile_definition_range_type_and_finiteness(self):
        for target in (self.check, self.check["original"], self.check["post"]):
            for bad in (0, -1, 100.01, True, False, float("nan"), float("inf"), "95", None):
                target["percentile"] = bad
                with self.subTest(bad_type=type(bad).__name__), self.assertRaises(api.InputError):
                    self.result()
            target["percentile"] = 95

    def test_percentile_definition_accepts_noninteger_and_upper_endpoint(self):
        for definition in (0.01, 95.5, 100):
            for target in (self.check, self.check["original"], self.check["post"]):
                target["percentile"] = definition
            with self.subTest(definition=definition):
                self.assertEqual(self.result()["verdict"], "VERIFIED_RECOVERED")

    def test_percentile_conditional_fields_are_required(self):
        for target, key in (
            (self.check, "percentile"),
            (self.check["original"], "percentile"),
            (self.check["post"], "percentile"),
            (self.check["original"], "percentile_value"),
            (self.check["post"], "percentile_value"),
        ):
            old = target.pop(key)
            with self.subTest(key=key), self.assertRaises(api.InputError):
                self.result()
            target[key] = old

    def test_percentile_rejects_fabricated_total(self):
        for window in ("original", "post"):
            for total in (0, 2000000):
                self.check[window]["total"] = total
                with self.subTest(window=window, total=total), self.assertRaises(api.InputError):
                    self.result()
            self.check[window]["total"] = None

    def test_other_kinds_do_not_accept_percentile_fields(self):
        value = report()
        for target, key in (
            (value["checks"][0], "percentile"),
            (value["checks"][0]["post"], "percentile"),
            (value["checks"][0]["post"], "percentile_value"),
        ):
            target[key] = 95
            with self.subTest(key=key), self.assertRaises(api.InputError):
                api.assess(value, NOW)
            del target[key]

    def test_empty_or_unknown_percentile_sample_counts_require_null_value(self):
        for count in (0, None):
            evidence = self.check["post"]
            evidence.update(sample_count=count, first_event_at=None, latest_event_at=None)
            with self.subTest(count=count), self.assertRaises(api.InputError):
                self.result()
            old = evidence["percentile_value"]
            evidence["percentile_value"] = None
            self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")
            evidence["percentile_value"] = old

    def test_p95_uses_same_partial_and_comparability_gates(self):
        self.check["post"]["complete"] = False
        self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")
        self.check["post"]["complete"] = True
        self.check["comparable"] = False
        self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")

    def test_sustained_criterion_needs_every_required_subwindow(self):
        self.check["freshness_seconds"] = 3600
        second = copy.deepcopy(self.check)
        second["id"] = "synthetic-required-subwindow"
        self.check["post"].update(
            query_ref="synthetic-first-subwindow-result",
            window_end="2026-10-30T11:30:00Z",
            latest_event_at="2026-10-30T11:29:00Z",
        )
        second["post"].update(
            query_ref="synthetic-second-subwindow-result",
            window_start="2026-10-30T11:30:00Z",
            first_event_at="2026-10-30T11:31:00Z",
        )
        self.value["checks"].append(second)
        self.assertEqual(self.result()["verdict"], "VERIFIED_RECOVERED")
        second["post"]["percentile_value"] = 9000
        self.assertEqual(self.result()["verdict"], "NOT_RECOVERED")
        unavailable(second["post"], "missing")
        second["post"]["percentile_value"] = None
        self.assertEqual(self.result()["verdict"], "INCONCLUSIVE")


class CliTests(unittest.TestCase):
    def invoke_bytes(self, content):
        stdout, stderr = io.StringIO(), io.StringIO()
        fake_stream = io.BytesIO(content)
        with patch.object(Path, "open", return_value=fake_stream), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = api.main(["synthetic-input.json"])
        return code, stdout.getvalue(), stderr.getvalue()

    def test_success_only_outputs_allowlisted_minimized_result(self):
        assess = api.assess
        with patch.object(api, "assess", side_effect=lambda value: assess(value, NOW)):
            code, out, error = self.invoke_bytes(FIXTURE.read_bytes())
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["verdict"], "VERIFIED_RECOVERED")
        self.assertNotIn("synthetic", out)
        self.assertEqual(error, "")

    def test_actual_cli_fixture_is_offline_and_json_without_input_labels(self):
        for fixture in (FIXTURE, P95_FIXTURE):
            with self.subTest(fixture=fixture.name):
                result = subprocess.run(
                    [sys.executable, "-B", str(SCRIPT), str(fixture)],
                    capture_output=True, text=True, timeout=20,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                output = json.loads(result.stdout)
                self.assertIn(output["verdict"], {"INCONCLUSIVE", "VERIFIED_RECOVERED"})
                self.assertNotIn("synthetic", result.stdout)
                self.assertEqual(result.stderr, "")

    def test_privacy_errors_for_json_duplicate_unicode_and_size(self):
        for raw in (
            b'{"incident":"synthetic-secret-never-echo",',
            b'{"schema_version":1,"schema_version":1}',
            b'{"secret":NaN}', b'{"secret":Infinity}',
            b"\xff", b" " * (api.MAX_BYTES + 1),
            b"[" * 1500 + b"]" * 1500,
        ):
            with self.subTest(size=len(raw)):
                code, out, error = self.invoke_bytes(raw)
                self.assertEqual(code, 2)
                self.assertEqual(out, "")
                self.assertNotIn("synthetic", error)
                self.assertNotIn("Traceback", error)

    def test_exponent_overflow_in_real_document_rejected(self):
        raw = FIXTURE.read_bytes().replace(b'"threshold": 0.02', b'"threshold": 1e999')
        self.assertEqual(self.invoke_bytes(raw)[0], 2)
        raw = P95_FIXTURE.read_bytes().replace(
            b'"percentile_value": 4000', b'"percentile_value": 1e999'
        )
        self.assertEqual(self.invoke_bytes(raw)[0], 2)

    def test_missing_file_and_argument_errors_do_not_echo_paths(self):
        for args in (["nonexistent-synthetic-secret.json"], ["--synthetic-secret"], []):
            out, error = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(error):
                code = api.main(args)
            self.assertEqual(code, 2)
            self.assertEqual(out.getvalue(), "")
            self.assertNotIn("synthetic-secret", error.getvalue())

    def test_output_has_no_scope_source_query_or_supporting_metadata(self):
        result = json.dumps(api.assess(report(), NOW))
        self.assertNotIn("synthetic", result)
        self.assertNotIn("query_ref", result)
        self.assertNotIn("environment", result)

    def test_denied_local_read_is_sanitized(self):
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.object(Path, "open", side_effect=PermissionError("synthetic-secret")), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = api.main(["synthetic-secret.json"])
        self.assertEqual(code, 2)
        self.assertEqual(stdout.getvalue(), "")
        self.assertNotIn("synthetic-secret", stderr.getvalue())

    def test_reads_only_bounded_input_once(self):
        stream = io.BytesIO(b" " * (api.MAX_BYTES + 2))
        with patch.object(Path, "open", return_value=stream), \
                patch.object(stream, "read", wraps=stream.read) as read:
            with self.assertRaises(api.InputError):
                api.read_input("synthetic.json")
            read.assert_called_once_with(api.MAX_BYTES + 1)

    def test_resource_links_exist(self):
        skill = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("references/contract.md", skill)
        self.assertIn("references/fixture.json", skill)
        self.assertIn("references/fixture-p95.json", skill)
        self.assertTrue((SKILL / "references" / "contract.md").is_file())
        self.assertTrue(FIXTURE.is_file())
        self.assertTrue(P95_FIXTURE.is_file())


if __name__ == "__main__":
    unittest.main()
