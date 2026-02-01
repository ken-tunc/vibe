package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

type StatusInput struct {
	Model struct {
		DisplayName string `json:"display_name"`
	} `json:"model"`
	Workspace struct {
		CurrentDir string `json:"current_dir"`
	} `json:"workspace"`
	ContextWindow struct {
		UsedPercentage *float64 `json:"used_percentage"`
	} `json:"context_window"`
}

func statusline() error {
	var input StatusInput
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		return err
	}

	home, _ := os.UserHomeDir()
	branch := getGitBranch(input.Workspace.CurrentDir)
	return runStatusline(os.Stdout, input, home, branch)
}

func runStatusline(w io.Writer, input StatusInput, home, branch string) error {
	cwd := replaceTilde(input.Workspace.CurrentDir, home)
	fmt.Fprintln(w, formatStatusOutput(input.Model.DisplayName, cwd, branch, input.ContextWindow.UsedPercentage))
	return nil
}

func replaceTilde(path, home string) string {
	if home != "" && strings.HasPrefix(path, home) {
		return "~" + path[len(home):]
	}
	return path
}

func formatStatusOutput(model, cwd, branch string, usedPercentage *float64) string {
	out := fmt.Sprintf("🤖 %s | 📁 %s", model, cwd)
	if branch != "" {
		out += fmt.Sprintf(" | 🌿 %s", branch)
	}
	if usedPercentage != nil {
		out += fmt.Sprintf(" | 💭 %.0f%%", *usedPercentage)
	}
	return out
}

func getGitBranch(dir string) string {
	out, err := exec.Command("git", "-C", dir, "branch", "--show-current").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
