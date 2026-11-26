import argparse
from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import threading


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def command(arguments, log):
    executable = shutil.which(arguments[0])
    if not executable:
        raise ValueError(f"Missing evaluator tool: {arguments[0]}.")
    result = subprocess.run([executable, *arguments[1:]], capture_output=True, timeout=120, check=False)
    log.with_suffix(".stdout.txt").write_bytes(result.stdout)
    log.with_suffix(".stderr.txt").write_bytes(result.stderr)
    if result.returncode:
        raise ValueError(f"{log.name} failed; see private receipts.")
    return result.stdout


def prepare(assessor, base_config, setup, definition):
    setup.mkdir()
    config = read_json(base_config)
    config["external_provider_fixture"] = str(assessor.ROOT / "fixture")
    config["credential_chain_audit"] = str(setup / "state-audit.json")
    config["azd_context"] = str(setup / ".azure")
    config = assessor.validate_config(config)
    if not assessor.helpers.fixture_enabled(config):
        raise ValueError("Configure the fixed assessor's external-provider fixture and its real test bindings.")
    subscription = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
    if not subscription or config["project_id"].split("/")[2].lower() != subscription.lower():
        raise ValueError("The test project must belong to the approved subscription.")
    project = json.loads(command(["az", "resource", "show", "--ids", config["project_id"], "-o", "json"],
                                 setup / "project-read"))
    if (project.get("id", "").lower() != config["project_id"].lower()
            or project.get("properties", {}).get("provisioningState") != "Succeeded"
            or not project.get("location")):
        raise ValueError("The configured disposable Foundry project is not ready.")
    status = json.loads(command(["azd", "auth", "login", "--check-status", "--output", "json"], setup / "azd-auth"))
    if status.get("status") != "success":
        raise ValueError("Evaluator azd authentication is not ready.")
    agent_name = assessor.deployment_name(definition, config, "sol-1")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", agent_name or ""):
        raise ValueError("The evaluator needs a resolvable agent name for its test deployment.")
    versions = f"{config['project_endpoint']}/agents/{agent_name}/versions?api-version=v1"
    listed = json.loads(command(["az", "rest", "--method", "get", "--url", versions,
                                 "--resource", "https://ai.azure.com", "-o", "json"], setup / "agent-versions-before"))
    if listed.get("data") != [] or listed.get("has_more"):
        raise ValueError("Use a disposable test project with no pre-existing versions of the candidate agent.")
    environment = config.setdefault("environment", {})
    environment["AZURE_ENV_NAME"] = "deep-research-e2e"
    environment["AZURE_SUBSCRIPTION_ID"] = subscription
    environment["AZURE_LOCATION"] = project["location"]
    (setup / "azure.yaml").write_text("name: deep-research-e2e\n", encoding="utf-8")
    command(["azd", "env", "new", environment["AZURE_ENV_NAME"], "--cwd", str(setup), "--subscription",
             subscription, "--location", project["location"], "--no-prompt"], setup / "azd-env")
    if not (setup / ".azure" / "config.json").is_file():
        raise ValueError("The isolated azd context was not created.")
    assessor.save(setup / "operator.json", config)
    return config, agent_name


def observe_state(assessor, observer, source, root, config, stopped):
    receipt = root / "deployed-agent.json"
    while not stopped.wait(0.25):
        try:
            agent = read_json(receipt)
        except (FileNotFoundError, json.JSONDecodeError):
            continue
        venv = root / "local-venv"
        python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        try:
            sdk = Path(command([str(python), "-I", "-B", "-c",
                "import inspect; from langchain_azure_ai.agents.hosting import FoundryCheckpointSaver; "
                "print(inspect.getsourcefile(FoundryCheckpointSaver))"], receipt.parent / "state-sdk").decode().strip())
            if not sdk.resolve().is_relative_to(venv.resolve()):
                raise ValueError("The inspected SDK is outside the freshly installed runtime.")
            calls = observer.native_state_calls(source)
            definition = agent["definition"]
            identity = agent["instance_identity"]["principal_id"]
            settings = definition.get("environment_variables", {})
            no_explicit_credential = not set(settings).intersection({
                "AZURE_CLIENT_SECRET", "AZURE_CLIENT_CERTIFICATE_PATH", "AZURE_USERNAME", "AZURE_PASSWORD",
                "AZURE_TOKEN_CREDENTIALS",
            })
            verified = bool(identity and calls and all(call["default_credential"] for call in calls)
                            and "else DefaultAzureCredential()" in sdk.read_text(encoding="utf-8")
                            and no_explicit_credential)
            audit = {
                "reviewed_by": "fixed-assessor-portable-state-observer/v1",
                "basis": "source_and_deployed_configuration",
                "source_manifest_sha256": assessor.digest(assessor.manifest(source)),
                "deployed_definition_sha256": assessor.digest(definition),
                "project_endpoint": config["project_endpoint"],
                "agent_name": agent["name"],
                "agent_version": str(agent["version"]),
                "principal_id": identity,
                "operations": {"state": {
                    "mechanism": "managed_identity",
                    "verified": verified,
                    "source_references": [f"{call['path']}:{call['line']}" for call in calls] + [str(sdk)],
                    "deployed_config_references": ["instance_identity.principal_id", "definition.environment_variables"],
                }},
            }
            destination = Path(config["credential_chain_audit"])
            pending = destination.with_suffix(".tmp")
            assessor.save(pending, audit)
            pending.replace(destination)
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
            assessor.save(root / "state-audit-error.json", {"error": str(error)})
        return


@contextmanager
def bind_local_uv(assessor):
    local_test = assessor.local_test

    def run(reference, application, root, config=None):
        _, definition, _, _ = assessor.layout(application)
        if shlex.split(definition.get("startupCommand", ""))[:3] != ["uv", "run", "--no-sync"]:
            return local_test(reference, application, root, config)
        python = Path(reference.engine.PYTHON)
        venv = root.parent / "local-venv"
        uv = shutil.which("uv")
        if python.parent.parent != venv or not uv:
            raise ValueError("The submitted uv startup needs the freshly installed evaluator runtime.")
        shutil.copy2(uv, python.parent / Path(uv).name)
        clean_environment = reference.clean_environment
        reference.clean_environment = lambda: {**clean_environment(), "UV_PROJECT_ENVIRONMENT": str(venv),
                                               "UV_PYTHON": str(python), "VIRTUAL_ENV": str(venv)}
        try:
            return local_test(reference, application, root, config)
        finally:
            reference.clean_environment = clean_environment

    assessor.local_test = run
    try:
        yield
    finally:
        assessor.local_test = local_test


def cleanup(root, expected_agent):
    deployed = root / "deployed-agent.json"
    if not deployed.is_file():
        return
    agent = read_json(deployed)
    version = str(agent.get("version", ""))
    deployment = read_json(root / "deploy.json")
    prior = root / "agent-before-deploy.stdout.txt"
    previous = read_json(prior) if prior.is_file() and prior.stat().st_size else {}
    if (not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", expected_agent or "")
            or agent.get("name") != expected_agent or not re.fullmatch(r"[0-9]+", version)
            or deployment.get("exit_code") != 0
            or str(previous.get("version")) == version):
        raise ValueError("Refusing to delete an unproven deployment version.")
    command(["azd", "ai", "agent", "delete", expected_agent, "--version", version, "--force", "--no-prompt",
             "--cwd", str(root / "workspace")], root.parent / "deployment-cleanup")


def main():
    parser = argparse.ArgumentParser(description="Setup and run the pinned seven-case Foundry assessor.")
    parser.add_argument("stage", choices=["run", "prepare"])
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--allow-live", action="store_true")
    args = parser.parse_args()
    if not args.allow_live:
        parser.error("The evaluator must explicitly authorize test-project access.")
    archive = Path(os.environ["FOUNDRY_MIGRATION_ASSESSOR_DIR"]).resolve(strict=True)
    phase = archive / "phase331"
    assessor = load("fixed_seven_assessor", phase / "evaluate.py")
    source = args.source.resolve(strict=True)
    root = args.root.resolve()
    if source.is_relative_to(root.parent) or root.parent.is_relative_to(source):
        parser.error("The evaluator's run directory must be separate from the artifact.")
    setup = root.parent / "setup"
    _, definition, _, _ = assessor.layout(source)
    config, expected_agent = prepare(assessor, args.config, setup, definition)
    if args.stage == "prepare":
        print("Evaluator test-project setup passed.")
        return 0
    load("fixed_entry_adapter", phase / "entry_adapter.py").install(assessor)
    load("fixed_entry_worker", phase / "entry_worker.py").install(assessor, setup)
    observer = load("fixed_state_source_observer", archive / "phase34" / "control.py")
    stopped = threading.Event()
    audit = threading.Thread(target=observe_state, args=(assessor, observer, source, root, config, stopped), daemon=True)
    audit.start()
    try:
        with bind_local_uv(assessor):
            results = assessor.run(root, source=source, operator_config=config, allow_live=True)
    finally:
        stopped.set()
        audit.join(timeout=3)
        cleanup(root, expected_agent)
    return 0 if all(result["verdict"] == "pass" for result in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
