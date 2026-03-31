---
name: Fetch PR Comments Since Last Commit
description: This skill should be used when the user asks to "fetch pr comments", "get review comments", "check pr feedback", "what did reviewers say", "show pr comments since last commit", "get recent review feedback", or wants to see GitHub PR review comments posted after the latest commit. Filters out old/resolved comment noise from large PRs.
argument-hint: "[PR_NUMBER] [OWNER/REPO]"
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

# Fetch PR Comments Since Last Commit

## Purpose

Fetch only the GitHub PR review comments posted after the last commit on the branch. On PRs with many comments (50+), this filters out resolved noise and surfaces the feedback that still needs attention.

## Prerequisites

- `gh` (GitHub CLI) must be authenticated and in PATH
- `jq` must be available for JSON filtering

## Workflow

### 1. Determine PR and Repository

If the PR number and repo are provided as arguments, use them directly. Otherwise, detect from git context:

```bash
PR=$(gh pr view --json number --jq '.number')
OWNER_REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
```

If no open PR exists for the current branch, ask the user for the PR number.

Split the owner and repo for API calls:

```bash
OWNER="${OWNER_REPO%%/*}"
REPO="${OWNER_REPO##*/}"
```

### 2. Get the Last Commit Timestamp

```bash
LAST_COMMIT_DATE=$(gh pr view $PR --repo "$OWNER_REPO" --json commits --jq '.commits[-1].committedDate')
```

### 3. Fetch Inline Review Comments (After Last Commit)

These are comments attached to specific lines of code during review:

```bash
gh api "/repos/$OWNER/$REPO/pulls/$PR/comments" --paginate --jq \
  "[.[] | select(.created_at > \"$LAST_COMMIT_DATE\") | {user: .user.login, body: .body, path: .path, line: .line, created: .created_at}]"
```

### 4. Fetch Top-Level Issue Comments (After Last Commit)

These are general conversation comments on the PR thread. The `since` parameter filters server-side:

```bash
gh api "/repos/$OWNER/$REPO/issues/$PR/comments?since=$LAST_COMMIT_DATE" --paginate --jq \
  "[.[] | {user: .user.login, body: .body, created: .created_at}]"
```

### 5. Filter Out Bot Comments

Exclude common bot accounts (dependabot, github-actions, renovate, codecov, etc.) unless the user explicitly asks to include them.

### 6. Present Results

Format output as readable markdown, grouped by type:

**Inline review comments:**
- Include file path, line number, reviewer username, and comment body
- Group by file path for easy navigation

**Top-level comments:**
- Include reviewer username and comment body

If no comments found after the last commit, report that clearly.

## Complete One-Liner Reference

```bash
OWNER="owner" REPO="repo" PR=123 && \
LAST_COMMIT_DATE=$(gh pr view $PR --repo "$OWNER/$REPO" --json commits --jq '.commits[-1].committedDate') && \
echo "--- Review comments (inline) ---" && \
gh api "/repos/$OWNER/$REPO/pulls/$PR/comments" --paginate --jq \
  "[.[] | select(.created_at > \"$LAST_COMMIT_DATE\") | {user: .user.login, body: .body, path: .path, line: .line, created: .created_at}]" && \
echo "--- Issue comments (top-level) ---" && \
gh api "/repos/$OWNER/$REPO/issues/$PR/comments?since=$LAST_COMMIT_DATE" --paginate --jq \
  "[.[] | {user: .user.login, body: .body, created: .created_at}]"
```

## Tips

- To check review state (approved, changes requested):
  ```bash
  gh pr view $PR --repo "$OWNER_REPO" --json reviews --jq '.reviews[] | select(.state != "COMMENTED") | {user: .author.login, state: .state}'
  ```
- To filter by a specific reviewer, add `| select(.user == "username")` to the jq filter
- Review comments include `path` and `line` fields for locating exactly where feedback applies in the code
