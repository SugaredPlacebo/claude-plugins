---
name: ml-research-protocol
description: This skill should be used whenever ml-research mode is active or about to be — when the user asks to "start research mode", "iterate on the model", "run autonomous training", "experiment with hyperparameters", or invokes any /ml-research-mode:* skill, and whenever Claude needs to read/write the experiments.md log, decide on the next ML experiment, interpret eval metrics, or follow research-mode safety rules. Defines the experimentation methodology: experiments.md schema, hypothesis-driven workflow, plateau escalation, mlbench CLI patterns, commit conventions, STOP file semantics.
version: 0.1.0
---

# ML Research Protocol

The methodology Claude follows when running the ml-research-mode autonomous loop. The user-invoked skills (`start`, `iterate`, `stop`, `status`) and the `experiment-analyst` agent rely on the rules defined here.

## Invariants

These are non-negotiable. Violating them breaks the loop or destroys user work.

1. **Never edit the ml-bench workbench repo.** Edits are scoped to the active project's working tree. If the active project path is unknown, fail loudly — do not guess.
2. **Always commit before leaving an iteration.** Every iteration ends with a `git commit` on the `ml-research` branch (created from the user's starting branch on first run). One commit = one iteration. The *only* amend allowed is re-amending the iteration's own result block into its commit body after eval finishes (see Commit conventions). Never amend anything else, never amend a prior iteration's commit, never amend across a push.
3. **Never block on the user.** If a decision is ambiguous, pick the safer/smaller option, log the rationale to `experiments.md`, and proceed. The user reviews after the fact via commits.
4. **Honor the STOP file.** Check `.ml-research/STOP` before every long action (job submission, sleep, edit). If present, exit cleanly: cancel running jobs, write a final note to `experiments.md`, return.
5. **Forbidden globs are forbidden.** Read `.claude/ml-research-mode.local.md` `forbidden_edit_globs`; refuse edits matching those paths even if the analyst proposes them.
6. **Run the eval the project provides.** Do not invent metrics by parsing logs — use the project's eval tool through `mlbench`. Adding a *new* metric means modifying the project's eval tool (allowed, with rationale logged), not screen-scraping.

## State layout

All loop state lives in `.ml-research/` at the active project root:

```
.ml-research/
├── experiments.md       # source of truth — never overwritten, only appended
├── current_job.json     # in-flight job pointer; absent = no job running
├── STOP                 # touch to stop the loop
├── ITERATION            # plain int, current iteration number
└── logs/iter-NNN.log    # raw mlbench output per iteration
```

`current_job.json` schema:

```json
{
  "iteration": 7,
  "phase": "train",
  "job_id": "abc123",
  "worker_id": "RTX4070@Placebo",
  "started_at": "2026-04-19T15:00:00Z",
  "expected_finish_at": "2026-04-19T15:30:00Z",
  "hypothesis": "lower lr stabilizes loss"
}
```

`phase` is one of `train`, `eval`. After train completes, the same file is rewritten with `phase: eval` and a new `job_id`. After eval, the file is deleted.

## The iteration cycle

One invocation of `iterate` runs at most one of these steps then returns. The next invocation (manual, or `/loop`) continues.

```
[A] Resume check
    .ml-research/STOP exists?           → exit 0, log "stopped by user"
    .ml-research/current_job.json exists?
        job still running?              → ScheduleWakeup (remaining time), return
        job done, phase=train?          → submit eval, update current_job, return
        job done, phase=eval?           → goto [D]
        job failed?                     → goto [E]
    no job in flight                    → goto [B]

[B] Plan next experiment
    Read .claude/ml-research-mode.local.md (settings + freeform notes).
    Read experiments.md (full history).
    Dispatch experiment-analyst agent with: history, settings, project root.
    Analyst writes file edits directly and returns: hypothesis, files touched, predicted delta.

[C] Submit training
    git add -A && git commit -m "ml-research: iter-NNN — <hypothesis headline>"
    job_id = mlbench jobs submit <project_id> <train_tool> [args]
    Write current_job.json with phase=train and expected_finish_at = now + epoch_time_seconds * epochs.
    ScheduleWakeup for that duration with prompt "/ml-research-mode:iterate".
    Return.

[D] Eval done — record + decide
    Fetch eval artifact: mlbench runs artifacts <run_id> --json
    Parse primary metric per settings.
    Append iteration block to experiments.md (see schema below).
    Update best-so-far if improved.
    Increment ITERATION.
    Delete current_job.json.
    Run plateau check (below). If escalation triggered, update notes for next iteration.
    Return. Next /loop tick begins iter NNN+1.

[E] Job failed
    Append failure block to experiments.md with mlbench error output.
    Increment ITERATION.
    Delete current_job.json.
    If three consecutive failures: create STOP file and write a "loop halted, manual intervention needed" note.
    Return.
```

## experiments.md schema

Append-only. Each iteration is one `## iter-NNN` block. Format:

```markdown
## iter-007 — lower lr to 1e-4 — d4f5a6b — 2026-04-19T15:30:00Z
- Hypothesis: loss plateaued at 0.42 with lr=1e-3; lower LR should let optimizer fine-tune past the plateau.
- Changes: configs/train.yaml (lr 1e-3 → 1e-4)
- Train job: job-abc123 on RTX4070@Placebo (28m 14s)
- Eval job: job-def456 (1m 02s)
- Metrics: val_loss=0.38 ↓ (from 0.42), accuracy=0.83 ↑ (from 0.81)
- Verdict: ✓ improvement (-9.5% val_loss)
- Next: try lr=3e-5 to confirm the trend, or layer in cosine warmup.
```

Verdict glyphs: `✓` improvement, `✗` regression, `≈` flat (within ±1% of best), `⚠` failed.

The `## Target` block at the top of `experiments.md` is updated in place when best-so-far changes — that's the only non-append edit allowed.

## mlbench CLI patterns

Always invoke as the active worker; if `worker_id` is null in settings, use whatever `mlbench workers list` reports as default.

The exact flag form (positional vs `--project ...` etc.) varies by `mlbench` version. **Always run `mlbench <subcommand> --help` first** to see the installed contract, and use the parsed help to construct calls. Treat the snippets below as conceptual, not literal.

Common operations:

```bash
mlbench projects list --json
mlbench tools list <project_id> --json             # find train/eval tool names
mlbench jobs submit <project_id> <tool_name> --json [-- tool args...]
mlbench jobs status <job_id> --json
mlbench jobs cancel <job_id>
mlbench runs list <project_id> --kind eval --json
mlbench runs artifacts <run_id> --json
```

Always use `--json` flags when available and parse with `jq`/Node — never regex shell output. See `references/mlbench-cli.md` for detailed parsing tips and resolving the binary across install layouts.

## Plateau escalation

After `plateau_threshold` consecutive iterations with no improvement on the primary metric (verdict `≈` or `✗`), escalate. The analyst is given the plateau signal and should pick from progressively riskier moves:

1. **Hyperparameters** — lr, batch size, optimizer, scheduler. Default exploration zone.
2. **Regularization & augmentation** — dropout, weight decay, label smoothing, mixup, data augmentation pipeline.
3. **Loss & objective** — auxiliary losses, weighting, focal loss for imbalanced data.
4. **Architecture** — depth, width, normalization, attention vs conv blocks.
5. **Data** — sampling strategy, curriculum, more/less data, cleaning.
6. **Add new metric** — if the primary metric is genuinely uninformative (saturated or noisy), modify the project's eval tool to expose a more discriminating metric, log the rationale, set `direction` if needed in settings.

Rule: never jump levels without trying the prior level at least twice. Log the escalation level chosen at the top of the iteration block (`Escalation: L3 (loss)`).

## Stop semantics

- `STOP` file: a soft kill. Loop notices at the top of every iteration and on every `ScheduleWakeup` resumption. Running jobs are cancelled, a final note appended to `experiments.md`, then return cleanly. The `STOP` file is then deleted by the `stop` skill once cleanup completes.
- User says "stop experiments" / "halt research" / "cancel iterations" in chat: invoke `/ml-research-mode:stop`. Do not hand-roll the cleanup.
- Hard kill (Ctrl-C in `/loop`): also fine. Next manual `iterate` will see `current_job.json` and resume correctly.

## Commit conventions

- Branch: `ml-research` (created off the user's starting branch on `start`). Never push automatically.
- One commit per iteration, immediately after the analyst's edits and before `mlbench jobs submit`. Message: `ml-research: iter-NNN — <hypothesis headline>` (≤72 chars in subject).
- Body of commit message includes the analyst's full hypothesis paragraph and the list of files changed. This is what `git log` will be reviewed by.
- Failed iterations also commit (with empty diff if no changes were applied) so the iteration number stays consistent with `experiments.md`. Use `git commit --allow-empty` when needed.
- **Eval result amend (the one allowed amend).** After eval finishes, append the iteration block to `experiments.md` and then `git add experiments.md && git commit --amend --no-edit`. This attaches the result to the iteration's own commit so one commit = one iteration with its metrics. Rules: only amend the commit just created by this iteration (HEAD); never amend a prior iteration; never amend after the branch has been pushed (research-mode does not push, so this is naturally safe).

## Common pitfalls

- **Off-by-one iteration numbers.** Always read `.ml-research/ITERATION` as ground truth. Don't infer from `experiments.md` headers.
- **Stale `current_job.json` on a fresh start.** The `start` skill checks for it and refuses to overwrite — ask the user via chat (only place a chat prompt is allowed) whether to discard or resume.
- **Edits outside the project root.** Always resolve paths against the active project root (read from settings or `mlbench projects show`). Never absolute paths from CLAUDE.md examples.
- **Forgetting to update `## Target` best-so-far.** It's the only mutable section in `experiments.md`. Easy to miss when verdict is `✓`.
- **Using `mlbench jobs submit` without `--json`.** Without it the output is human-formatted; parsing breaks across versions. Always pass `--json`.
- **Sleeping past 60 minutes for a single train.** ScheduleWakeup clamps to 3600s. For longer training, schedule for 3600s and the next iterate invocation will check status and re-sleep.

## Additional resources

### Reference files

- **`references/mlbench-cli.md`** — detailed CLI patterns, JSON output schemas seen in practice, troubleshooting.
