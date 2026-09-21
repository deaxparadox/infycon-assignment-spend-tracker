import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    ["/expenses", "/expenses"],
    ["/expenses?category=food#top", "/expenses?category=food#top"],
    ["https://attacker.example", "/summary"],
    ["//attacker.example/path", "/summary"],
    ["/\\attacker.example", "/summary"],
    ["javascript:alert(1)", "/summary"],
    [null, "/summary"],
  ])("maps %s to %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
