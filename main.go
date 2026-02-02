package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/ken-tunc/vibe/src"
)

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "vibe - A personal vibe coding tool\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  vibe <command> [options]\n\n")
		fmt.Fprintf(os.Stderr, "Commands:\n")
		fmt.Fprintf(os.Stderr, "  new [-b <branch>] <task>    Create a new worktree for a task\n")
		fmt.Fprintf(os.Stderr, "  statusline    Output statusline info from JSON input\n")
		fmt.Fprintf(os.Stderr, "  version       Show version information\n\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "  -h, --help\n")
		fmt.Fprintf(os.Stderr, "        Show this help message\n")
	}

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "new":
			newCmd := flag.NewFlagSet("new", flag.ExitOnError)
			baseBranch := newCmd.String("b", "", "source branch to create worktree from")
			newCmd.Usage = func() {
				fmt.Fprintln(os.Stderr, "Usage: vibe new [-b <branch>] <task-name>")
				newCmd.PrintDefaults()
			}
			newCmd.Parse(os.Args[2:])
			if newCmd.NArg() < 1 {
				newCmd.Usage()
				os.Exit(1)
			}
			if err := vibe.NewTask(newCmd.Arg(0), *baseBranch); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			return
		case "statusline":
			if err := vibe.Statusline(); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			return
		case "version":
			fmt.Printf("vibe version %s\n", version)
			return
		}
	}

	flag.Parse()
}
