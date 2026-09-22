import { describe, expect, it } from "vitest";

import { getApiBaseUrl } from "./config";

describe("getApiBaseUrl", () => {
  it("normalizes a valid API URL", () => {
    expect(getApiBaseUrl(" http://localhost:8000/ ")).toBe(
      "http://localhost:8000",
    );
  });

  it("fails when the API URL is missing", () => {
    expect(() => getApiBaseUrl(undefined)).toThrow(
      "NEXT_PUBLIC_API_URL is required",
    );
  });

  it("rejects unsupported protocols", () => {
    expect(() => getApiBaseUrl("ftp://localhost")).toThrow(
      "must use http or https",
    );
  });
});
