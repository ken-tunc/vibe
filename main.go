package main

import (
	"flag"
	"fmt"
	"os"
)

const version = "0.1.0"

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "vibe - A personal vibe coding tool\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  vibe <command> [options]\n\n")
		fmt.Fprintf(os.Stderr, "Commands:\n")
		fmt.Fprintf(os.Stderr, "  statusline    Output statusline info from JSON input\n\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "  -h, --help\n")
		fmt.Fprintf(os.Stderr, "        Show this help message\n")
	}

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "statusline":
			if err := statusline(); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			return
		}
	}

	flag.Parse()
}
