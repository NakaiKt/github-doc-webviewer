import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc, setFrontmatterKey, docTitle } from "../src/frontmatter";

describe("frontmatter", () => {
  it("parses yaml frontmatter and body", () => {
    const doc = "---\nid: abc\ntitle: Hello\ntags: [a, b]\n---\n\n# Hi\n";
    const p = parseDoc(doc);
    expect(p.frontmatter).toEqual({ id: "abc", title: "Hello", tags: ["a", "b"] });
    expect(p.body).toBe("\n# Hi\n");
  });

  it("treats missing frontmatter as empty", () => {
    const p = parseDoc("# Just body\n");
    expect(p.frontmatter).toEqual({});
    expect(p.body).toBe("# Just body\n");
  });

  it("round-trips setFrontmatterKey", () => {
    const doc = "---\ntitle: X\n---\n\nbody\n";
    const out = setFrontmatterKey(doc, "id", "abc123");
    const p = parseDoc(out);
    expect(p.frontmatter).toEqual({ title: "X", id: "abc123" });
    expect(p.body.trim()).toBe("body");
  });

  it("adds frontmatter to a plain file", () => {
    const out = setFrontmatterKey("hello\n", "id", "x1");
    expect(out).toBe("---\nid: x1\n---\n\nhello\n");
  });

  it("serializes empty frontmatter as body only", () => {
    expect(serializeDoc({}, "b\n")).toBe("b\n");
  });

  it("derives title from frontmatter, h1, then fallback", () => {
    expect(docTitle("---\ntitle: T\n---\n# H\n", "f")).toBe("T");
    expect(docTitle("# H\nbody", "f")).toBe("H");
    expect(docTitle("body", "f")).toBe("f");
  });
});
