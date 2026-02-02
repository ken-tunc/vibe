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

func NewTask(taskName, sourceBranch string) error {
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

	if err := createWorktree(gitRoot, worktreePath, branchName, sourceBranch); err != nil {
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

func createWorktree(gitRoot, worktreePath, branchName, sourceBranch string) error {
	args := []string{"worktree", "add", worktreePath, "-b", branchName}
	if sourceBranch != "" {
		args = append(args, sourceBranch)
	}
	cmd := exec.Command("git", args...)
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
