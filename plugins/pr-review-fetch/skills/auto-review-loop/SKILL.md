---
name: Auto Review Loop
description: This skill should be used when the user asks to "auto fix reviews", "review loop", "keep fixing pr comments", "monitor pr reviews", "auto check mode", "fix review feedback automatically", "loop until reviews are clean", or wants an automated cycle of fetching PR review comments, fixing issues, and pushing until no actionable feedback remains.
argument-hint: "[interval_minutes] [PR_NUMBER] [OWNER/REPO]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "Agent"]
---

# Auto Review Loop

## Purpose

Enter an automated loop that periodically fetches new PR review comments since the last commit, evaluates whether each comment raises a valid concern, applies fixes, commits, and pushes. Repeat until no actionable comments remain or the maximum cycle count is reached.

## Prerequisites

- `gh` (GitHub CLI) must be authenticated and in PATH
- `jq` must be available for JSON filtering
- Current branch must have an open PR (or PR number provided)

## Workflow

### 1. Initialize

Use the interval from arguments if provided. Otherwise, default to 15 minutes.

Determine PR and repo context:

```bash
PR=$(gh pr view --json number --jq '.number')
OWNER_REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
```

If detection fails, ask the user.

Split the owner and repo for API calls:

```bash
OWNER="${OWNER_REPO%%/*}"
REPO="${OWNER_REPO##*/}"
```

Set maximum cycle count to **10**.

### 2. Enter the Loop

For each cycle (1 through 10):

#### 2a. Fetch Comments Since Last Commit

Get the last commit timestamp:

```bash
LAST_COMMIT_DATE=$(gh pr view $PR --repo "$OWNER_REPO" --json commits --jq '.commits[-1].committedDate')
```

Fetch inline review comments:

```bash
gh api "/repos/$OWNER/$REPO/pulls/$PR/comments" --paginate --jq \
  "[.[] | select(.created_at > \"$LAST_COMMIT_DATE\") | {user: .user.login, body: .body, path: .path, line: .line, created: .created_at}]"
```

Fetch top-level issue comments:

```bash
gh api "/repos/$OWNER/$REPO/issues/$PR/comments?since=$LAST_COMMIT_DATE" --paginate --jq \
  "[.[] | {user: .user.login, body: .body, created: .created_at}]"
```

Filter out bot comments (dependabot, github-actions, renovate, codecov, etc.).

#### 2b. Evaluate Comments

For each comment, determine whether it raises a valid concern:

- Read the referenced file and line (for inline comments)
- Assess whether the reviewer's suggestion is a genuine improvement (bug fix, performance, readability, correctness, style)
- Skip comments that are questions, acknowledgments, or praise without actionable changes

If **zero actionable comments** are found, report success and exit the loop.

#### 2c. Apply Fixes

For each actionable comment:

1. Read the relevant file
2. Understand the reviewer's concern
3. Implement the fix
4. Verify the fix doesn't break surrounding logic

#### 2d. Commit and Push

Stage all changed files and create a commit. Write the commit message based on the actual concern addressed, not the review process itself:

```
fix: prevent null pointer when user has no avatar
```

If multiple concerns were addressed, summarize the primary change in the subject line and list others in the body.

Push to the remote branch:

```bash
git push
```

#### 2e. Wait

If more cycles remain, wait for the configured interval using `sleep` in bash:

```bash
sleep $((INTERVAL_MINUTES * 60))
```

Report progress to the user before sleeping:

> Cycle N complete. Fixed X comments. Waiting M minutes before next check...

Note: The bash sleep blocks the session. This is intentional — the loop is designed to run unattended while reviewers provide feedback asynchronously.

### 3. Exit Conditions

Exit the loop when any of these conditions are met:

- **Clean cycle**: No actionable comments found after last commit — report success
- **Max cycles reached**: 10 cycles completed — report status and remaining comments if any
- **No open PR**: PR was merged or closed during the loop

### 4. Final Report

After exiting, provide a summary:

- Total cycles run
- Total comments addressed
- Total commits pushed
- Whether the PR is now clean or has remaining feedback
- Any comments that were evaluated but intentionally skipped (with reasoning)

## Important Considerations

- Always re-fetch the last commit date at the start of each cycle (it changes after pushing)
- Each commit message should describe the actual concern, not "address review feedback"
- Evaluate every comment critically — not all reviewer suggestions are correct or necessary. If a suggestion would introduce a bug or degrade quality, skip it and note the reasoning
- If a comment references code that no longer exists (stale diff), skip it
- Run any available linting or type checking after applying fixes to catch regressions
- If `git push` fails (e.g., merge conflict or branch protection), stop the loop and report the error to the user
- If `gh api` calls fail (rate limits, auth issues), retry once after 30 seconds; if still failing, stop and report
