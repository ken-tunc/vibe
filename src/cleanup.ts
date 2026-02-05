import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getGitRoot, getRepoName, getWorkspacesDir, getBranch } from "./git";

async function getTaskList(workspacesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(workspacesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function getCurrentTask(cwd: string, workspacesDir: string): string | undefined {
  if (cwd.startsWith(workspacesDir + "/")) {
    const relativePath = cwd.slice(workspacesDir.length + 1);
    const taskName = relativePath.split("/")[0];
    return taskName;
  }
  return undefined;
}

async function selectTasksWithFzf(tasks: string[]): Promise<string[]> {
  if (tasks.length === 0) {
    return [];
  }

  const input = tasks.join("\n");
  const proc = Bun.spawn(
    ["fzf", "--multi", "--prompt", "Select tasks to delete> "],
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

interface TaskInfo {
  name: string;
  path: string;
  branch: string;
}

async function confirmDeletion(tasks: TaskInfo[]): Promise<boolean> {
  console.log("The following tasks will be deleted:");
  for (const task of tasks) {
    console.log(`  - ${task.name} (branch: ${task.branch})`);
  }
  process.stdout.write("Are you sure? [y/N] ");

  for await (const line of console) {
    const answer = line.trim().toLowerCase();
    return answer === "y" || answer === "yes";
  }
  return false;
}

export async function cleanupCommand(): Promise<void> {
  const gitRoot = await getGitRoot();
  const repoName = await getRepoName(gitRoot);
  const workspacesDir = getWorkspacesDir(repoName);

  const allTasks = await getTaskList(workspacesDir);
  if (allTasks.length === 0) {
    console.log("No tasks found");
    return;
  }

  const cwd = process.cwd();
  const currentTask = getCurrentTask(cwd, workspacesDir);
  const availableTasks = currentTask
    ? allTasks.filter((task) => task !== currentTask)
    : allTasks;

  if (availableTasks.length === 0) {
    console.log("No tasks available for cleanup (only current task exists)");
    return;
  }

  const selectedTaskNames = await selectTasksWithFzf(availableTasks);
  if (selectedTaskNames.length === 0) {
    console.log("No tasks selected");
    return;
  }

  const selectedTasks: TaskInfo[] = await Promise.all(
    selectedTaskNames.map(async (name) => {
      const path = join(workspacesDir, name);
      const branch = await getBranch(path);
      return { name, path, branch };
    })
  );

  const confirmed = await confirmDeletion(selectedTasks);
  if (!confirmed) {
    console.log("Aborted");
    return;
  }

  for (const task of selectedTasks) {
    console.log(`Removing ${task.name}...`);

    await $`git -C ${gitRoot} worktree remove --force ${task.path}`.nothrow().quiet();
    if (task.branch) {
      await $`git -C ${gitRoot} branch -D ${task.branch}`.nothrow().quiet();
    }
  }

  await $`git -C ${gitRoot} worktree prune`.nothrow().quiet();

  console.log("Done");
}
