import { expect, it } from "vitest";

import { serializeSearchParams } from "./search-params";

it("preserves scalar, repeated, and empty URL parameters", () => {
  expect(
    serializeSearchParams({
      category: ["food", "travel"],
      start_date: "2026-09-01",
      empty: "",
      missing: undefined,
    }),
  ).toBe("category=food&category=travel&start_date=2026-09-01&empty=");
});
