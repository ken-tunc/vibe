import { $ } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";

const WORKSPACES_DIR = ".vibe-workspaces";

export function getWorkspacesDir(repoName: string): string {
  return join(homedir(), WORKSPACES_DIR, repoName);
}

export async function getGitRoot(): Promise<string> {
  try {
    return (await $`git rev-parse --show-toplevel`.text()).trim();
  } catch {
    console.error("Not a git repository");
    process.exit(1);
  }
}

export async function getRepoName(gitRoot: string): Promise<string> {
  const gitDir = (await $`git rev-parse --git-common-dir`.nothrow().text()).trim();
  if (!gitDir) return "unknown";

  const absoluteGitDir = gitDir.startsWith("/")
    ? gitDir
    : `${gitRoot}/${gitDir}`;

  // Return parent directory name of .git directory
  const parts = absoluteGitDir.split("/");
  return parts[parts.length - 2] || "unknown";
}

export async function createWorktree(
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

export async function getDefaultBranch(gitRoot: string): Promise<string> {
  const ref = (
    await $`git -C ${gitRoot} symbolic-ref refs/remotes/origin/HEAD`
      .nothrow()
      .text()
  ).trim();
  // refs/remotes/origin/main -> main
  if (ref) {
    const parts = ref.split("/");
    return parts[parts.length - 1];
  }
  return "main";
}

export async function getBranch(dir: string | undefined): Promise<string> {
  if (!dir) return "";
  const result = await $`git -C ${dir} branch --show-current`.nothrow().text();
  return result.trim();
}
