import { newCommand } from "./new";
import { statusline } from "./statusline";

function printUsage(): void {
  console.log(`vibe

Usage:
  vibe new [-b <branch>] <task>    Create a new worktree for a task
  vibe statusline                  Output status line from JSON input `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "statusline":
      await statusline();
      break;

    case "new": {
      let sourceBranch: string | undefined;
      let taskIndex = 1;

      // Parse -b option
      if (args[1] === "-b") {
        if (args.length < 4) {
          console.error("Missing branch name after -b");
          process.exit(1);
        }
        sourceBranch = args[2];
        taskIndex = 3;
      }

      const task = args[taskIndex];
      if (!task) {
        console.error("Missing task name");
        printUsage();
        process.exit(1);
      }
      await newCommand(task, sourceBranch);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
