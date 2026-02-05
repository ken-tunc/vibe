import { $ } from "bun";

export async function getGhqRoot(): Promise<string> {
  const result = await $`ghq root`.nothrow().text();
  return result.trim();
}

export async function listGhqRepos(): Promise<string[]> {
  const result = await $`ghq list`.nothrow().text();
  return result
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
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
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
}

export async function selectBranchWithFzf(
  repoPath: string
): Promise<string | undefined> {
  const branches =
    await $`git -C ${repoPath} branch -a --format='%(refname:short)'`
      .nothrow()
      .text();

  const branchList = branches
    .trim()
    .split("\n")
    .filter((b) => b.length > 0)
    .map((b) => b.replace(/^origin\//, ""));

  const uniqueBranches = [...new Set(branchList)].filter(
    (b) => !b.startsWith("HEAD")
  );

  if (uniqueBranches.length === 0) {
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

  proc.stdin.write(uniqueBranches.join("\n"));
  proc.stdin.end();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return undefined;
  }

  const output = await new Response(proc.stdout).text();
  return output.trim() || undefined;
}

export async function updateRepos(repos: string[]): Promise<void> {
  if (repos.length === 0) return;

  console.log("Updating repositories...");
  const repoArgs = repos.map((repo) => `ghq get --update ${repo}`);
  await $`parallel ::: ${repoArgs}`.nothrow().quiet();
}
