---
name: iterate
description: This skill should be used when the user asks to "run next iteration", "continue research", "keep experimenting", or invokes /ml-research-mode:iterate, and also when ScheduleWakeup resumes the loop. Runs exactly one step of the ml-research cycle — resume an in-flight job, submit a new experiment, or record an eval result — then returns. Designed to be invoked under /loop for full autonomy; each invocation is a single, self-contained tick of the research loop.
argument-hint: ""
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# /ml-research-mode:iterate

One tick of the research loop. Follow the iteration cycle in the `ml-research-protocol` skill exactly — this skill is the entry point, the protocol is the methodology.

## When this runs

- Manually by the user.
- Under `/loop /ml-research-mode:iterate` for autonomy.
- Auto-resumed by `ScheduleWakeup` firing with this skill as the wake prompt.

## Procedure

### Step 0 — Honor STOP

Before anything else:

```bash
if [ -f .ml-research/STOP ]; then
  # If a job is in flight, cancel it and clean up.
  # Append a final note to experiments.md.
  # Delete current_job.json.
  # Do NOT delete the STOP file — the stop skill owns that.
  echo "STOP file present; exiting iterate cleanly."
  exit 0
fi
```

### Step 1 — Load state

All settings come from `.ml-research/settings.json` (materialized from the YAML frontmatter by `scripts/materialize-settings.py` in the `start` skill). Read with `jq`:

```bash
ITER=$(cat .ml-research/ITERATION)
CLI=$(jq -r '.cmd' .ml-research/cli.json)
PROJECT=$(jq -r '.project_id' .ml-research/settings.json)
METRIC=$(jq -r '.primary_metric' .ml-research/settings.json)
DIRECTION=$(jq -r '.direction' .ml-research/settings.json)
WORKER=$(jq -r '.worker_id' .ml-research/settings.json)
PLATEAU=$(jq -r '.plateau_threshold' .ml-research/settings.json)
EPOCH_T=$(jq -r '.epoch_time_seconds' .ml-research/settings.json)
# Arrays:
FORBIDDEN=$(jq -r '.forbidden_edit_globs[]' .ml-research/settings.json)
```

If `settings.json` is missing, refuse to proceed and tell the user to run `/ml-research-mode:start` (or re-materialize via the script) — never parse the YAML directly here.

### Step 2 — Resume or plan

Read `.ml-research/current_job.json`.

**Case A: file exists, job still running.**

```bash
STATUS=$($CLI jobs status "$JOB_ID" --json | jq -r '.status')
```

If `STATUS` is `queued` or `running`: compute remaining time from `expected_finish_at`, clamp to `[60, 3600]`, `ScheduleWakeup` with that delay and prompt `/ml-research-mode:iterate`, return.

If `STATUS` is `completed` and `phase` is `train`: submit eval job, rewrite `current_job.json` with `phase: eval` and new job_id, `ScheduleWakeup` for a short window (eval is fast), return.

If `STATUS` is `completed` and `phase` is `eval`: go to **Case C** (record).

If `STATUS` is `failed` or `cancelled`: go to **Case D** (failure).

**Case B: file does not exist.** Start a new iteration.

1. `NEW_ITER=$((ITER + 1))`. Write to `.ml-research/ITERATION`.
2. Check plateau: scan the last `PLATEAU` iteration blocks in `experiments.md`; if none are `✓`, escalate. See protocol skill's Plateau escalation section.
3. Dispatch the `experiment-analyst` agent. Give it:
   - Full `experiments.md` content.
   - `.claude/ml-research-mode.local.md` content.
   - Absolute path of the project root.
   - Plateau signal and escalation level, if any.
   The analyst applies edits directly to project files and returns a JSON block: `{"hypothesis": "...", "headline": "...", "files_touched": [...], "predicted_delta": "..."}`. Capture this.
4. `git add -A && git commit -m "ml-research: iter-NNN — <headline>"` with the full hypothesis in the commit body. Allow-empty if the analyst made no edits (rare — usually means the analyst is hitting a dead-end and is about to escalate).
5. Submit training:
   ```bash
   TRAIN_JOB=$($CLI jobs submit --project "$PROJECT" --tool <train_tool> --worker "$WORKER" --json -- <tool_args> | jq -r '.job_id')
   ```
   `<train_tool>` is the project's declared training tool (discover via `$CLI tools list --project "$PROJECT" --json` and pick the one with `kind: training` — or read from settings if pinned).
6. Estimate duration: read epoch count from the tool args the analyst produced, multiply by `EPOCH_T`, cap at `max_wall_time_minutes`. Compute `expected_finish_at`.
7. Write `.ml-research/current_job.json`.
8. `ScheduleWakeup` for `min(remaining, 3600)` with prompt `/ml-research-mode:iterate`.
9. Return.

**Case C: eval done, record.**

1. Fetch artifact:
   ```bash
   RUN_ID=$($CLI jobs status "$JOB_ID" --json | jq -r '.run_id')
   $CLI runs artifacts "$RUN_ID" --json > ".ml-research/logs/iter-${NEW_ITER}.eval.json"
   METRIC_VALUE=$(jq -r --arg k "$METRIC" '(.summary[$k] // .[$k]) // "__MISSING__"' ".ml-research/logs/iter-${NEW_ITER}.eval.json")
   ```
   If `METRIC_VALUE` is `__MISSING__` or `null`, treat as a `⚠ failed` iteration with a specific note: "primary metric `$METRIC` not found in eval artifact; check the project's eval tool output schema or update `primary_metric` in settings." Do not coerce to a number.
2. Compare to best-so-far (parse from `experiments.md` `## Target` block).
3. Determine verdict per protocol (`✓`/`✗`/`≈`/`⚠`).
4. Append iteration block to `experiments.md` using the schema in the protocol skill.
5. If improvement: update `## Target` best-so-far in place.
6. `git add .ml-research/ experiments.md && git commit --amend --no-edit` — amend only the *result* onto the iteration's existing commit, so one commit = one iteration with its eval results attached. (This is the single exception to the never-amend rule, because the initial commit was pre-training.)
7. Delete `.ml-research/current_job.json`.
8. Return. The next tick starts a fresh iteration.

**Case D: failure.**

1. Fetch error output from `$CLI jobs logs "$JOB_ID"` and append a failure block to `experiments.md` (verdict `⚠`).
2. Commit `--allow-empty --amend --no-edit` so the iteration is recorded.
3. Delete `current_job.json`.
4. Check consecutive failure count: if ≥3, `touch .ml-research/STOP` and append a "halted after 3 consecutive failures" note.
5. Return.

## Interaction with /loop

`/loop` re-invokes this skill on its own cadence (or this skill self-paces via `ScheduleWakeup`). Each invocation is atomic: it does one of {resume-poll, submit-train, submit-eval, record, record-failure}, then returns. Never try to "complete the iteration" inside one invocation — the whole point of the single-tick design is that `/loop` and `ScheduleWakeup` can compose freely.

## Tips

- **Never swallow errors from `$CLI`.** If a CLI call fails unexpectedly (connection refused, unknown flag), append the error text to `experiments.md` under the current iteration and return. Do not retry silently in a tight loop.
- **Do not push.** The `ml-research` branch stays local until the user decides what to keep.
- **If `current_job.json` references a job the backend doesn't know about** (e.g., backend restarted, state lost), treat it as failure: log, delete the file, move on.
