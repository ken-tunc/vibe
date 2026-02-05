import { homedir } from "os";
import { getBranch } from "./git";

interface StatusInput {
  model?: {
    display_name?: string;
  };
  workspace?: {
    current_dir?: string;
  };
  context_window?: {
    used_percentage?: number;
  };
}

export async function statusline(): Promise<void> {
  const input = await Bun.stdin.text();
  if (!input.trim()) {
    return;
  }

  let data: StatusInput;
  try {
    data = JSON.parse(input);
  } catch {
    console.error("Failed to parse JSON input");
    process.exit(1);
  }

  const home = homedir();
  const branch = await getBranch(data.workspace?.current_dir);
  const output = formatStatusOutput(
    data.model?.display_name,
    replaceTilde(data.workspace?.current_dir, home),
    branch,
    data.context_window?.used_percentage
  );
  console.log(output);
}

export function replaceTilde(path: string | undefined, home: string): string {
  if (!path) return "";
  if (home && path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}

export function formatStatusOutput(
  model: string | undefined,
  cwd: string,
  branch: string,
  usedPercentage: number | undefined
): string {
  const parts = [`🤖 ${model || ""}`, `📁 ${cwd}`];
  if (branch) {
    parts.push(`🌿 ${branch}`);
  }
  if (usedPercentage !== undefined) {
    parts.push(`💭 ${Math.round(usedPercentage)}%`);
  }
  return parts.join(" | ");
}
