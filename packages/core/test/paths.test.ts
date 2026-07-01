import { describe, expect, it } from "vitest";
import { dirname, relativeTo, resolveRelative, splitAnchor, isRelativeUrl } from "../src/paths";

describe("paths", () => {
  it("resolves relative urls", () => {
    expect(resolveRelative("docs", "../assets/a.png")).toBe("assets/a.png");
    expect(resolveRelative("docs", "./a.md")).toBe("docs/a.md");
    expect(resolveRelative("", "a.md")).toBe("a.md");
    expect(resolveRelative("a/b", "c.md")).toBe("a/b/c.md");
    expect(resolveRelative("docs", "my%20file.md")).toBe("docs/my file.md");
  });

  it("computes relative paths", () => {
    expect(relativeTo("docs", "assets/a.png")).toBe("../assets/a.png");
    expect(relativeTo("", "docs/a.md")).toBe("docs/a.md");
    expect(relativeTo("a/b", "a/b/c.md")).toBe("c.md");
    expect(relativeTo("a/b", "a/c.md")).toBe("../c.md");
    // 同名ディレクトリとファイル名の共通prefixで壊れないこと
    expect(relativeTo("docs", "docs.md")).toBe("../docs.md");
  });

  it("splits anchors", () => {
    expect(splitAnchor("a.md#sec")).toEqual({ path: "a.md", anchor: "#sec" });
    expect(splitAnchor("a.md")).toEqual({ path: "a.md", anchor: "" });
  });

  it("classifies relative urls", () => {
    expect(isRelativeUrl("a.md")).toBe(true);
    expect(isRelativeUrl("../a.md")).toBe(true);
    expect(isRelativeUrl("https://x.com/a.md")).toBe(false);
    expect(isRelativeUrl("mailto:a@b.c")).toBe(false);
    expect(isRelativeUrl("#anchor")).toBe(false);
    expect(isRelativeUrl("//cdn.example.com/x")).toBe(false);
  });

  it("dirname", () => {
    expect(dirname("a/b/c.md")).toBe("a/b");
    expect(dirname("c.md")).toBe("");
  });
});
