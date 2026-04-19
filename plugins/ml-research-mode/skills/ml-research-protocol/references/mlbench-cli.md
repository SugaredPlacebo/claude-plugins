# mlbench CLI — patterns for ml-research-mode

The `mlbench` CLI is the only interface to the workbench. Always invoke through bash; never call backend HTTP endpoints directly (the CLI is the supported contract; routes change).

## Resolving the binary

The plugin assumes one of:

1. `mlbench` is on `PATH` (preferred, when ml-bench is installed globally).
2. `node <ml-bench-repo>/cli/dist/index.js` (development setup).

The `start` skill discovers which is available and writes the choice to `.ml-research/cli.json`. Subsequent skills read that and call the CLI as `${cli_cmd}`.

```bash
# detect
if command -v mlbench >/dev/null 2>&1; then
  CLI="mlbench"
else
  # search common locations
  for repo in "$HOME/ml-bench" "../ml-bench" "../../ml-bench"; do
    if [ -f "$repo/cli/dist/index.js" ]; then
      CLI="node $repo/cli/dist/index.js"
      break
    fi
  done
fi
```

If nothing resolves, fail fast with a message asking the user to install or build ml-bench.

## Help-first

The exact flag/positional form of every `mlbench` subcommand varies between versions. **Always run `--help` before composing a call**, and prefer parsing the help output to discover required vs optional flags rather than relying on what other ml-research-mode files show. The CLI also ships with `cli/README.md` in the ml-bench repo describing the current command surface.

```bash
$CLI --help
$CLI jobs --help
$CLI jobs submit --help
```

If a snippet in this file or in `iterate`/`start`/`status` skills shows `--project <id>` and the installed CLI uses positional `<project_id>` (or vice versa), trust `--help` over the snippet and adapt — then leave a one-line note in `experiments.md` so the user can update the skill files later.

## JSON-only

Always pass `--json` when fetching anything that will be parsed. Pipe to `jq` or read with Node. Never regex human-formatted output.

```bash
$CLI jobs status "$JOB_ID" --json | jq -r '.status'
$CLI runs artifacts "$RUN_ID" --json > .ml-research/logs/iter-007.eval.json
```

## Submitting jobs

`mlbench jobs submit` schema (verify with `--help` for the exact form on the installed version):

```bash
$CLI jobs submit \
  --project <project_id> \
  --tool <tool_name> \
  --worker <worker_id> \
  --json \
  -- \
  <tool-specific args ...>
```

The `--` separator delimits CLI args from tool args. Tool args are passed through to the project's tool entrypoint as defined in `gpu-tool.json`.

The successful response includes a `job_id`. Capture it:

```bash
JOB_RESP=$($CLI jobs submit ... --json)
JOB_ID=$(echo "$JOB_RESP" | jq -r '.job_id')
RUN_ID=$(echo "$JOB_RESP" | jq -r '.run_id')   # may be present immediately, may be added on completion
```

## Polling status

```bash
STATUS=$($CLI jobs status "$JOB_ID" --json | jq -r '.status')
# values seen: queued, running, completed, failed, cancelled
```

For ScheduleWakeup pacing, also fetch `started_at` and `progress` (epoch number, if the project's training tool reports it via the standard ml-bench progress contract):

```bash
$CLI jobs status "$JOB_ID" --json | jq '{status, started_at, progress}'
```

## Cancelling

```bash
$CLI jobs cancel "$JOB_ID"
```

Used by the `stop` skill and the `[E]` failure path.

## Eval artifacts

After a successful eval job, fetch the artifact JSON. Per ml-bench's project contract (`docs/project-contract.md`), eval runs emit `eval.json` with project-defined metric fields.

```bash
RUN_ID=$($CLI jobs status "$EVAL_JOB_ID" --json | jq -r '.run_id')
$CLI runs artifacts "$RUN_ID" --json > .ml-research/logs/iter-007.eval.json
```

Then extract the configured `primary_metric`:

```bash
METRIC=$(jq -r --arg k "$PRIMARY_METRIC" '.summary[$k] // .[$k]' .ml-research/logs/iter-007.eval.json)
```

Adapt the `jq` query to where the metric actually lives in the project's eval output. The protocol allows the analyst to also modify the project's eval tool if the schema is awkward — log the change as part of the iteration.

## Workers

```bash
$CLI workers list --json
```

If `worker_id` is null in settings, pin the loop to the first reported worker on first iteration and write it back to settings (so later iterations stay on the same GPU and benchmarks compare cleanly).

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `connection refused :3000` | backend not running | tell user to start `cd backend && npm run dev`; do not retry blindly |
| `worker not found` | worker id changed in `backend/.env` | re-detect via `$CLI workers list --json`, update settings |
| `tool not found` | project's `gpu-tool.json` missing or unregistered | run `$CLI projects refresh <project_id>`, retry once |
| `job stuck in queued` | another long job ahead | this is normal; ScheduleWakeup and re-poll, do not cancel |
| `eval artifact missing primary_metric` | project's eval emits a different schema | check `eval.json`, update settings `primary_metric` or modify the project's eval tool |

## Logs

Stream logs to a file per iteration for the user to inspect later:

```bash
$CLI jobs logs "$JOB_ID" --follow > ".ml-research/logs/iter-${ITER}.train.log" 2>&1 &
```

Background it; the loop should not depend on log content for control flow (status JSON is the source of truth).
