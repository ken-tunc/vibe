import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { getGitRoot, getRepoName, createWorktree } from "./git";

const WORKSPACES_DIR = ".vibe-workspaces";
const FILES_TO_COPY = [".envrc", ".claude/settings.local.json"];

export function sanitizeTaskName(task: string): string {
  return task
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function newCommand(
  task: string,
  sourceBranch?: string
): Promise<void> {
  const taskName = sanitizeTaskName(task);
  if (!taskName) {
    console.error("Invalid task name");
    process.exit(1);
  }

  const gitRoot = await getGitRoot();
  const repoName = await getRepoName(gitRoot);
  const home = homedir();
  const worktreePath = join(home, WORKSPACES_DIR, repoName, taskName);
  const branchName = `feature/${taskName}`;

  console.log(`Creating worktree at ${worktreePath}...`);
  await createWorktree(gitRoot, worktreePath, branchName, sourceBranch);

  for (const file of FILES_TO_COPY) {
    await copyIfExists(join(gitRoot, file), join(worktreePath, file));
  }

  await runDirenvAllow(worktreePath);
  await addToClaudeConfig(home, worktreePath);
  await runClaude(worktreePath);

  console.log(`Worktree created at ${worktreePath}`);
  console.log(`Branch: ${branchName}`);
}

async function copyIfExists(src: string, dst: string): Promise<void> {
  const file = Bun.file(src);
  if (await file.exists()) {
    const dir = dst.substring(0, dst.lastIndexOf("/"));
    if (dir !== dst) {
      await $`mkdir -p ${dir}`.nothrow();
    }
    await Bun.write(dst, file);
  }
}

async function runDirenvAllow(path: string): Promise<void> {
  await $`direnv allow ${path}`.nothrow().quiet();
}

async function runClaude(worktreePath: string): Promise<void> {
  await $`claude`.cwd(worktreePath).nothrow().quiet();
}

async function addToClaudeConfig(home: string, worktreePath: string): Promise<void> {
  const configPath = join(home, ".claude.json");
  const configFile = Bun.file(configPath);

  try {
    const config: { workspaces?: string[] } = (await configFile.exists())
      ? await configFile.json()
      : {};

    config.workspaces ??= [];
    if (!config.workspaces.includes(worktreePath)) {
      config.workspaces.push(worktreePath);
      await Bun.write(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  } catch {
    // Ignore errors
  }
}
