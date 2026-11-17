"""Materialize skill-local copies of the coordinator's shared guidance."""

import argparse
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
SKILLS = ROOT / "plugins" / "azure-observability" / "skills"
SOURCE = SKILLS / "troubleshoot-observability" / "references"
SEEDS = {
    "connect-observability": (
        "next-actions.md", "specialists.md", "trace-capabilities.md",
    ),
    "verify-observability-fix": ("next-actions.md",),
}
LINK = re.compile(r"(\[[^\]]*\]\()([^)]+)(\))")


def local_target(path, target):
    parsed = urlsplit(target.split(' "')[0])
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    return (path.parent / unquote(parsed.path)).resolve()


def shared_files(seeds):
    pending = [SOURCE / name for name in seeds]
    selected = set()
    while pending:
        path = pending.pop()
        if path in selected:
            continue
        if (not path.is_relative_to(SOURCE) or path.is_symlink()
                or not path.resolve().is_relative_to(SOURCE) or not path.is_file()):
            raise ValueError(f"Invalid shared source: {path}")
        selected.add(path)
        if path.suffix == ".md":
            for match in LINK.finditer(path.read_text("utf-8")):
                target = local_target(path, match[2])
                if target is not None:
                    pending.append(target)
    if any(path.is_relative_to(SOURCE / "investigation") for path in selected):
        for path in (SOURCE / "investigation").rglob("*"):
            if path.is_symlink():
                raise ValueError(f"Invalid shared source: {path}")
            if path.is_file():
                selected.add(path)
    for path in selected:
        if path.is_symlink() or not path.resolve().is_relative_to(SOURCE):
            raise ValueError(f"Invalid shared source: {path}")
    return selected


def rebased_text(path, destination, selected):
    def replace(match):
        target = local_target(path, match[2])
        if target is None or not target.is_relative_to(SOURCE):
            return match[0]
        if target not in selected:
            raise ValueError(f"Shared link has no materialized source: {target}")
        local = destination / target.relative_to(SOURCE)
        relative = os.path.relpath(local, path.parent).replace(os.sep, "/")
        original_path = urlsplit(match[2].split(' "')[0]).path
        return match[1] + relative + match[2][len(original_path):] + match[3]

    return LINK.sub(replace, path.read_text("utf-8"))


def materialize(write=False):
    problems = []
    for name, seeds in SEEDS.items():
        skill = SKILLS / name
        destination = skill / "references" / "shared"
        if destination.is_symlink():
            raise ValueError(f"Shared directory cannot be a symlink: {destination}")
        selected = shared_files(seeds)
        expected = {destination / path.relative_to(SOURCE): path
                    for path in selected}
        for target in expected:
            if not target.resolve().is_relative_to(skill):
                raise ValueError(f"Shared destination escapes skill: {target}")
            for ancestor in (target, *target.parents):
                if ancestor.is_symlink():
                    raise ValueError(
                        f"Shared destination ancestor cannot be a symlink: {ancestor}")
                if ancestor == skill:
                    break
        actual = {path for path in destination.rglob("*") if path.is_file()}
        extras = actual - expected.keys()
        if extras:
            raise ValueError("Unexpected shared files; review before removing: " +
                             ", ".join(str(path) for path in sorted(extras)))
        for target, source in expected.items():
            data = source.read_bytes()
            if not target.is_file() or target.read_bytes() != data:
                if write:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                else:
                    problems.append(str(target.relative_to(ROOT)))
        for path in skill.rglob("*.md"):
            if path.is_relative_to(destination):
                continue
            text = rebased_text(path, destination, selected)
            if text != path.read_text("utf-8"):
                if write:
                    path.write_text(text, encoding="utf-8", newline="\n")
                else:
                    problems.append(str(path.relative_to(ROOT)))
        print(f"{name}: {len(selected)} derived shared resources")
    if problems:
        raise ValueError("Shared materialization is stale: " + ", ".join(problems))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true",
                        help="copy reviewed guidance and rebase local links")
    materialize(parser.parse_args().write)
