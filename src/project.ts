import { join } from "path";
import {
  getGhqRoot,
  listGhqRepos,
  selectReposWithFzf,
  selectBranchWithFzf,
} from "./ghq";

export const PROJECT_CONFIG_FILE = ".vibe-project.json";

export interface ProjectRepoConfig {
  defaultTarget?: string;
  setupCommand?: string;
}

export interface VibeProjectConfig {
  repos: Record<string, ProjectRepoConfig>;
}

export async function loadProjectConfig(
  dir: string
): Promise<VibeProjectConfig | null> {
  const file = Bun.file(join(dir, PROJECT_CONFIG_FILE));
  if (!(await file.exists())) {
    return null;
  }
  return (await file.json()) as VibeProjectConfig;
}

export async function createProjectCommand(): Promise<void> {
  const allRepos = await listGhqRepos();
  const selectedRepos = await selectReposWithFzf(
    allRepos,
    undefined,
    "Select repos for project> "
  );

  if (selectedRepos.length === 0) {
    console.log("No repositories selected.");
    return;
  }

  const ghqRoot = await getGhqRoot();
  const repos: Record<string, ProjectRepoConfig> = {};

  for (const repo of selectedRepos) {
    const repoPath = join(ghqRoot, repo);
    const repoName = repo.split("/").pop() || repo;

    console.log(`\nConfiguring ${repoName}...`);
    const branch = await selectBranchWithFzf(repoPath);

    repos[repo] = {
      defaultTarget: branch,
    };
  }

  const config: VibeProjectConfig = { repos };
  const configPath = join(process.cwd(), PROJECT_CONFIG_FILE);
  await Bun.write(configPath, JSON.stringify(config, null, 2) + "\n");

  await updateGitignore(
    join(process.cwd(), ".gitignore"),
    selectedRepos.map((repo) => repo.split("/").pop() || repo)
  );

  console.log(`\nCreated ${PROJECT_CONFIG_FILE} with ${selectedRepos.length} repositories.`);
  console.log("Edit the file to configure setupCommand for each repo.");
}

async function updateGitignore(
  gitignorePath: string,
  repoNames: string[]
): Promise<void> {
  const file = Bun.file(gitignorePath);
  const existing = (await file.exists()) ? await file.text() : "";

  const linesToAdd = repoNames.filter(
    (name) => !existing.split("\n").includes(`/${name}`)
  );

  if (linesToAdd.length === 0) return;

  const entries = linesToAdd.map((name) => `/${name}`).join("\n");
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await Bun.write(gitignorePath, existing + separator + entries + "\n");
}
