package vibe

import (
	"bytes"
	"strings"
	"testing"
)

func TestReplaceTilde(t *testing.T) {
	tests := []struct {
		path, home, want string
	}{
		{"/home/user/test", "/home/user", "~/test"},
		{"/home/user", "/home/user", "~"},
		{"/tmp/other", "/home/user", "/tmp/other"},
		{"/home/user/test", "", "/home/user/test"},
	}
	for _, tt := range tests {
		if got := replaceTilde(tt.path, tt.home); got != tt.want {
			t.Errorf("replaceTilde(%q, %q) = %q, want %q", tt.path, tt.home, got, tt.want)
		}
	}
}

func TestFormatStatusOutput(t *testing.T) {
	pct := 25.0

	tests := []struct {
		name           string
		model, cwd     string
		branch         string
		usedPercentage *float64
		want           string
	}{
		{
			name:  "all fields",
			model: "Opus", cwd: "~/test", branch: "main", usedPercentage: &pct,
			want: "🤖 Opus | 📁 ~/test | 🌿 main | 💭 25%",
		},
		{
			name:  "no branch",
			model: "Sonnet", cwd: "/tmp", branch: "", usedPercentage: &pct,
			want: "🤖 Sonnet | 📁 /tmp | 💭 25%",
		},
		{
			name:  "no percentage",
			model: "Opus", cwd: "~/test", branch: "main", usedPercentage: nil,
			want: "🤖 Opus | 📁 ~/test | 🌿 main",
		},
		{
			name:  "minimal",
			model: "Haiku", cwd: "/", branch: "", usedPercentage: nil,
			want: "🤖 Haiku | 📁 /",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatStatusOutput(tt.model, tt.cwd, tt.branch, tt.usedPercentage)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRunStatusline(t *testing.T) {
	pct25 := 25.0
	pct50 := 50.0

	tests := []struct {
		name   string
		input  StatusInput
		home   string
		branch string
		want   string
	}{
		{
			name: "all fields",
			input: StatusInput{
				Model: struct {
					DisplayName string `json:"display_name"`
				}{DisplayName: "Opus"},
				Workspace: struct {
					CurrentDir string `json:"current_dir"`
				}{CurrentDir: "/home/user/test"},
				ContextWindow: struct {
					UsedPercentage *float64 `json:"used_percentage"`
				}{UsedPercentage: &pct25},
			},
			home:   "/home/user",
			branch: "main",
			want:   "🤖 Opus | 📁 ~/test | 🌿 main | 💭 25%",
		},
		{
			name: "no branch",
			input: StatusInput{
				Model: struct {
					DisplayName string `json:"display_name"`
				}{DisplayName: "Sonnet"},
				Workspace: struct {
					CurrentDir string `json:"current_dir"`
				}{CurrentDir: "/tmp"},
				ContextWindow: struct {
					UsedPercentage *float64 `json:"used_percentage"`
				}{UsedPercentage: &pct50},
			},
			home:   "/home/user",
			branch: "",
			want:   "🤖 Sonnet | 📁 /tmp | 💭 50%",
		},
		{
			name: "no percentage",
			input: StatusInput{
				Model: struct {
					DisplayName string `json:"display_name"`
				}{DisplayName: "Opus"},
				Workspace: struct {
					CurrentDir string `json:"current_dir"`
				}{CurrentDir: "/home/user/test"},
			},
			home:   "/home/user",
			branch: "feature",
			want:   "🤖 Opus | 📁 ~/test | 🌿 feature",
		},
		{
			name: "minimal",
			input: StatusInput{
				Model: struct {
					DisplayName string `json:"display_name"`
				}{DisplayName: "Haiku"},
				Workspace: struct {
					CurrentDir string `json:"current_dir"`
				}{CurrentDir: "/"},
			},
			home:   "/home/user",
			branch: "",
			want:   "🤖 Haiku | 📁 /",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var w bytes.Buffer

			err := runStatusline(&w, tt.input, tt.home, tt.branch)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			got := strings.TrimSpace(w.String())
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
