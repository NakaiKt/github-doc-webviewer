import { describe, expect, it } from "vitest";
import { findBlock, replaceBlock, parseEmbedTarget } from "../src/blocks";

const body = [
  "# Doc",
  "",
  "First paragraph",
  "spanning two lines ^abc123",
  "",
  "Second paragraph",
].join("\n");

describe("findBlock", () => {
  it("finds a paragraph block by ^id and strips the marker", () => {
    const m = findBlock(body, "abc123");
    expect(m).not.toBeNull();
    expect(m!.text).toBe("First paragraph\nspanning two lines");
    expect(body.slice(m!.start, m!.end)).toBe("First paragraph\nspanning two lines ^abc123");
  });

  it("returns null for unknown id", () => {
    expect(findBlock(body, "zzz")).toBeNull();
  });

  it("does not match partial ids", () => {
    expect(findBlock(body, "abc")).toBeNull();
  });
});

describe("replaceBlock", () => {
  it("replaces block text and keeps the marker", () => {
    const out = replaceBlock(body, "abc123", "New content");
    expect(out).toBe(
      ["# Doc", "", "New content ^abc123", "", "Second paragraph"].join("\n")
    );
  });
});

describe("parseEmbedTarget", () => {
  it("parses path with block id", () => {
    expect(parseEmbedTarget("notes/a.md#^b1")).toEqual({ path: "notes/a.md", blockId: "b1" });
  });
  it("parses plain path", () => {
    expect(parseEmbedTarget("notes/a.md")).toEqual({ path: "notes/a.md", blockId: null });
  });
  it("parses heading anchor as non-block", () => {
    expect(parseEmbedTarget("a.md#heading")).toEqual({ path: "a.md", blockId: null });
  });
});
