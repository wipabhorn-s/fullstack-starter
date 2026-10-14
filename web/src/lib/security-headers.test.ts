import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { describe, expect, it } from "vitest";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("security headers", () => {
  const csp = contentSecurityPolicy(false);

  it("blocks other sites from framing our pages (clickjacking)", () => {
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(
      securityHeaders(false).find((h) => h.key === "X-Frame-Options")?.value,
    ).toBe("DENY");
  });

  it("loads scripts only from our own origin", () => {
    expect(directive(csp, "script-src")).toBe(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
  });

  it("keeps eval and websockets out of production", () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws:");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });

  it("forces HTTPS in production only", () => {
    const hsts = (dev: boolean) =>
      securityHeaders(dev).some((h) => h.key === "Strict-Transport-Security");
    expect(hsts(false)).toBe(true);
    expect(hsts(true)).toBe(false);
  });
});
