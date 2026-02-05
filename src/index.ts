import { newCommand } from "./new";
import { statusline } from "./statusline";

function printUsage(): void {
  console.log(`vibe

Usage:
  vibe new [-b <branch>] [-m|--multi] <task>    Create a new worktree for a task
  vibe statusline                            Output status line from JSON input `);
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
      let multi = false;
      let taskIndex = 1;

      // Parse options
      while (taskIndex < args.length) {
        if (args[taskIndex] === "-b") {
          if (taskIndex + 1 >= args.length) {
            console.error("Missing branch name after -b");
            process.exit(1);
          }
          sourceBranch = args[taskIndex + 1];
          taskIndex += 2;
        } else if (args[taskIndex] === "-m" || args[taskIndex] === "--multi") {
          multi = true;
          taskIndex += 1;
        } else {
          break;
        }
      }

      const task = args[taskIndex];
      if (!task) {
        console.error("Missing task name");
        printUsage();
        process.exit(1);
      }
      await newCommand(task, sourceBranch, multi);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
