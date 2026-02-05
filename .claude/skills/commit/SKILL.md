---
name: commit
description: Type check, test, then commit with English message
disable-model-invocation: true
allowed-tools: Bash(bun:*), Bash(git:*)
---

# Commit Workflow

Before committing changes, run the following checks in order. If any step fails, report the error and stop.

## Steps

1. **Check for changes**
   - Run `git status` to see what files have been modified
   - If no changes, report and stop

2. **Type check**
   - Run `bun run --bun tsc --noEmit`
   - If it fails, report the errors and stop

3. **Test**
   - Run `bun test`
   - If tests fail, report the failures and stop

4. **Commit**
   - Stage all changes with `git add`
   - Analyze the diff to write a concise English commit message
   - Commit with `git commit -m "message"`
   - Do NOT push to remote

## Commit Message Guidelines

- Use imperative mood ("Add feature" not "Added feature")
- Keep the first line under 50 characters
- Focus on WHY, not just WHAT
