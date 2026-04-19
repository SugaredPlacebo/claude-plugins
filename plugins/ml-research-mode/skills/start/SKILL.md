---
name: start
description: This skill should be used when the user asks to "start research mode", "begin autonomous training", "kick off ML experiments", "launch ml-research", or invokes /ml-research-mode:start. Initializes .ml-research/ state, creates experiments.md and settings file from templates if missing, runs the baseline iteration (iter-000), and prepares the loop for /ml-research-mode:iterate.
argument-hint: "[project_id]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# /ml-research-mode:start

Initialize the autonomous ML research loop in the current project. Run once before any `iterate`.

## What this skill does

1. Resolves the active project (CLI arg, or `mlbench projects list --json` default).
2. Verifies preconditions: clean git tree, `mlbench` CLI works, project has a train + eval tool.
3. Creates `.ml-research/` state directory.
4. Copies `templates/ml-research.local.md` → `.claude/ml-research-mode.local.md` if missing. **If the file is missing, prompt the user once for `primary_metric` and `direction` before proceeding** — these have no safe defaults.
5. Copies `templates/experiments.md` → `.ml-research/experiments.md` if missing, substituting project_id/metric/direction.
6. Creates the `ml-research` git branch (or switches to it if it already exists).
7. Detects the `mlbench` CLI invocation and writes it to `.ml-research/cli.json`.
8. Initializes `.ml-research/ITERATION` to `0`.
9. Runs iter-000 (the baseline) by handing off to the iteration cycle in the protocol skill — but with `Hypothesis: baseline (no changes)` and zero edits.
10. Returns control. The user can then run `/ml-research-mode:iterate` (or `/loop /ml-research-mode:iterate`) to continue.

## Procedure

Follow the protocol skill (`ml-research-protocol`) for all schema details, file layout, and CLI patterns. This skill is the bootstrap; the protocol is the methodology.

### Step 1 — Preconditions

```bash
# 1. Are we in a git repo?
git rev-parse --show-toplevel || { echo "Not in a git repo"; exit 1; }

# 2. Is the working tree clean?
test -z "$(git status --porcelain)" || { echo "Commit or stash uncommitted changes first"; exit 1; }

# 3. Detect mlbench CLI (see references/mlbench-cli.md in the protocol skill).
# Write detected command to .ml-research/cli.json as {"cmd": "mlbench"} or {"cmd": "node /path/to/cli/dist/index.js"}.
# Then assign to a shell var for use below:
CLI=$(jq -r '.cmd' .ml-research/cli.json)

# 4. Resolve project_id. Use the argument if given. Otherwise:
$CLI projects list --json
# If exactly one project is registered, pick it. If multiple, ask the user which.
```

### Step 2 — Settings file

Path: `.claude/ml-research-mode.local.md` (relative to active project root, **not** ml-bench).

If absent, copy from the plugin's `templates/ml-research.local.md`. Replace `REPLACE_ME` with the resolved `project_id`. Then read the file: if `primary_metric` is still `val_loss` (the template default), prompt the user once via chat for the actual metric name and direction. Update the file and proceed.

This is the only chat prompt allowed in the entire loop. After this, autonomy is total.

After the settings file is finalized, materialize it to JSON so all other skills can read it with `jq` instead of parsing YAML:

```bash
python "${CLAUDE_PLUGIN_ROOT}/scripts/materialize-settings.py" \
  .claude/ml-research-mode.local.md \
  .ml-research/settings.json
```

Re-run this whenever the settings file is edited. If PyYAML isn't installed, the script exits non-zero with a clear message — surface that to the user and stop.

Add `.claude/ml-research-mode.local.md` to `.gitignore` if not already present.

### Step 3 — State directory

```bash
mkdir -p .ml-research/logs
echo "0" > .ml-research/ITERATION
```

If `.ml-research/current_job.json` exists, the previous run was interrupted. Show it to the user and ask: discard (delete and start fresh) or resume (defer to `/ml-research-mode:iterate`). Do not overwrite silently.

### Step 4 — experiments.md

If `.ml-research/experiments.md` is absent, copy from `templates/experiments.md`, substituting `REPLACE_PROJECT_ID`, `REPLACE_METRIC`, `REPLACE_DIRECTION`.

If present, leave it alone. The loop is resumable: appending to existing history is the correct behavior.

### Step 5 — Branch

```bash
git checkout -b ml-research 2>/dev/null || git checkout ml-research
```

Record the parent branch name in `.ml-research/parent_branch` so `stop` knows where the user came from.

### Step 6 — Worker pinning

Read `worker_id` from settings. If null:

```bash
WORKER=$($CLI workers list --json | jq -r '.[0].id')
```

Write the chosen worker back into settings so subsequent iterations stay on the same GPU.

### Step 7 — Baseline iteration

Submit a training run with **no code changes** as iter-000. This establishes the starting metric. Follow the `[B] → [C]` path in the protocol skill, but skip the analyst dispatch — hypothesis is hardcoded `"baseline (no changes)"` and the only file edit is writing the iteration block to `experiments.md` after eval completes.

Commit with message: `ml-research: iter-000 — baseline`.

After the train job is submitted and `current_job.json` is written, return. The user (or `/loop`) will invoke `/ml-research-mode:iterate` to drive the rest.

### Step 8 — Final report

Print to the user:

- Project, metric, direction, worker.
- Path to `experiments.md` and `.ml-research/`.
- The exact command to run for autonomy: `/loop /ml-research-mode:iterate`.
- The exact command to stop: `/ml-research-mode:stop` or just say "stop experiments".

## Tips

- If the user re-runs `start` on an already-initialized project, do not overwrite anything. Confirm state is consistent (settings exist, experiments.md exists, on `ml-research` branch) and exit cleanly with a status message. Direct them to `/ml-research-mode:iterate`.
- If the project's `gpu-tool.json` doesn't expose both `train` and `eval` tools, fail with a specific message — do not try to invent eval. Point the user at `docs/project-contract.md` in ml-bench.
