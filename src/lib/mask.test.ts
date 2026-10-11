import { describe, expect, it } from "vitest";
import { maskCnic, maskMobile, maskTail } from "./mask";

describe("maskCnic", () => {
  it("keeps the first 5 and last digit, hides the middle 7", () => {
    const masked = maskCnic("1730112345671");
    expect(masked).toBe("17301-\u2022\u2022\u2022\u2022\u2022\u2022\u2022-1");
    expect(masked).toMatch(/^\d{5}-\D{7}-\d$/);
  });

  it("accepts dash-formatted input", () => {
    expect(maskCnic("17301-1234567-1")).toBe(
      "17301-\u2022\u2022\u2022\u2022\u2022\u2022\u2022-1",
    );
  });

  it("never leaks hidden digits", () => {
    const masked = maskCnic("1730112345671");
    expect(masked).not.toContain("1234567");
    expect(masked).not.toContain("234567");
  });

  it("fully masks malformed input instead of guessing", () => {
    expect(maskCnic("12345")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022");
    expect(maskCnic("")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022");
    expect(maskCnic("not-a-number")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022");
  });
});

describe("maskMobile", () => {
  it("keeps the first 4 and last 2 digits", () => {
    const masked = maskMobile("03001234567");
    expect(masked).toBe("0300-\u2022\u2022\u2022\u2022\u202267");
    expect(masked).toMatch(/^\d{4}-\D{5}\d{2}$/);
  });

  it("fully masks malformed input", () => {
    expect(maskMobile("12345")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022");
    expect(maskMobile("")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022");
  });
});

describe("maskTail", () => {
  it("reveals only the requested tail characters", () => {
    const masked = maskTail("PERMIT-2026-9917", 4);
    expect(masked.endsWith("9917")).toBe(true);
    expect(masked).not.toContain("PERMIT");
  });

  it("masks short values completely", () => {
    expect(maskTail("ab")).toBe("\u2022\u2022\u2022\u2022");
  });
});
