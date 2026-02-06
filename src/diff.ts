import { $ } from "bun";

interface AdditionalRepo {
  path: string;
  branch: string;
}

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
    const diff = await $`git -C ${repo.path} diff ${repo.branch}...HEAD`.text();
    additionalDiffs.push(diff);
  }

  const combinedDiff = [primaryDiff, ...additionalDiffs].join("");
  await $`echo ${combinedDiff} | npx -y difit --include-untracked`;
}

function parseAdditionalRepos(): AdditionalRepo[] {
  const raw = process.env.VIBE_ADDITIONAL_REPOS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AdditionalRepo[];
  } catch {
    return [];
  }
}
