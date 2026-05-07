#!/usr/bin/env python3
"""Generate allowed-skill-names.json and allowed-plugin-file-references.json
for the Azure MCP server allowlists.

Usage:
    python3 generate-mcp-allowlists.py <skills_dir>

Outputs two JSON files in the current working directory:
    allowed-skill-names.json
    allowed-plugin-file-references.json
"""

import json
import os
import sys


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <skills_dir>", file=sys.stderr)
        sys.exit(1)

    skills_dir = sys.argv[1]

    if not os.path.isdir(skills_dir):
        print(f"ERROR: skills directory not found: {skills_dir}", file=sys.stderr)
        sys.exit(1)

    # Get sorted list of skill directory names (exclude hidden directories)
    skill_names = sorted([
        d for d in os.listdir(skills_dir)
        if os.path.isdir(os.path.join(skills_dir, d)) and not d.startswith(".")
    ])

    if not skill_names:
        print(f"ERROR: No skills found in {skills_dir} - aborting to prevent empty sync", file=sys.stderr)
        sys.exit(1)

    # Get sorted list of reference file paths (Windows-style backslash separators).
    # Exclude SKILL.md, version.json, and license files.
    excluded_filenames = {"SKILL.md", "version.json", "LICENSE", "LICENSE.txt", "LICENSE.md"}
    reference_files = []
    for skill in skill_names:
        skill_path = os.path.join(skills_dir, skill)
        for root, dirs, files in os.walk(skill_path, followlinks=False):
            dirs.sort()
            for filename in sorted(files):
                if filename in excluded_filenames:
                    continue
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, skills_dir)
                # Convert to Windows-style backslash separators to match existing file format
                rel_path = rel_path.replace("/", "\\")
                reference_files.append(rel_path)

    # Sort globally to guarantee stable lexicographic ordering
    reference_files.sort()

    # Write allowed-skill-names.json
    with open("allowed-skill-names.json", "w") as f:
        json.dump(skill_names, f, indent=2)
        f.write("\n")

    # Write allowed-plugin-file-references.json
    with open("allowed-plugin-file-references.json", "w") as f:
        json.dump(reference_files, f, indent=2)
        f.write("\n")

    print(f"Generated {len(skill_names)} skill names and {len(reference_files)} reference file paths.")


if __name__ == "__main__":
    main()
