import { describe, expect, it } from "vitest";
import {
  scanLinks,
  rewriteLinks,
  updateLinksForMovedDoc,
  updateLinksToMovedFile,
} from "../src/links";

describe("scanLinks", () => {
  it("finds links, images, definitions and embeds with exact offsets", () => {
    const md = [
      "# Title",
      "",
      "A [note](../notes/a.md#section) and ![img](assets/pic.png).",
      "",
      "![[notes/b.md#^block1]]",
      "",
      "[ref]: ./other.md",
    ].join("\n");
    const refs = scanLinks(md);
    const urls = refs.map((r) => [r.kind, r.url]);
    expect(urls).toEqual([
      ["link", "../notes/a.md#section"],
      ["image", "assets/pic.png"],
      ["embed", "notes/b.md#^block1"],
      ["definition", "./other.md"],
    ]);
    for (const r of refs) {
      expect(md.slice(r.start, r.end)).toBe(r.url);
    }
  });

  it("ignores code blocks and inline code", () => {
    const md = "```\n[x](a.md)\n```\n\nUse `[y](b.md)` inline.\n\n[real](c.md)\n";
    const refs = scanLinks(md);
    expect(refs.map((r) => r.url)).toEqual(["c.md"]);
  });

  it("handles link titles and angle-bracket urls", () => {
    const md = '[a](<my file.md> "title") and [b](b.md "t")';
    const refs = scanLinks(md);
    expect(refs.map((r) => r.url)).toEqual(["my file.md", "b.md"]);
  });

  it("handles links whose text contains brackets", () => {
    const md = "[see [1]](target.md)";
    const refs = scanLinks(md);
    expect(refs.map((r) => r.url)).toEqual(["target.md"]);
  });
});

describe("rewriteLinks", () => {
  it("rewrites multiple urls preserving surrounding text", () => {
    const md = "[a](a.md) mid ![i](i.png) end";
    const out = rewriteLinks(md, (ref) => (ref.url === "a.md" ? "x/a.md" : null));
    expect(out).toBe("[a](x/a.md) mid ![i](i.png) end");
  });
});

describe("updateLinksForMovedDoc", () => {
  it("recalculates relative links and image paths from the new location", () => {
    const md = "See [a](a.md) and ![p](../assets/p.png) and ![[a.md#^b1]]";
    // docs/note.md → archive/2024/note.md
    const out = updateLinksForMovedDoc(md, "docs/note.md", "archive/2024/note.md");
    expect(out).toBe(
      "See [a](../../docs/a.md) and ![p](../../assets/p.png) and ![[../../docs/a.md#^b1]]"
    );
  });

  it("keeps anchors and external urls", () => {
    const md = "[a](a.md#sec) [ext](https://example.com/x.md) [self](#local)";
    const out = updateLinksForMovedDoc(md, "docs/n.md", "n.md");
    expect(out).toBe("[a](docs/a.md#sec) [ext](https://example.com/x.md) [self](#local)");
  });

  it("encodes spaces in rewritten paths", () => {
    const md = "[a](my%20note.md)";
    const out = updateLinksForMovedDoc(md, "docs/n.md", "sub/dir/n.md");
    expect(out).toBe("[a](../../docs/my%20note.md)");
  });
});

describe("updateLinksToMovedFile", () => {
  it("rewrites only references to the moved file", () => {
    const md = "[a](docs/a.md) [b](docs/b.md) ![[docs/a.md#^x]]";
    const out = updateLinksToMovedFile(md, "index.md", "docs/a.md", "archive/a.md");
    expect(out).toBe("[a](archive/a.md) [b](docs/b.md) ![[archive/a.md#^x]]");
  });

  it("resolves ../ references from nested files", () => {
    const md = "link: [a](../docs/a.md)";
    const out = updateLinksToMovedFile(md, "sub/n.md", "docs/a.md", "docs/deep/a.md");
    expect(out).toBe("link: [a](../docs/deep/a.md)");
  });
});
