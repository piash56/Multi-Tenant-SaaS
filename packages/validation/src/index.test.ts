import { describe, expect, it } from "vitest";
import { parseCommaSeparatedUrls } from "./index";

describe("parseCommaSeparatedUrls", () => {
  it("normalizes a list of valid origins", () => {
    expect(parseCommaSeparatedUrls("http://localhost:3000, https://example.com")).toEqual([
      "http://localhost:3000",
      "https://example.com",
    ]);
  });

  it("rejects invalid origins", () => {
    expect(() => parseCommaSeparatedUrls("not-a-url")).toThrow();
  });
});
