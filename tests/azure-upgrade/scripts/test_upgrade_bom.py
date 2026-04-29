"""Tests for upgrade_bom._inject_gradle_rewrite_plugin and _remove_gradle_rewrite_plugin.

Run with: python3 -m pytest tests/azure-upgrade/scripts/test_upgrade_bom.py -v
(from the repository root).
"""

from __future__ import annotations

import os
import re
import sys
import textwrap

import pytest

# The script under test lives in the skill's reference scripts directory.
# Add it to sys.path so we can import it directly without packaging.
_SCRIPT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "plugin",
        "skills",
        "azure-upgrade",
        "references",
        "languages",
        "java",
        "scripts",
    )
)
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from upgrade_bom import (  # noqa: E402  (import after sys.path manipulation)
    GRADLE_PLUGIN_MARKER,
    _get_latest_bom_version,
    _inject_gradle_rewrite_plugin,
    _remove_gradle_rewrite_plugin,
    main,
)


def _write(tmp_path, name: str, content: str) -> str:
    path = os.path.join(tmp_path, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


# ---------------------------------------------------------------------------
# Round-trip tests: inject + remove must restore original content
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "filename,original",
    [
        (
            "build.gradle",
            textwrap.dedent("""\
                plugins {
                    id 'java'
                }

                dependencies {
                    implementation 'com.azure:azure-core:1.55.0'
                }
            """),
        ),
        (
            "build.gradle.kts",
            textwrap.dedent("""\
                plugins {
                    id("java")
                }

                dependencies {
                    implementation("com.azure:azure-core:1.55.0")
                }
            """),
        ),
    ],
)
def test_inject_and_remove_restores_original(tmp_path, filename, original):
    build_file = _write(str(tmp_path), filename, original)

    injected = _inject_gradle_rewrite_plugin(build_file)
    assert injected is True

    with open(build_file, "r", encoding="utf-8") as f:
        modified = f.read()
    assert "org.openrewrite.rewrite" in modified
    assert modified.count(GRADLE_PLUGIN_MARKER) == 2
    assert "rewrite {" in modified
    assert "repositories {" in modified

    _remove_gradle_rewrite_plugin(build_file)

    with open(build_file, "r", encoding="utf-8") as f:
        cleaned = f.read()

    assert GRADLE_PLUGIN_MARKER not in cleaned
    assert "org.openrewrite.rewrite" not in cleaned
    # The injected rewrite/repositories blocks must be gone.
    assert "activeRecipe(\"com.azure.UpgradeBom\")" not in cleaned
    assert cleaned == original


def test_inject_skips_when_plugin_already_present(tmp_path):
    original = textwrap.dedent("""\
        plugins {
            id 'java'
            id 'org.openrewrite.rewrite' version '6.0.0'
        }
    """)
    build_file = _write(str(tmp_path), "build.gradle", original)

    injected = _inject_gradle_rewrite_plugin(build_file)
    assert injected is False

    with open(build_file, "r", encoding="utf-8") as f:
        assert f.read() == original


def test_inject_without_plugins_block_then_remove(tmp_path):
    original = textwrap.dedent("""\
        apply plugin: 'java'

        dependencies {
            implementation 'com.azure:azure-core:1.55.0'
        }
    """)
    build_file = _write(str(tmp_path), "build.gradle", original)

    injected = _inject_gradle_rewrite_plugin(build_file)
    assert injected is True

    with open(build_file, "r", encoding="utf-8") as f:
        modified = f.read()
    assert modified.startswith("plugins {")
    assert "org.openrewrite.rewrite" in modified

    _remove_gradle_rewrite_plugin(build_file)

    with open(build_file, "r", encoding="utf-8") as f:
        cleaned = f.read()

    assert GRADLE_PLUGIN_MARKER not in cleaned
    assert "org.openrewrite.rewrite" not in cleaned
    assert "activeRecipe(\"com.azure.UpgradeBom\")" not in cleaned
    # Original body is preserved (the synthetic plugins {} wrapper remains,
    # which is acceptable — we only assert the original lines survive).
    for line in original.splitlines():
        assert line in cleaned


def test_get_latest_bom_version_returns_version():
    version = _get_latest_bom_version()

    assert version
    assert re.fullmatch(r"\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*", version)


def test_main_get_latest_version_prints_value(capsys):
    result = main(["--get-latest-version"])
    captured = capsys.readouterr()

    assert result == 0
    assert captured.out.strip()
    assert re.fullmatch(r"\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*", captured.out.strip())
