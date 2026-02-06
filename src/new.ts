import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { getGitRoot, getRepoName, getWorkspacesDir } from "./git";

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

// --- Git operations specific to this command ---

async function createWorktree(
  gitRoot: string,
  worktreePath: string,
  branchName: string,
  sourceBranch?: string
): Promise<void> {
  const base = sourceBranch || (await getDefaultBranch(gitRoot));
  try {
    await $`git -C ${gitRoot} worktree add -b ${branchName} ${worktreePath} ${base}`;
  } catch {
    console.error("Failed to create worktree");
    process.exit(1);
  }
}

async function getDefaultBranch(gitRoot: string): Promise<string> {
  const ref = (
    await $`git -C ${gitRoot} symbolic-ref refs/remotes/origin/HEAD`
      .nothrow()
      .text()
  ).trim();
  // refs/remotes/origin/main -> main
  if (ref) {
    const parts = ref.split("/");
    return parts[parts.length - 1] ?? "main";
  }
  return "main";
}

// --- ghq/fzf integration ---

async function getGhqRoot(): Promise<string> {
  const result = await $`ghq root`.nothrow().text();
  return result.trim();
}

async function listGhqRepos(): Promise<string[]> {
  const lines = await Array.fromAsync($`ghq list`.nothrow().lines());
  return lines.filter((line) => line.length > 0);
}

async function selectReposWithFzf(
  repos: string[],
  currentRepo?: string
): Promise<string[]> {
  const filteredRepos = currentRepo
    ? repos.filter((repo) => !repo.endsWith(`/${currentRepo}`))
    : repos;

  if (filteredRepos.length === 0) {
    return [];
  }

  const input = filteredRepos.join("\n");
  const proc = Bun.spawn(
    ["fzf", "--multi", "--prompt", "Select additional repos> "],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    }
  );

  proc.stdin.write(input);
  proc.stdin.end();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return [];
  }

  const output = await new Response(proc.stdout).text();
  return output.split("\n").filter((line) => line.length > 0);
}

async function selectBranchWithFzf(
  repoPath: string
): Promise<string | undefined> {
  const branches = await Array.fromAsync(
    $`git -C ${repoPath} branch -a --format='%(refname:short)'`.nothrow().lines()
  );

  const branchList = branches.filter(
    (b) => b.length > 0 && !b.includes("HEAD")
  );

  if (branchList.length === 0) {
    return await getDefaultBranch(repoPath);
  }

  const proc = Bun.spawn(
    ["fzf", "--prompt", `Select branch for ${repoPath.split("/").pop()}> `],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    }
  );

  proc.stdin.write(branchList.join("\n"));
  proc.stdin.end();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return undefined;
  }

  const output = await new Response(proc.stdout).text();
  const selected = output.trim();
  if (!selected) return undefined;

  // Remove origin/ prefix if present for worktree creation
  return selected.replace(/^origin\//, "");
}

async function updateRepos(repos: string[]): Promise<void> {
  if (repos.length === 0) return;

  console.log("Updating repositories...");
  await Promise.all(repos.map((repo) => $`ghq get --update ${repo}`.nothrow().quiet()));
}

// --- Multi-repo setup ---

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

// --- Helpers ---

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
