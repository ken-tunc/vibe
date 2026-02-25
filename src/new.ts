import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { getGitRoot, createWorktree, getDefaultBranch } from "./git";
import { getGhqRoot } from "./ghq";
import { loadProjectConfig, PROJECT_CONFIG_FILE } from "./project";

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
  prefix: string
): Promise<void> {
  const config = await loadProjectConfig(process.cwd());
  if (!config) {
    console.error(`${PROJECT_CONFIG_FILE} not found in current directory.`);
    console.error('Run "vibe create-project" to create one.');
    process.exit(1);
  }

  const taskName = sanitizeTaskName(task);
  if (!taskName) {
    console.error("Invalid task name");
    process.exit(1);
  }

  const gitRoot = await getGitRoot();
  const baseBranch = await getDefaultBranch(gitRoot);
  const ghqRoot = await getGhqRoot();
  const branchName = `${prefix}${taskName}`;

  const additionalRepos: RepoConfig[] = [];

  for (const [ghqPath, repoConfig] of Object.entries(config.repos)) {
    const repoName = ghqPath.split("/").pop() || ghqPath;
    const absolutePath = join(ghqRoot, ghqPath);

    const isGitRepo = (await $`git -C ${absolutePath} rev-parse --git-dir`.nothrow().quiet()).exitCode === 0;
    if (!isGitRepo) {
      console.error(`Repository not found: ${ghqPath}`);
      console.error(`Run "ghq get ${ghqPath}" first.`);
      continue;
    }

    const sourceBranch =
      repoConfig.defaultTarget || (await getDefaultBranch(absolutePath));
    const worktreePath = join(process.cwd(), repoName);

    console.log(`Creating worktree for ${repoName}...`);
    await createWorktree(absolutePath, worktreePath, branchName, sourceBranch);

    await copyWorktreeIncludeFiles(absolutePath, worktreePath);

    if (repoConfig.setupCommand) {
      console.log(`Running setup for ${repoName}...`);
      const result =
        await $`sh -c ${repoConfig.setupCommand}`.cwd(worktreePath).nothrow();
      if (result.exitCode !== 0) {
        console.error(`Warning: setupCommand failed for ${repoName}`);
      }
    }

    await runDirenvAllow(worktreePath);
    await addToClaudeConfig(homedir(), worktreePath);

    additionalRepos.push({
      path: absolutePath,
      branch: sourceBranch,
      worktreePath,
    });
  }

  if (additionalRepos.length === 0) {
    console.error("No repositories were set up.");
    process.exit(1);
  }

  await runClaude(process.cwd(), additionalRepos, baseBranch);

  console.log("\nWorkspaces created:");
  for (const repo of additionalRepos) {
    console.log(`  - ${repo.worktreePath} (branch: ${branchName})`);
  }
}

async function copyWorktreeIncludeFiles(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  const includeFile = Bun.file(join(repoPath, ".worktreeinclude"));
  if (!(await includeFile.exists())) return;

  const content = await includeFile.text();
  const patterns = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (patterns.length === 0) return;

  const result = await $`git -C ${repoPath} ls-files --others --ignored --exclude-standard -- ${patterns}`
    .nothrow()
    .text();
  const files = result
    .split("\n")
    .filter((f) => f.length > 0);

  for (const file of files) {
    await copyIfExists(join(repoPath, file), join(worktreePath, file));
  }
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
