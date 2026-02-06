import { $ } from "bun";
import type { RepoConfig } from "./new";

export async function diffCommand(): Promise<void> {
  const targetBranch = process.env.VIBE_BASE_BRANCH;
  if (!targetBranch) {
    console.error("VIBE_BASE_BRANCH is not set. Run this command from a vibe worktree.");
    process.exit(1);
  }

  const additionalRepos = parseAdditionalRepos();

  const diffs = [await getRepoDiff(".", targetBranch)];
  for (const repo of additionalRepos) {
    diffs.push(await getRepoDiff(repo.worktreePath, repo.branch));
  }

  const combinedDiff = diffs.join("");
  await $`echo ${combinedDiff} | npx -y difit`;
}

async function getRepoDiff(repoPath: string, branch: string): Promise<string> {
  const trackedDiff = await $`git -C ${repoPath} diff ${branch}`.text();

  const untrackedFiles = (
    await $`git -C ${repoPath} ls-files --others --exclude-standard`.text()
  ).trim();

  if (!untrackedFiles) return trackedDiff;

  const untrackedDiffs: string[] = [];
  for (const file of untrackedFiles.split("\n")) {
    const diff = await $`git -C ${repoPath} diff --no-index /dev/null ${file}`
      .nothrow()
      .text();
    untrackedDiffs.push(diff);
  }

  return trackedDiff + untrackedDiffs.join("");
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
