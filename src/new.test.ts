import { describe, expect, test } from "bun:test";
import { sanitizeTaskName } from "./new";

describe("sanitizeTaskName", () => {
  test.each([
    { input: "simple", expected: "simple" },
    { input: "with-dash", expected: "with-dash" },
    { input: "with_underscore", expected: "with_underscore" },
    { input: "CamelCase", expected: "CamelCase" },
    { input: "with spaces", expected: "with-spaces" },
    { input: "with/slashes", expected: "with-slashes" },
    { input: "special!@#chars", expected: "special-chars" },
    { input: "  trimmed  ", expected: "trimmed" },
    { input: "---leading-trailing---", expected: "leading-trailing" },
    { input: "multiple   spaces", expected: "multiple-spaces" },
    { input: "日本語", expected: "" },
    { input: "", expected: "" },
    { input: "123", expected: "123" },
    { input: "a1b2c3", expected: "a1b2c3" },
  ])("sanitizeTaskName($input) = $expected", ({ input, expected }) => {
    expect(sanitizeTaskName(input)).toBe(expected);
  });
});
