package vibe

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

const workspacesDir = ".vibe-workspaces"

var filesToCopy = []string{
	".envrc",
	".claude/settings.local.json",
}

func NewTask(taskName string) error {
	sanitized := sanitizeTaskName(taskName)
	if sanitized == "" {
		return fmt.Errorf("invalid task name: %q", taskName)
	}

	gitRoot, err := getGitRoot()
	if err != nil {
		return fmt.Errorf("not a git repository")
	}

	repoName := getRepoName(gitRoot)
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	worktreePath := filepath.Join(home, workspacesDir, repoName, sanitized)
	branchName := fmt.Sprintf("feature/%s", sanitized)

	if err := createWorktree(gitRoot, worktreePath, branchName); err != nil {
		return fmt.Errorf("failed to create worktree: %w", err)
	}

	for _, file := range filesToCopy {
		copyIfExists(filepath.Join(gitRoot, file), filepath.Join(worktreePath, file))
	}

	if !commandExists("direnv") {
		fmt.Fprintln(os.Stderr, "Warning: direnv not installed, skipping direnv allow")
	} else {
		cmd := exec.Command("direnv", "allow")
		cmd.Dir = worktreePath
		cmd.Run()
	}

	if err := addToClaudeConfig(worktreePath); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to update claude config: %v\n", err)
	}

	if !commandExists("claude") {
		fmt.Fprintln(os.Stderr, "Warning: claude not installed")
		return nil
	}

	cmd := exec.Command("claude", fmt.Sprintf("/rename %s", sanitized))
	cmd.Dir = worktreePath
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	return nil
}

func getGitRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func getRepoName(gitRoot string) string {
	out, err := exec.Command("git", "rev-parse", "--git-common-dir").Output()
	if err != nil {
		return ""
	}
	gitDir := strings.TrimSpace(string(out))
	if !filepath.IsAbs(gitDir) {
		gitDir = filepath.Join(gitRoot, gitDir)
	}
	return filepath.Base(filepath.Dir(gitDir))
}

func sanitizeTaskName(name string) string {
	name = strings.TrimSpace(name)
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]+`)
	name = re.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-")
	return name
}

func createWorktree(gitRoot, worktreePath, branchName string) error {
	cmd := exec.Command("git", "worktree", "add", worktreePath, "-b", branchName)
	cmd.Dir = gitRoot
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func copyIfExists(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func addToClaudeConfig(worktreePath string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	configPath := filepath.Join(home, ".claude.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	projects, ok := config["projects"].(map[string]interface{})
	if !ok {
		projects = make(map[string]interface{})
		config["projects"] = projects
	}

	if _, exists := projects[worktreePath]; !exists {
		projects[worktreePath] = map[string]interface{}{
			"hasTrustDialogAccepted": true,
		}
	}

	newData, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, newData, 0644)
}

func NewTaskMulti(taskName string) error {
	sanitized := sanitizeTaskName(taskName)
	if sanitized == "" {
		return fmt.Errorf("invalid task name: %q", taskName)
	}

	if !commandExists("ghq") {
		return fmt.Errorf("ghq is not installed")
	}
	if !commandExists("fzf") {
		return fmt.Errorf("fzf is not installed")
	}

	repos, err := selectReposWithFzf()
	if err != nil {
		return err
	}
	if len(repos) == 0 {
		return fmt.Errorf("no repositories selected")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	var worktreePaths []string
	for _, gitRoot := range repos {
		repoName := getRepoName(gitRoot)
		worktreePath := filepath.Join(home, workspacesDir, repoName, sanitized)
		branchName := fmt.Sprintf("feature/%s", sanitized)

		if err := createWorktree(gitRoot, worktreePath, branchName); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to create worktree for %s: %v\n", repoName, err)
			continue
		}

		for _, file := range filesToCopy {
			copyIfExists(filepath.Join(gitRoot, file), filepath.Join(worktreePath, file))
		}

		if commandExists("direnv") {
			cmd := exec.Command("direnv", "allow")
			cmd.Dir = worktreePath
			cmd.Run()
		}

		if err := addToClaudeConfig(worktreePath); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to update claude config for %s: %v\n", repoName, err)
		}

		worktreePaths = append(worktreePaths, worktreePath)
		fmt.Printf("Created worktree: %s\n", worktreePath)
	}

	if len(worktreePaths) == 0 {
		return fmt.Errorf("no worktrees were created")
	}

	return nil
}

func selectReposWithFzf() ([]string, error) {
	// Get repository list from ghq
	ghqOut, err := exec.Command("ghq", "list", "--full-path").Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run ghq: %w", err)
	}

	// Run fzf with multi-select
	fzfCmd := exec.Command("fzf", "--multi", "--prompt", "Select repositories (TAB to select): ")
	fzfCmd.Stdin = strings.NewReader(string(ghqOut))
	fzfCmd.Stderr = os.Stderr

	// fzf needs access to tty for interactive selection
	tty, err := os.OpenFile("/dev/tty", os.O_RDONLY, 0)
	if err == nil {
		fzfCmd.ExtraFiles = []*os.File{tty}
		defer tty.Close()
	}

	out, err := fzfCmd.Output()
	if err != nil {
		// fzf returns exit code 130 when user presses Ctrl-C, exit code 1 when no selection
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 130 || exitErr.ExitCode() == 1 {
				return nil, nil
			}
		}
		return nil, fmt.Errorf("fzf error: %w", err)
	}

	var selected []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			selected = append(selected, line)
		}
	}

	return selected, nil
}
