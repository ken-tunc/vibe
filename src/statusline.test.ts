import { describe, expect, test } from "bun:test";
import { replaceTilde, formatStatusOutput } from "./statusline";

describe("replaceTilde", () => {
  test.each([
    { path: "/home/user/test", home: "/home/user", expected: "~/test" },
    { path: "/home/user", home: "/home/user", expected: "~" },
    { path: "/tmp/other", home: "/home/user", expected: "/tmp/other" },
    { path: "/home/user/test", home: "", expected: "/home/user/test" },
    { path: undefined as string | undefined, home: "/home/user", expected: "" },
  ])("replaceTilde($path, $home) = $expected", ({ path, home, expected }) => {
    expect(replaceTilde(path, home)).toBe(expected);
  });
});

describe("formatStatusOutput", () => {
  test.each([
    {
      name: "all fields",
      model: "Opus",
      cwd: "~/test",
      branch: "main",
      usedPercentage: 25 as number | undefined,
      expected: "🤖 Opus | 📁 ~/test | 🌿 main | 💭 25%",
    },
    {
      name: "no branch",
      model: "Sonnet",
      cwd: "/tmp",
      branch: "",
      usedPercentage: 25 as number | undefined,
      expected: "🤖 Sonnet | 📁 /tmp | 💭 25%",
    },
    {
      name: "no percentage",
      model: "Opus",
      cwd: "~/test",
      branch: "main",
      usedPercentage: undefined as number | undefined,
      expected: "🤖 Opus | 📁 ~/test | 🌿 main",
    },
    {
      name: "minimal",
      model: "Haiku",
      cwd: "/",
      branch: "",
      usedPercentage: undefined as number | undefined,
      expected: "🤖 Haiku | 📁 /",
    },
  ])("$name", ({ model, cwd, branch, usedPercentage, expected }) => {
    expect(formatStatusOutput(model, cwd, branch, usedPercentage)).toBe(expected);
  });
});
