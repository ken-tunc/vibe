# vibe

Vibe-coding tools for my personal use.

A CLI that manages tasks as Git worktrees and launches Claude Code in each one.

## Requirements

- [Bun](https://bun.sh/)
- [fzf](https://github.com/junegunn/fzf)
- [ghq](https://github.com/x-motemen/ghq) (for `--multi`)
- [difit](https://github.com/yoshiko-pg/difit) (auto-installed via npx on `diff`)

## Install

```sh
bun run build
```

This produces `dist/vibe`. Copy it somewhere on your `PATH`.

## Usage

### `vibe new <task>`

Create a worktree for the task and launch Claude Code.

```sh
vibe new my-feature
# Creates worktree at ~/.vibe-workspaces/<repo>/my-feature
# Creates branch feature/my-feature from the default branch
# Launches Claude Code in the worktree
```

**Options:**

- `-b <branch>` — Base branch (default: remote HEAD)
- `-p, --prefix <prefix>` — Branch name prefix (default: `feature/`)
- `-m, --multi` — Select additional ghq-managed repos to work on together

### `vibe diff`

Show the diff against the base branch using [difit](https://github.com/yoshiko-pg/difit). Includes untracked files.

Run this inside a worktree created by `vibe new` (requires the `VIBE_BASE_BRANCH` env var).

### `vibe cleanup`

Interactively select and delete worktrees via fzf. Removes both the worktree and its branch.

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
