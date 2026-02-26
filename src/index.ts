import { newCommand } from "./new";
import { createProjectCommand } from "./project";
import { statusline } from "./statusline";

function printUsage(): void {
  console.log(`vibe

Usage:
  vibe create-project                              Create .vibe-project.json interactively
  vibe new [-p|--prefix <prefix>] <task>           Create worktrees and start Claude session
  vibe statusline                                  Output status line from JSON input`);
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

    case "create-project":
      await createProjectCommand();
      break;

    case "new": {
      let prefix = "feature/";
      let taskIndex = 1;

      // Parse options
      while (taskIndex < args.length) {
        if (args[taskIndex] === "-p" || args[taskIndex] === "--prefix") {
          if (taskIndex + 1 >= args.length) {
            console.error("Missing prefix after -p/--prefix");
            process.exit(1);
          }
          prefix = args[taskIndex + 1] ?? "";
          taskIndex += 2;
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
      await newCommand(task, prefix);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
