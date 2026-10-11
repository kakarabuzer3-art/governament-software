import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = fileURLToPath(
  new URL("../src/styles/background.css", import.meta.url),
);
const css = readFileSync(cssPath, "utf8");

/**
 * Regression guard for the MANDATORY visual requirement: the exact
 * geometric background supplied by the user must never be replaced
 * by an unrelated gradient or theme.
 */
describe("supplied geometric background pattern", () => {
  it("uses the exact colours and size from the supplied source", () => {
    expect(css).toContain("--s: 200px");
    expect(css).toContain("--c1: #1d1d1d");
    expect(css).toContain("--c2: #4e4f51");
    expect(css).toContain("--c3: #3c3c3c");
  });

  it("reproduces both repeating conic gradients with original angles", () => {
    expect(css.match(/repeating-conic-gradient/g)?.length).toBe(2);
    expect(css).toContain("from 30deg");
    expect(css).toContain("var(--c1) 0 60deg");
    expect(css).toContain("var(--c2) 0 120deg");
    expect(css).toContain("#0000 0 120deg");
    expect(css).toContain("var(--c3) 0 180deg");
  });

  it("keeps the original background position and size calculations", () => {
    expect(css).toContain(
      "calc(0.5 * var(--s)) calc(0.5 * var(--s) * 0.577)",
    );
    expect(css).toContain("background-size: var(--s) calc(var(--s) * 0.577)");
  });

  it("renders as a fixed, non-interactive layer behind the app shell", () => {
    expect(css).toContain("position: fixed");
    expect(css).toContain("pointer-events: none");
  });
});
