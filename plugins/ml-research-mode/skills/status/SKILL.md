---
name: status
description: This skill should be used when the user asks to "show research status", "how is the loop doing", "what iteration are we on", "check ml-research progress", or invokes /ml-research-mode:status. Read-only. Prints a compact summary of the current research session — iteration count, best metric, in-flight job, last 5 iterations, ETA — without touching any state.
argument-hint: ""
allowed-tools: Bash, Read
---

# /ml-research-mode:status

Read-only snapshot of the current ml-research session. Makes no edits, no commits, no CLI calls that change state.

## Procedure

### Step 1 — Check for session

If `.ml-research/` does not exist in the current directory (or the nearest ancestor), print "no active research session in this project" and exit 0. Do not treat this as an error.

### Step 2 — Gather state

```bash
ITER=$(cat .ml-research/ITERATION 2>/dev/null || echo "0")
PROJECT=$(jq -r '.project_id' .ml-research/settings.json)
METRIC=$(jq -r '.primary_metric' .ml-research/settings.json)
DIRECTION=$(jq -r '.direction' .ml-research/settings.json)
WORKER=$(jq -r '.worker_id' .ml-research/settings.json)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
PARENT=$(cat .ml-research/parent_branch 2>/dev/null || echo "unknown")
STOP=$([ -f .ml-research/STOP ] && echo "present" || echo "absent")
```

(Settings come from `.ml-research/settings.json` which the `start` skill materializes from the YAML frontmatter. Status never parses the `.local.md` file directly.)

### Step 3 — In-flight job

If `.ml-research/current_job.json` exists:

```bash
CLI=$(jq -r '.cmd' .ml-research/cli.json)
JOB_ID=$(jq -r '.job_id' .ml-research/current_job.json)
PHASE=$(jq -r '.phase' .ml-research/current_job.json)
EXPECTED=$(jq -r '.expected_finish_at' .ml-research/current_job.json)
LIVE_STATUS=$($CLI jobs status "$JOB_ID" --json 2>/dev/null | jq -r '.status' || echo "unreachable")
```

Show: job id, phase (train/eval), live status (`queued`/`running`/`completed`/...), expected finish, worker.

### Step 4 — Best so far

Parse the `## Target` block from `.ml-research/experiments.md`:

```bash
awk '/^## Target/{flag=1; next} /^## /{flag=0} flag' .ml-research/experiments.md
```

Extract `Best so far` line.

### Step 5 — Last N iterations

Show the last 5 iteration block headers with their verdict and metric:

```bash
grep -E '^## iter-' .ml-research/experiments.md | tail -n 5
```

### Step 6 — Print compact summary

Format as a single markdown block. Example:

```markdown
## ml-research status — <project-id>

**Session**: iter-NNN on branch `ml-research` (from `<parent>`)
**Target**: minimize val_loss — best 0.38 (iter-003)
**Worker**: RTX4070@Placebo
**STOP file**: absent

### In-flight
- Job abc123 (phase: train) — running — expected done 2026-04-19T15:30:00Z

### Last 5 iterations
- iter-007 ✓ val_loss=0.38 — lower lr to 1e-4
- iter-006 ≈ val_loss=0.42 — add weight decay
- iter-005 ✗ val_loss=0.51 — swap optimizer to SGD
- iter-004 ≈ val_loss=0.41 — increase batch size
- iter-003 ✓ val_loss=0.38 — cosine warmup
```

Keep the whole output under 40 lines. Do not dump raw JSON. Do not include the full experiments.md — direct the user there if they want detail.

## Tips

- Never call `mlbench jobs cancel`, `mlbench jobs submit`, or any mutating command here.
- If the CLI is unreachable, show the cached `expected_finish_at` from `current_job.json` and mark live status as `unreachable`. Don't block the status call on a dead backend.
