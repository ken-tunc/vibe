# vibe

Vibe-coding tools for my personal use.

## Requirements

- [Bun](https://bun.sh/)
- [fzf](https://github.com/junegunn/fzf)
- [ghq](https://github.com/x-motemen/ghq)

## Install

```sh
bun run build
```

This produces `dist/vibe`. Copy it somewhere on your `PATH`.

## Usage

### `vibe create-project`

Create a `.vibe-project.json` interactively. Select repositories with fzf and choose a default target branch for each.

```sh
vibe create-project
# Select repos via fzf --multi
# For each repo, select the target branch
# Creates .vibe-project.json in the current directory
```

Edit the generated file to configure `setupCommand` for each repo:

```json
{
  "repos": {
    "github.com/owner/backend": {
      "defaultTarget": "develop",
      "setupCommand": "pnpm install"
    },
    "github.com/owner/frontend": {
      "defaultTarget": "main",
      "setupCommand": "npm install"
    }
  }
}
```

Git-ignored files matching `.worktreeinclude` patterns in each repo are automatically copied to the worktree (same convention as `claude -w`).

### `vibe new <task>`

Create worktrees for all repos in `.vibe-project.json` and launch Claude Code.

Run this inside a project worktree created by `claude -w`:

```sh
# 1. Start a worktree session for the project repo
claude -w

# 2. Inside the worktree, create sub-repo workspaces
vibe new my-feature
# Creates worktrees for each repo inside the current directory
# Copies git-ignored files matching .worktreeinclude, runs setupCommand
# Launches Claude Code with --add-dir for each repo
```

**Options:**

- `-p, --prefix <prefix>` — Branch name prefix (default: `feature/`)

### `vibe statusline`

A [custom status line](https://code.claude.com/docs/en/statusline) for Claude Code. Reads session JSON from stdin and outputs a formatted line showing model name, directory, branch, cost, and context usage.

Add to `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "vibe statusline",
    "padding": 0
  }
}
```
