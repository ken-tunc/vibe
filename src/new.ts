import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { getGitRoot, getRepoName, createWorktree, getDefaultBranch, getWorkspacesDir } from "./git";
import {
  getGhqRoot,
  listGhqRepos,
  selectReposWithFzf,
  selectBranchWithFzf,
  updateRepos,
} from "./ghq";

const FILES_TO_COPY = [".envrc", ".claude/settings.local.json"];

export interface RepoConfig {
  path: string;
  branch: string;
  worktreePath: string;
}

export function sanitizeTaskName(task: string): string {
  return task
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function newCommand(
  task: string,
  prefix: string,
  sourceBranch?: string,
  multi?: boolean
): Promise<void> {
  const taskName = sanitizeTaskName(task);
  if (!taskName) {
    console.error("Invalid task name");
    process.exit(1);
  }

  const gitRoot = await getGitRoot();
  const repoName = await getRepoName(gitRoot);
  const worktreePath = join(getWorkspacesDir(repoName), taskName);
  const branchName = `${prefix}${taskName}`;

  let additionalRepos: RepoConfig[] = [];

  if (multi) {
    additionalRepos = await selectAndSetupAdditionalRepos(taskName, repoName, prefix);
    if (additionalRepos.length === 0) {
      console.log("No additional repositories selected.");
    }
  }

  const baseBranch = sourceBranch || await getDefaultBranch(gitRoot);

  console.log(`Creating worktree at ${worktreePath}...`);
  await createWorktree(gitRoot, worktreePath, branchName, baseBranch);

  for (const file of FILES_TO_COPY) {
    await copyIfExists(join(gitRoot, file), join(worktreePath, file));
  }

  await runDirenvAllow(worktreePath);
  await addToClaudeConfig(homedir(), worktreePath);

  await runClaude(worktreePath, additionalRepos, baseBranch);

  console.log(`Worktree created at ${worktreePath}`);
  console.log(`Branch: ${branchName}`);
  if (additionalRepos.length > 0) {
    console.log("Additional repositories:");
    for (const repo of additionalRepos) {
      console.log(`  - ${repo.worktreePath} (branch: ${branchName})`);
    }
  }
}

async function selectAndSetupAdditionalRepos(
  taskName: string,
  currentRepoName: string,
  prefix: string
): Promise<RepoConfig[]> {
  const ghqRoot = await getGhqRoot();
  const allRepos = await listGhqRepos();
  const selectedRepos = await selectReposWithFzf(allRepos, currentRepoName);

  if (selectedRepos.length === 0) {
    return [];
  }

  // Update selected repos
  await updateRepos(selectedRepos);

  const repoConfigs: RepoConfig[] = [];

  for (const repo of selectedRepos) {
    const repoPath = join(ghqRoot, repo);
    const repoName = repo.split("/").pop() || repo;

    console.log(`\nConfiguring ${repoName}...`);
    const branch = await selectBranchWithFzf(repoPath);

    if (!branch) {
      console.log(`Skipping ${repoName} (no branch selected)`);
      continue;
    }

    const worktreePath = join(getWorkspacesDir(repoName), taskName);
    const branchName = `${prefix}${taskName}`;

    console.log(`Creating worktree for ${repoName} at ${worktreePath}...`);
    await createWorktree(repoPath, worktreePath, branchName, branch);

    for (const file of FILES_TO_COPY) {
      await copyIfExists(join(repoPath, file), join(worktreePath, file));
    }

    await runDirenvAllow(worktreePath);
    await addToClaudeConfig(homedir(), worktreePath);

    repoConfigs.push({
      path: repoPath,
      branch,
      worktreePath,
    });
  }

  return repoConfigs;
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

async function runClaude(
  worktreePath: string,
  additionalRepos: RepoConfig[] = [],
  targetBranch?: string
): Promise<void> {
  const args = ["claude"];

  for (const repo of additionalRepos) {
    args.push("--add-dir", repo.worktreePath);
  }

  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  if (additionalRepos.length > 0) {
    env.CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD = "1";
    env.VIBE_ADDITIONAL_REPOS = JSON.stringify(additionalRepos);
  }
  if (targetBranch) {
    env.VIBE_BASE_BRANCH = targetBranch;
  }

  const proc = Bun.spawn(args, {
    cwd: worktreePath,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env,
  });
  await proc.exited;
}

async function addToClaudeConfig(home: string, worktreePath: string): Promise<void> {
  const configPath = join(home, ".claude.json");
  const configFile = Bun.file(configPath);

  try {
    if (!(await configFile.exists())) return;

    const config = await configFile.json() as Record<string, unknown>;
    const projects = (config.projects as Record<string, unknown>) ?? {};

    if (!(worktreePath in projects)) {
      projects[worktreePath] = { hasTrustDialogAccepted: true };
      config.projects = projects;
      await Bun.write(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  } catch {
    // Ignore errors
  }
}
