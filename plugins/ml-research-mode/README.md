# ml-research-mode

Autonomous ML research loop for Claude Code. Drives any project registered with the [ml-bench](https://github.com/Sugared_Placebo/ml-bench) workbench: train → eval → analyze → modify code → commit → repeat. Runs indefinitely until stopped.

## What it does

Once started, Claude:

1. Reads the project's `experiments.md` to recall what has been tried.
2. Forms a hypothesis for the next experiment (analyst agent).
3. Edits model/training code as needed.
4. Submits a training run via the `mlbench` CLI.
5. Sleeps until training is expected to finish (`ScheduleWakeup`).
6. Submits eval, parses metrics.
7. Appends the iteration to `experiments.md` and commits to a `ml-research` branch.
8. Loops back to step 1.

Claude does not ask questions during the loop. It commits each iteration so anything can be reverted.

## Prerequisites

- An ml-bench backend reachable via the `mlbench` CLI (`mlbench --help` should work).
- A project registered with ml-bench (Settings → Projects, or `mlbench projects add ...`).
- Project exposes a training tool and an eval tool through `gpu-tool.json` (per `docs/project-contract.md` in ml-bench).
- The active project's git working tree is clean before starting — the loop creates and stays on a `ml-research` branch.

## Install

From inside a Claude Code session:

```
/plugin marketplace add /path/to/ml-research-mode
/plugin install ml-research-mode@ml-research-mode
```

Then `/reload-plugins`. Verify with `/plugin` — `ml-research-mode` should be listed.

For development, point the marketplace command at the plugin's parent directory containing this folder.

### Project requirements

In the project where research mode runs:

- Python 3 with `PyYAML` installed (`pip install pyyaml`) — used by `scripts/materialize-settings.py`.
- `jq` on PATH — used by every skill for JSON parsing.
- `git` with a clean working tree before `/ml-research-mode:start`.

## Usage

| Command | What it does |
|---------|---|
| `/ml-research-mode:start` | Initialize `.ml-research/`, create `experiments.md` if missing, run baseline iteration. |
| `/ml-research-mode:iterate` | Run one full iteration. Resume-aware. Designed to be invoked under `/loop` for full autonomy. |
| `/ml-research-mode:status` | Show iteration count, active jobs, last N experiments, current best metric. |
| `/ml-research-mode:stop` | Create `STOP` file, cancel running mlbench jobs. |

For unattended operation, run `/loop /ml-research-mode:iterate` once. The iterate skill uses `ScheduleWakeup` to sleep through training time.

## Configuration

Per-project settings live at `.claude/ml-research-mode.local.md` (gitignored). Created from `templates/ml-research.local.md` on first `start`. Required fields: `primary_metric`, `direction`. See template for full schema.

## Stopping

Two ways:

- Say "stop experiments" in chat (Claude will run `/ml-research-mode:stop`).
- `/ml-research-mode:stop` directly. Creates `.ml-research/STOP`; the next `iterate` invocation exits cleanly.

To kill a running training job mid-flight, the stop skill calls `mlbench jobs cancel`.

## State files

All state lives in `.ml-research/` inside the active project:

```
.ml-research/
├── experiments.md       # human + Claude readable history
├── current_job.json     # in-flight job pointer (deleted on completion)
├── STOP                 # presence = exit on next iteration
└── logs/iter-NN.log     # full mlbench output per iteration
```

## Components

- `skills/ml-research-protocol/` — the methodology Claude follows. Auto-loads when research-mode topics come up.
- `skills/start/`, `iterate/`, `stop/`, `status/` — user-invoked slash commands.
- `agents/experiment-analyst.md` — subagent that reads history + latest eval, applies code edits, returns next hypothesis.
- `templates/` — skeletons copied into the project on first run.

## License

MIT
