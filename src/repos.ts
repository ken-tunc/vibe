import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getBranch, WORKSPACES_DIR } from "./git";

export async function reposCommand(): Promise<void> {
  const cwd = process.cwd();
  const currentBranch = await getBranch(cwd);

  if (!currentBranch) {
    console.error("Not on a git branch");
    process.exit(1);
  }

  const workspacesRoot = join(homedir(), WORKSPACES_DIR);

  let repoDirs: string[];
  try {
    const entries = await readdir(workspacesRoot, { withFileTypes: true });
    repoDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.log("No workspaces found");
    return;
  }

  // Collect all worktree paths
  const worktrees: { repo: string; path: string }[] = [];
  for (const repo of repoDirs) {
    const repoDir = join(workspacesRoot, repo);
    try {
      const entries = await readdir(repoDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          worktrees.push({ repo, path: join(repoDir, entry.name) });
        }
      }
    } catch {
      continue;
    }
  }

  // Check branches in parallel
  const results = await Promise.all(
    worktrees.map(async (wt) => {
      const branch = await getBranch(wt.path);
      return { ...wt, branch };
    })
  );

  const matches = results.filter((r) => r.branch === currentBranch);

  if (matches.length === 0) {
    console.log(`No repositories found for branch: ${currentBranch}`);
    return;
  }

  for (const match of matches) {
    console.log(`${match.repo}\t${match.path}`);
  }
}
