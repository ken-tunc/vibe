import { $ } from "bun";

export async function getGhqRoot(): Promise<string> {
  const result = await $`ghq root`.nothrow().text();
  return result.trim();
}

export async function listGhqRepos(): Promise<string[]> {
  const lines = await Array.fromAsync($`ghq list`.nothrow().lines());
  return lines.filter((line) => line.length > 0);
}

export async function selectReposWithFzf(
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

export async function selectBranchWithFzf(
  repoPath: string
): Promise<string | undefined> {
  const branches = await Array.fromAsync(
    $`git -C ${repoPath} branch -a --format='%(refname:short)'`.nothrow().lines()
  );

  const branchList = branches.filter(
    (b) => b.length > 0 && !b.includes("HEAD")
  );

  if (branchList.length === 0) {
    return "main";
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

export async function updateRepos(repos: string[]): Promise<void> {
  if (repos.length === 0) return;

  console.log("Updating repositories...");
  await Promise.all(repos.map((repo) => $`ghq get --update ${repo}`.nothrow().quiet()));
}
