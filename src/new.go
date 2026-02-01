package vibe

import (
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

	repoName := filepath.Base(gitRoot)
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
