import { homedir } from "os";
import { getBranch } from "./git";

interface StatusInput {
  model?: {
    display_name?: string;
  };
  workspace?: {
    current_dir?: string;
  };
  cost?: {
    total_cost_usd?: number;
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
    compressPath(replaceTilde(data.workspace?.current_dir, home)),
    branch,
    data.cost?.total_cost_usd,
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

export function compressPath(path: string, maxLength: number = 30): string {
  if (path.length <= maxLength) return path;

  const parts = path.split("/");
  if (parts.length <= 2) return path;

  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1);

  return [first, ...middle.map((p) => p.charAt(0)), last].join("/");
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function formatStatusOutput(
  model: string | undefined,
  cwd: string,
  branch: string,
  costUsd: number | undefined,
  usedPercentage: number | undefined
): string {
  const parts = [`🤖 ${model || ""}`, `📁 ${cwd}`];
  if (branch) {
    parts.push(`🌿 ${branch}`);
  }
  if (costUsd !== undefined) {
    parts.push(`💰 ${formatCost(costUsd)}`);
  }
  if (usedPercentage !== undefined) {
    parts.push(`💭 ${Math.round(usedPercentage)}%`);
  }
  return parts.join(" | ");
}
