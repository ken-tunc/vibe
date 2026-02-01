package main

import (
	"encoding/json"
	"fmt"
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

	cwd := input.Workspace.CurrentDir
	if home, _ := os.UserHomeDir(); home != "" && strings.HasPrefix(cwd, home) {
		cwd = "~" + cwd[len(home):]
	}

	out := fmt.Sprintf("🤖 %s | 📁 %s", input.Model.DisplayName, cwd)

	if branch := getGitBranch(input.Workspace.CurrentDir); branch != "" {
		out += fmt.Sprintf(" | 🌿 %s", branch)
	}
	if input.ContextWindow.UsedPercentage != nil {
		out += fmt.Sprintf(" | 💭 %.0f%%", *input.ContextWindow.UsedPercentage)
	}

	fmt.Println(out)
	return nil
}

func getGitBranch(dir string) string {
	out, err := exec.Command("git", "-C", dir, "branch", "--show-current").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
