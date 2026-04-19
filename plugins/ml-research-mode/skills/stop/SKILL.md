---
name: stop
description: This skill should be used when the user asks to "stop experiments", "halt research", "cancel iterations", "end ml-research", "kill the loop", or invokes /ml-research-mode:stop. Creates the STOP file, cancels any in-flight mlbench jobs, appends a final note to experiments.md, and prints a summary of the completed run. Deterministic cleanup — prefer this over ad-hoc chat instructions.
argument-hint: ""
allowed-tools: Bash, Read, Write, Edit
---

# /ml-research-mode:stop

Halt the autonomous research loop cleanly.

## Procedure

### Step 1 — Create the STOP marker

```bash
touch .ml-research/STOP
```

This is the soft kill signal. If `iterate` is currently running, it'll notice at its next STOP check and exit cleanly.

### Step 2 — Cancel any in-flight job

```bash
if [ -f .ml-research/current_job.json ]; then
  JOB_ID=$(jq -r '.job_id' .ml-research/current_job.json)
  CLI=$(jq -r '.cmd' .ml-research/cli.json)
  $CLI jobs cancel "$JOB_ID" || true
  rm -f .ml-research/current_job.json
fi
```

Swallow cancel errors — the job may already be done.

### Step 3 — Stop any running /loop

There's no programmatic hook to stop a parent `/loop`. Print this to the user explicitly:

> Research mode stopped. If you ran this under `/loop`, send any message (like "done") in chat to exit the loop. Otherwise the loop will attempt one more iterate, see the STOP file, and exit on its own.

### Step 4 — Final note in experiments.md

Append:

```markdown
## stopped — <ISO-8601 timestamp>
- Reason: user-requested stop
- Final iteration: iter-NNN
- Best <metric>: <value> (iter-MMM)
```

Compute values from `.ml-research/ITERATION` and the `## Target` block.

### Step 5 — Clean up STOP file

After `iterate` has had a chance to observe the STOP (or immediately, if no iterate is running — check by looking for recent mtime on `.ml-research/current_job.json`):

```bash
rm -f .ml-research/STOP
```

The `stop` skill owns STOP file lifecycle — create, wait for iterate to observe, delete. If unsure whether iterate saw it, leave STOP in place; the next iterate invocation will exit cleanly and a future `start` will warn.

### Step 6 — Summary

Print to the user:

- How many iterations ran.
- Best metric achieved and which iteration produced it.
- Branch name (`ml-research`) so they can `git log`, `git diff parent_branch..ml-research`, cherry-pick, or discard.
- Path to `experiments.md` for the narrative.
- Reminder: the `ml-research` branch is local-only and not pushed.

## Tips

- Do not switch branches or revert commits. The user decides whether to merge, cherry-pick, or throw away the research branch.
- If `.ml-research/` does not exist, there's nothing to stop. Print a friendly "no active research session" and exit 0.
