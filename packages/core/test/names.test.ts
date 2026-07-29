import { describe, expect, it } from "vitest";
import { docName, docExtension, renamedPath, sanitizeFileName } from "../src/names";

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
});
