import { $ } from "bun";

export async function diffCommand(): Promise<void> {
  const targetBranch = process.env.VIBE_BASE_BRANCH;
  if (!targetBranch) {
    console.error("VIBE_BASE_BRANCH is not set. Run this command from a vibe worktree.");
    process.exit(1);
  }

  await $`git diff ${targetBranch}...HEAD | npx -y difit --include-untracked`;
}
