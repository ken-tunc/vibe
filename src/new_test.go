package vibe

import "testing"

func TestSanitizeTaskName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"simple", "simple"},
		{"with-dash", "with-dash"},
		{"with_underscore", "with_underscore"},
		{"CamelCase", "CamelCase"},
		{"with spaces", "with-spaces"},
		{"with/slashes", "with-slashes"},
		{"special!@#chars", "special-chars"},
		{"  trimmed  ", "trimmed"},
		{"---leading-trailing---", "leading-trailing"},
		{"multiple   spaces", "multiple-spaces"},
		{"日本語", ""},
		{"", ""},
		{"123", "123"},
		{"a1b2c3", "a1b2c3"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := sanitizeTaskName(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeTaskName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
