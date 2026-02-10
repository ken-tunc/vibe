import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { getWorkspacesDir, getGitRoot, getRepoName, getBranch } from "./git";

describe("getWorkspacesDir", () => {
  test.each([
    { repoName: "my-repo" },
    { repoName: "test" },
    { repoName: "vibe" },
  ])("getWorkspacesDir($repoName)", ({ repoName }) => {
    const expected = join(homedir(), ".vibe-workspaces", repoName);
    expect(getWorkspacesDir(repoName)).toBe(expected);
  });
});

describe("getGitRoot", () => {
  test("returns absolute path", async () => {
    const root = await getGitRoot();
    expect(root.startsWith("/")).toBe(true);
  });

  test("returns path containing vibe", async () => {
    const root = await getGitRoot();
    expect(root).toContain("vibe");
  });
});

describe("getRepoName", () => {
  test("returns repository name", async () => {
    const root = await getGitRoot();
    const name = await getRepoName(root);
    expect(name).toBe("vibe");
  });
});

describe("getBranch", () => {
  test("returns branch name for git directory", async () => {
    const root = await getGitRoot();
    const branch = await getBranch(root);
    expect(branch.length).toBeGreaterThan(0);
  });

  test("returns empty string for undefined", async () => {
    const branch = await getBranch(undefined);
    expect(branch).toBe("");
  });

  test("returns empty string for non-git directory", async () => {
    const branch = await getBranch("/tmp");
    expect(branch).toBe("");
  });
});
