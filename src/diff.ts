import { $ } from "bun";
import { getDefaultBranch } from "./git";
import type { RepoConfig } from "./new";

export async function diffCommand(): Promise<void> {
  const additionalRepos = parseAdditionalRepos();

  const currentTargetBranch = await getDefaultBranch(".");
  const diffs = [await getRepoDiff(".", currentTargetBranch)];
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
