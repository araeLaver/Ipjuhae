# main branch protection runbook

Updated: 2026-09-29 KST

This repository's `main` branch is protected. All agents must use the PR path below for production-bound changes.

## Required path

1. Work in an issue-specific worktree or branch.
2. Push only that branch to GitHub.
3. Open a PR into `main`.
4. Wait for the required checks to pass:
   - `Lint`
   - `Type Check`
   - `Unit Tests`
   - `Build`
5. Record the PR URL and commit SHA on the Paperclip issue.
6. Get Paperclip CEO approval before merging when the issue requires business or production approval.
7. Merge through GitHub after approval. Do not push directly to `main`.

## Protected branch settings

The expected `main` protection settings are:

- Pull request path required before updates.
- Required status checks are strict and must be up to date with `main`.
- Required checks: `Lint`, `Type Check`, `Unit Tests`, `Build`.
- Required approving reviews: `0`.
- Admin enforcement: enabled.
- Force pushes: disabled.
- Branch deletions: disabled.

`required_approving_review_count: 0` means a review approval is not required by GitHub. It does not mean agents may skip the PR path or Paperclip approval requirements.

## Negative controls

Do not test protection by pushing unauthorized commits to production `main`.

For branch protection verification, use a temporary protected branch created from the current `origin/main` SHA, apply the same protection rules, and verify:

- Direct push to the temporary protected branch is rejected by GitHub.
- A PR with missing required checks cannot be merged.

Close temporary PRs after collecting evidence. Delete temporary branches only after the evidence has been recorded.
