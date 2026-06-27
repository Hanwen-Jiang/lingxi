import {describe, expect, it} from "vitest";

import {decodeJwt, isAdmin, parseRoles} from "./auth";

// Build a fake unsigned JWT for testing: the header and signature don't
// matter because decodeJwt only reads the payload (verification is the
// gateway's job per contract §7).
function fakeJwt(claims: object): string {
  const header = "eyJhbGciOiJIUzI1NiJ9"; // {"alg":"HS256"}
  // btoa can't handle non-ASCII directly; round-trip the JSON through UTF-8
  // bytes first so any 中文 etc. survives.
  const json = JSON.stringify(claims);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const payload = btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.signature-ignored`;
}

describe("decodeJwt", () => {
  it("extracts the sub claim used as the userId", () => {
    const token = fakeJwt({sub: "10086", roles: "admin,user", exp: 1234567890});
    const claims = decodeJwt(token);
    expect(claims?.sub).toBe("10086");
    expect(claims?.exp).toBe(1234567890);
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
    // "two" is valid base64 but the decoded bytes don't form a JSON object.
    expect(decodeJwt("only.two")).toBeNull();
    expect(decodeJwt("")).toBeNull();
  });

  it("survives non-ASCII (UTF-8) characters in claims", () => {
    const token = fakeJwt({sub: "1", name: "灵犀"});
    const claims = decodeJwt(token) as {name?: string} | null;
    expect(claims?.name).toBe("灵犀");
  });
});

describe("parseRoles", () => {
  it("parses csv roles", () => {
    expect(parseRoles({roles: "admin,user, ops "})).toEqual(["admin", "user", "ops"]);
  });

  it("parses array roles", () => {
    expect(parseRoles({roles: ["admin", "user"]})).toEqual(["admin", "user"]);
  });

  it("returns [] when no roles", () => {
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles({})).toEqual([]);
  });
});

describe("isAdmin", () => {
  it("is true when admin role is present", () => {
    expect(isAdmin({id: "1", roles: ["user", "admin"]})).toBe(true);
  });

  it("is false otherwise", () => {
    expect(isAdmin({id: "1", roles: ["user"]})).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
