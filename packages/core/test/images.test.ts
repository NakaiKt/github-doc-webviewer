import { describe, expect, it } from "vitest";
import { collectImageRefs, findUnusedImages } from "../src/images";

describe("collectImageRefs", () => {
  it("collects body images, frontmatter images and embed-linked images", () => {
    const content = [
      "---",
      "title: T",
      "cover: assets/cover.png",
      "meta:",
      "  thumb: ../assets/thumb.jpg",
      "---",
      "",
      "![inline](../assets/inline.png)",
      "[as link](../assets/linked.gif)",
      "![[../assets/embedded.png]]",
      "![ext](https://example.com/x.png)",
    ].join("\n");
    const refs = collectImageRefs("docs/note.md", content);
    expect(refs).toContain("assets/inline.png");
    expect(refs).toContain("assets/linked.gif");
    expect(refs).toContain("assets/embedded.png");
    expect(refs).toContain("assets/thumb.jpg");
    // frontmatterはルート相対とファイル相対の両方を参照扱いにする
    expect(refs).toContain("assets/cover.png");
    expect(refs).toContain("docs/assets/cover.png");
    expect(refs.some((r) => r.includes("example.com"))).toBe(false);
  });
});

describe("findUnusedImages", () => {
  it("reports images not referenced by any markdown", () => {
    const md = [
      { path: "a.md", content: "![x](assets/used.png)" },
      { path: "docs/b.md", content: "---\ncover: assets/cover.png\n---\nbody" },
    ];
    const unused = findUnusedImages(md, [
      "assets/used.png",
      "assets/cover.png",
      "assets/orphan.png",
    ]);
    expect(unused).toEqual(["assets/orphan.png"]);
  });
});
