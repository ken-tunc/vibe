# vibe

A CLI tool for task-based development workflow using Git worktrees.

## Overview

`vibe` helps you manage multiple development tasks in parallel by creating isolated worktrees for each task. It integrates seamlessly with Claude Code CLI, ghq, and other development tools to provide a smooth workflow.

## Features

- Create isolated worktrees for each task with dedicated branches
- Multi-repository support for working across multiple projects simultaneously
- Interactive task cleanup with fzf
- Automatic environment setup (direnv, Claude config)
- Custom status line formatter for Claude Code CLI
- Simple and minimal dependencies

## Installation

Build the binary using Bun:

```bash
bun run build
```

This creates the binary at `./dist/vibe`. Move it to a directory in your PATH:

```bash
mv ./dist/vibe /usr/local/bin/vibe
# or
mv ./dist/vibe ~/.local/bin/vibe
```

## Usage

### Create a new task

```bash
vibe new <task-name>
```

Creates a new worktree at `~/.vibe-workspaces/<repo>/<task-name>` with a new branch and launches Claude Code CLI.

#### Options

- `-b <branch>` - Specify the source branch (default: repository's default branch)
- `-m, --multi` - Enable multi-repository mode (requires ghq)
- `-p, --prefix <prefix>` - Set branch prefix (default: "feature/")

#### Examples

```bash
# Create a new task from the default branch
vibe new fix-auth-bug

# Create a task from a specific branch
vibe new add-feature -b develop

# Create a task with custom prefix
vibe new urgent-fix -p hotfix/

# Multi-repository workflow
vibe new cross-repo-feature --multi
```

### Cleanup completed tasks

```bash
vibe cleanup
```

Interactively select and delete worktrees and their associated branches using fzf.

### Status line

```bash
echo '{"model":{"display_name":"sonnet"},...}' | vibe statusline
```

Formats status information for Claude Code CLI. Typically used in Claude Code's status line configuration.

## Requirements

- [Bun](https://bun.sh/) - JavaScript runtime
- Git - Version control
- [fzf](https://github.com/junegunn/fzf) - Fuzzy finder for interactive selection
- [ghq](https://github.com/x-motemen/ghq) - Repository management (optional, for `--multi` mode)
- [direnv](https://direnv.net/) - Environment variable management (optional)
- [Claude Code CLI](https://github.com/anthropics/claude-code) - AI-powered coding assistant (optional)

## Configuration

### Files copied to worktrees

When creating a new worktree, `vibe` automatically copies these files if they exist:

- `.envrc` - direnv configuration
- `.claude/settings.local.json` - Claude Code local settings

### Workspace location

Worktrees are created in `~/.vibe-workspaces/<repo-name>/<task-name>`.

## Development

```bash
# Run tests
bun test

# Build
bun run build
```

## License

This is a collection of personal scripts. Use at your own discretion.
