import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

/**
 * Environment validation tests. These prove that a missing or malformed value
 * produces a clear error that names the VARIABLE but never leaks its VALUE.
 * They test the pure validateEnv() function directly, so they need no dynamic
 * module reloading and never touch a real database.
 */
const VALID_BASE = {
  DATABASE_URL: "mysql://bpta_app:secret@127.0.0.1:3306/bpta_transport_dev",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("validateEnv", () => {
  it("accepts a valid MySQL/MariaDB configuration", () => {
    const env = validateEnv(VALID_BASE);
    expect(env.DATABASE_URL).toContain("mysql://");
    expect(env.NODE_ENV).toBe("development");
  });

  it("reports production NODE_ENV correctly", () => {
    const env = validateEnv({ ...VALID_BASE, NODE_ENV: "production" });
    expect(env.NODE_ENV).toBe("production");
  });

  it("throws a clear error naming the missing variable when unconfigured", () => {
    expect(() => validateEnv({})).toThrowError(
      /DATABASE_URL|BETTER_AUTH_SECRET/,
    );
  });

  it("rejects a non-MySQL DATABASE_URL (e.g. leftover postgres)", () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        DATABASE_URL: "postgresql://user:pw@localhost:5432/db",
      }),
    ).toThrowError(/mysql/i);
  });

  it("does not include any secret VALUE in the thrown message", () => {
    let message = "";
    try {
      validateEnv({
        DATABASE_URL: "mysql://u:p@127.0.0.1:3306/db",
        BETTER_AUTH_SECRET: "short", // too short -> validation error
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("BETTER_AUTH_SECRET");
    // The offending value itself must never be echoed back.
    expect(message).not.toContain("short");
  });
});

