import { describe, expect, test } from "bun:test";
import { replaceTilde, compressPath, formatStatusOutput, formatCost } from "./statusline";

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

describe("compressPath", () => {
  test.each([
    { path: "~/short", maxLength: 30, expected: "~/short" },
    { path: "~/a/b/c", maxLength: 30, expected: "~/a/b/c" },
    {
      path: "~/very/long/directory/structure",
      maxLength: 30,
      expected: "~/v/l/d/structure",
    },
    {
      path: "/home/user/projects/my-app",
      maxLength: 20,
      expected: "/h/u/p/my-app",
    },
    {
      path: "~/projects/my-application",
      maxLength: 20,
      expected: "~/p/my-application",
    },
    { path: "/tmp", maxLength: 30, expected: "/tmp" },
    { path: "~/test", maxLength: 30, expected: "~/test" },
  ])(
    "compressPath($path, $maxLength) = $expected",
    ({ path, maxLength, expected }) => {
      expect(compressPath(path, maxLength)).toBe(expected);
    }
  );
});

describe("formatCost", () => {
  test.each([
    { cost: 0.001, expected: "$0.0010" },
    { cost: 0.0099, expected: "$0.0099" },
    { cost: 0.01, expected: "$0.01" },
    { cost: 0.1234, expected: "$0.12" },
    { cost: 1.5, expected: "$1.50" },
  ])("formatCost($cost) = $expected", ({ cost, expected }) => {
    expect(formatCost(cost)).toBe(expected);
  });
});

describe("formatStatusOutput", () => {
  test.each([
    {
      name: "all fields",
      model: "Opus",
      cwd: "~/test",
      branch: "main",
      costUsd: 0.05 as number | undefined,
      usedPercentage: 25 as number | undefined,
      expected: "🤖 Opus | 📁 ~/test | 🌿 main | 💰 $0.05 | 💭 25%",
    },
    {
      name: "no branch",
      model: "Sonnet",
      cwd: "/tmp",
      branch: "",
      costUsd: 1.23 as number | undefined,
      usedPercentage: 25 as number | undefined,
      expected: "🤖 Sonnet | 📁 /tmp | 💰 $1.23 | 💭 25%",
    },
    {
      name: "no cost",
      model: "Opus",
      cwd: "~/test",
      branch: "main",
      costUsd: undefined as number | undefined,
      usedPercentage: 25 as number | undefined,
      expected: "🤖 Opus | 📁 ~/test | 🌿 main | 💭 25%",
    },
    {
      name: "no percentage",
      model: "Opus",
      cwd: "~/test",
      branch: "main",
      costUsd: 0.05 as number | undefined,
      usedPercentage: undefined as number | undefined,
      expected: "🤖 Opus | 📁 ~/test | 🌿 main | 💰 $0.05",
    },
    {
      name: "minimal",
      model: "Haiku",
      cwd: "/",
      branch: "",
      costUsd: undefined as number | undefined,
      usedPercentage: undefined as number | undefined,
      expected: "🤖 Haiku | 📁 /",
    },
  ])("$name", ({ model, cwd, branch, costUsd, usedPercentage, expected }) => {
    expect(formatStatusOutput(model, cwd, branch, costUsd, usedPercentage)).toBe(expected);
  });
});
