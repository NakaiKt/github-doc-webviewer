import { describe, expect, it } from "vitest";
import { docName, docExtension, renamedPath, sanitizeFileName, syncDocName } from "../src/names";

describe("names", () => {
  it("derives the display name from the file name", () => {
    expect(docName("docs/設計メモ.md")).toBe("設計メモ");
    expect(docName("README.markdown")).toBe("README");
    expect(docName("a/b/c.md")).toBe("c");
  });

  it("keeps the original extension when renaming", () => {
    expect(docExtension("a/b.markdown")).toBe(".markdown");
    expect(docExtension("a/b")).toBe(".md");
    expect(renamedPath("docs/old.md", "new")).toBe("docs/new.md");
    expect(renamedPath("docs/old.markdown", "new")).toBe("docs/new.markdown");
    expect(renamedPath("old.md", "new")).toBe("new.md");
  });

  it("replaces characters that cannot be used in a file name", () => {
    expect(sanitizeFileName(" a/b:c?d ")).toBe("a-b-c-d");
    expect(sanitizeFileName("...hidden")).toBe("hidden");
    expect(sanitizeFileName("   ")).toBe("");
    // 空になる名前ではリネームしない
    expect(renamedPath("docs/old.md", "  ")).toBe("docs/old.md");
  });

  it("follows the rename in frontmatter title and the leading H1 when they matched", () => {
    const doc = "---\nid: x1\ntitle: 旧名\n---\n\n# 旧名\n\n本文\n";
    const out = syncDocName(doc, "旧名", "新名");
    expect(out).toContain("title: 新名");
    expect(out).toContain("# 新名");
    expect(out).toContain("本文");
  });

  it("leaves a customised title or heading untouched", () => {
    const doc = "---\ntitle: 自分で書いた見出し\n---\n\n# 別の見出し\n\n本文\n";
    expect(syncDocName(doc, "旧名", "新名")).toBe(doc);
  });

  it("does not rewrite headings inside code fences", () => {
    const doc = "```md\n# 旧名\n```\n";
    expect(syncDocName(doc, "旧名", "新名")).toBe(doc);
  });

  it("is a no-op when the name did not change", () => {
    const doc = "# 旧名\n";
    expect(syncDocName(doc, "旧名", "旧名")).toBe(doc);
  });
});
