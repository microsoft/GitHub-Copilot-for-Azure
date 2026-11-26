import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile


CASE = "migration-deep-research-to-foundry"
ARCHIVE = "candidate.tar.gz"
GENERATED_DIRS = {".azure", ".git", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".venv", "__pycache__"}


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def generated(name):
    return name in GENERATED_DIRS or name.endswith(".egg-info")


def generation(trajectory_file, workspace, model):
    with trajectory_file.open(encoding="utf-8") as stream:
        records = [json.loads(line) for line in stream if line.strip()]
    trials = [record for record in records if record.get("type") == "trial-result"]
    if len(trials) != 1:
        raise ValueError("Expected exactly one Vally trial.")
    trial = trials[0]
    trajectory = trial.get("trajectory", {})
    metadata = trajectory.get("metadata", {})
    if (trial.get("evalName") != "microsoft-foundry-e2e-eval"
            or trial.get("stimulus") != "Migration - Deep Research to Foundry"
            or trial.get("status") != "success" or trajectory.get("endReason") != "completed"):
        raise ValueError("The Deep Research migration did not complete successfully.")
    if trial.get("model") != model or metadata.get("model") != model or metadata.get("executor") != "copilot-sdk":
        raise ValueError("The trial did not use the requested Copilot SDK model.")
    if not any(event.get("type") == "skill_activation" and event.get("data", {}).get("name") == "microsoft-foundry"
               for event in trajectory.get("events", [])):
        raise ValueError("The trial did not invoke the microsoft-foundry skill.")
    workspace = workspace.resolve(strict=True)
    source = Path(trajectory["workDir"])
    if (not source.is_absolute() or source.resolve(strict=True) != source
            or source == workspace or not source.is_relative_to(workspace)
            or source.is_junction() or not source.is_dir()):
        raise ValueError("The trial workspace is not an isolated project directory.")
    return source


def source_entries(root):
    for entry in sorted(root.iterdir()):
        if generated(entry.name):
            continue
        if entry.is_symlink() or entry.is_junction():
            raise ValueError("The candidate source must not contain links.")
        if entry.is_dir():
            yield entry
            yield from source_entries(entry)
        elif entry.is_file() and entry.stat().st_nlink == 1:
            if entry.name.startswith(".env") and entry.name not in {".env.example", ".env.sample", ".env.template"}:
                raise ValueError("Do not publish populated environment files.")
            yield entry
        else:
            raise ValueError("The candidate source must contain only directories and regular, unlinked files.")


def freeze(trajectory, workspace, output, revision, model):
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Use the full generation checkout commit SHA.")
    source = generation(trajectory, workspace, model)
    output = output.resolve()
    if output.is_relative_to(workspace.resolve()) or workspace.resolve().is_relative_to(output):
        raise ValueError("Keep the artifact output separate from the actor workspace.")
    entries = list(source_entries(source))
    if source / "azure.yaml" not in entries or not (source / "azure.yaml").is_file():
        raise ValueError("The generated project did not include azure.yaml.")
    output.mkdir(parents=True, exist_ok=False)
    archive_path = output / ARCHIVE
    with tarfile.open(archive_path, "x:gz") as archive:
        for entry in entries:
            archive.add(entry, arcname=entry.relative_to(source).as_posix(), recursive=False)
    manifest = {
        "case": CASE,
        "revision": revision,
        "model": model,
        "archive_sha256": sha256(archive_path),
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def restore(artifact, output, revision):
    manifest = json.loads((artifact / "manifest.json").read_text(encoding="utf-8"))
    archive_path = artifact / ARCHIVE
    if (manifest.get("case") != CASE or manifest.get("revision") != revision
            or manifest.get("archive_sha256") != sha256(archive_path)):
        raise ValueError("The candidate artifact does not match the requested generation run.")
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        paths = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (not (member.isfile() or member.isdir()) or path.is_absolute()
                    or not path.parts or ".." in path.parts or "\\" in member.name
                    or ":" in member.name or path in paths or any(generated(part) for part in path.parts)):
                raise ValueError("The candidate archive contains an unsafe entry.")
            paths.add(path)
        output.mkdir(parents=True, exist_ok=False)
        archive.extractall(output, members=members, filter="data")
    list(source_entries(output))
    if not (output / "azure.yaml").is_file():
        raise ValueError("The artifact did not contain azure.yaml.")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Freeze or restore a Deep Research migration candidate.")
    commands = parser.add_subparsers(dest="command", required=True)
    freeze_command = commands.add_parser("freeze")
    freeze_command.add_argument("--trajectory", required=True, type=Path)
    freeze_command.add_argument("--workspace", required=True, type=Path)
    freeze_command.add_argument("--model", default="gpt-5.6-sol")
    restore_command = commands.add_parser("restore")
    restore_command.add_argument("--artifact", required=True, type=Path)
    for command in (freeze_command, restore_command):
        command.add_argument("--output", required=True, type=Path)
        command.add_argument("--revision", required=True)
    args = parser.parse_args()
    try:
        if args.command == "freeze":
            manifest = freeze(args.trajectory, args.workspace, args.output, args.revision, args.model)
        else:
            manifest = restore(args.artifact, args.output, args.revision)
    except (OSError, ValueError, KeyError, tarfile.TarError) as error:
        parser.exit(1, f"Candidate handoff failed: {error}\n")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
