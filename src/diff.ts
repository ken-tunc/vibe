import { $ } from "bun";
import type { RepoConfig } from "./new";

export async function diffCommand(): Promise<void> {
  const targetBranch = process.env.VIBE_BASE_BRANCH;
  if (!targetBranch) {
    console.error("VIBE_BASE_BRANCH is not set. Run this command from a vibe worktree.");
    process.exit(1);
  }

  const additionalRepos = parseAdditionalRepos();

  if (additionalRepos.length === 0) {
    await $`git diff ${targetBranch}...HEAD | npx -y difit --include-untracked`;
    return;
  }

  const primaryDiff = await $`git diff ${targetBranch}...HEAD`.text();

  const additionalDiffs: string[] = [];
  for (const repo of additionalRepos) {
    const diff = await $`git -C ${repo.worktreePath} diff ${repo.branch}...HEAD`.text();
    additionalDiffs.push(diff);
  }

  const combinedDiff = [primaryDiff, ...additionalDiffs].join("");
  await $`echo ${combinedDiff} | npx -y difit --include-untracked`;
}

function parseAdditionalRepos(): RepoConfig[] {
  const raw = process.env.VIBE_ADDITIONAL_REPOS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RepoConfig[];
  } catch {
    return [];
  }
}
