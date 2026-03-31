# pr-review-fetch

Fetch GitHub PR review comments posted after the last commit, filtering out resolved noise. Includes an auto-fix loop mode that continuously fetches, fixes, and pushes until reviews are clean.

## Prerequisites

- **`gh`** (GitHub CLI) — authenticated and available in PATH
- **`jq`** — for JSON filtering

## Skills

### `/pr-review-fetch:fetch-pr-comments`

Manually fetch PR review comments since the last commit. Auto-detects PR and repo from git context.

```
/pr-review-fetch:fetch-pr-comments
/pr-review-fetch:fetch-pr-comments 123 owner/repo
```

### `/pr-review-fetch:auto-review-loop`

Start an automated loop: fetch new comments, evaluate and fix valid concerns, commit with descriptive messages, push, and wait. Repeats until no actionable comments remain (max 10 cycles).

```
/pr-review-fetch:auto-review-loop
/pr-review-fetch:auto-review-loop 15 123 owner/repo
```

## How It Works

GitHub PRs have two comment streams:

- **Review comments** — inline comments attached to specific lines of code
- **Issue comments** — top-level conversation comments on the PR thread

Both are fetched and filtered to only show comments posted after the last commit, which are the ones most likely to contain unresolved feedback.

## Installation

Copy or symlink this plugin into your Claude Code plugins directory, or use:

```bash
claude --plugin-dir /path/to/pr-review-fetch
```
