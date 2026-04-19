#!/usr/bin/env python3
"""
Read YAML frontmatter from a .local.md settings file and write it as JSON.

Usage:
    python materialize-settings.py <settings_md_path> <output_json_path>

The `start` skill calls this once after creating/updating
`.claude/ml-research-mode.local.md`. All other skills read the JSON output
with `jq` instead of hand-parsing YAML.

PyYAML is required (standard in ML environments). If missing, prints a clear
error to stderr and exits non-zero so the caller can fail the loop cleanly.
"""
import json
import sys
from pathlib import Path


def extract_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        raise ValueError("No YAML frontmatter (file must start with ---)")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ValueError("Unterminated YAML frontmatter (missing closing ---)")
    return parts[1]


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: materialize-settings.py <settings_md> <output_json>", file=sys.stderr)
        return 2

    src = Path(argv[1])
    dst = Path(argv[2])

    if not src.exists():
        print(f"settings file not found: {src}", file=sys.stderr)
        return 1

    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        print(
            "PyYAML is required. Install with: pip install pyyaml",
            file=sys.stderr,
        )
        return 1

    text = src.read_text(encoding="utf-8")
    try:
        frontmatter = extract_frontmatter(text)
    except ValueError as e:
        print(f"parse error: {e}", file=sys.stderr)
        return 1

    data = yaml.safe_load(frontmatter) or {}

    required = ["project_id", "primary_metric", "direction"]
    missing = [k for k in required if not data.get(k) or data[k] == "REPLACE_ME"]
    if missing:
        print(f"settings missing required keys: {', '.join(missing)}", file=sys.stderr)
        return 1

    data.setdefault("epoch_time_seconds", 180)
    data.setdefault("max_wall_time_minutes", 60)
    data.setdefault("worker_id", None)
    data.setdefault("plateau_threshold", 5)
    data.setdefault("allowed_edit_globs", ["**/*"])
    data.setdefault(
        "forbidden_edit_globs",
        [".git/**", ".ml-research/**", "node_modules/**", "**/__pycache__/**"],
    )

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(str(dst))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
