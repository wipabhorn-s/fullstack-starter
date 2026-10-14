import { safeLocalPath } from "@/lib/safe-path";
import { describe, expect, it } from "vitest";

describe("safeLocalPath", () => {
  it.each([
    "/",
    "/courses",
    "/courses?category=PROGRAMMING&page=2",
    "/wishlist#top",
  ])("keeps the in-site path %s", (path) => {
    expect(safeLocalPath(path)).toBe(path);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "courses",
    "",
    undefined,
    42,
  ])("falls back for %s", (path) => {
    expect(safeLocalPath(path, "/courses")).toBe("/courses");
  });
});
