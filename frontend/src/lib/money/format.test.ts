import { describe, expect, it } from "vitest";

import { formatAmount, isPositiveAmountInput, normalizeAmountInput } from "./format";

describe("money string helpers", () => {
  it.each([
    ["125", "125.00"],
    ["125.5", "125.50"],
    ["125.50", "125.50"],
    ["1234567890.01", "1,234,567,890.01"],
    ["0", "0.00"],
  ])("formats %s without numeric conversion", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  it("normalizes only boundary whitespace and validates positivity", () => {
    expect(normalizeAmountInput(" 00125.50 ")).toBe("00125.50");
    expect(isPositiveAmountInput(" 0.01 ")).toBe(true);
    expect(isPositiveAmountInput("0.00")).toBe(false);
    expect(isPositiveAmountInput("1e2")).toBe(false);
    expect(isPositiveAmountInput("1.001")).toBe(false);
  });
});
