import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCurrentTask, getTaskList } from "./cleanup";

describe("getCurrentTask", () => {
  const workspacesDir = "/home/user/.vibe-workspaces/repo";

  test.each([
    {
      cwd: "/home/user/.vibe-workspaces/repo/task1",
      expected: "task1",
    },
    {
      cwd: "/home/user/.vibe-workspaces/repo/task1/src",
      expected: "task1",
    },
    {
      cwd: "/home/user/.vibe-workspaces/repo/task-with-dash",
      expected: "task-with-dash",
    },
    {
      cwd: "/home/user/other-path",
      expected: undefined,
    },
    {
      cwd: "/home/user/.vibe-workspaces/other-repo/task1",
      expected: undefined,
    },
    {
      cwd: workspacesDir,
      expected: undefined,
    },
  ])("getCurrentTask($cwd) = $expected", ({ cwd, expected }) => {
    expect(getCurrentTask(cwd, workspacesDir)).toBe(expected);
  });
});

describe("getTaskList", () => {
  test("returns empty array for non-existent directory", async () => {
    const tasks = await getTaskList("/non-existent-path-12345");
    expect(tasks).toEqual([]);
  });

  test("returns directory names only", async () => {
    const tempDir = join(tmpdir(), `vibe-test-${Date.now()}`);
    await mkdir(tempDir);
    await mkdir(join(tempDir, "task1"));
    await mkdir(join(tempDir, "task2"));
    await writeFile(join(tempDir, "file.txt"), "");

    try {
      const tasks = await getTaskList(tempDir);
      expect(tasks.sort()).toEqual(["task1", "task2"]);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("returns empty array for empty directory", async () => {
    const tempDir = join(tmpdir(), `vibe-test-empty-${Date.now()}`);
    await mkdir(tempDir);

    try {
      const tasks = await getTaskList(tempDir);
      expect(tasks).toEqual([]);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});
