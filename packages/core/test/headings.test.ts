import { describe, expect, it } from "vitest";
import { parseHeadings } from "../src/headings";

describe("parseHeadings", () => {
  it("collects ATX headings with their level", () => {
    expect(parseHeadings("# A\n\n本文\n\n## B\n\n### C\n")).toEqual([
      { level: 1, text: "A" },
      { level: 2, text: "B" },
      { level: 3, text: "C" },
    ]);
  });

  it("ignores headings inside code fences", () => {
    const body = "# 本物\n\n```md\n# にせもの\n## にせもの2\n```\n\n## 本物2\n";
    expect(parseHeadings(body).map((h) => h.text)).toEqual(["本物", "本物2"]);
  });

  it("handles tilde fences and unbalanced fences", () => {
    expect(parseHeadings("~~~\n# x\n~~~\n# y\n").map((h) => h.text)).toEqual(["y"]);
    expect(parseHeadings("```\n# x\n").map((h) => h.text)).toEqual([]);
  });

  it("ignores headings inside blockquotes and alerts", () => {
    expect(parseHeadings("> [!NOTE]\n> # 中の見出し\n\n# 外\n").map((h) => h.text)).toEqual(["外"]);
  });

  it("ignores indented (list/code) headings but allows up to 3 spaces", () => {
    expect(parseHeadings("    # code\n").map((h) => h.text)).toEqual([]);
    expect(parseHeadings("- # in list\n").map((h) => h.text)).toEqual([]);
    expect(parseHeadings("   # ok\n").map((h) => h.text)).toEqual(["ok"]);
  });

  it("strips inline markup from the heading text", () => {
    expect(parseHeadings("# **太字** と `code` と [リンク](a.md)\n")[0].text).toBe(
      "太字 と code と リンク"
    );
    expect(parseHeadings("## 閉じATX ##\n")[0].text).toBe("閉じATX");
    expect(parseHeadings("## 見出し ^abc123\n")[0].text).toBe("見出し");
  });

  it("requires a space after the hashes and skips empty headings", () => {
    expect(parseHeadings("#タグではない\n").map((h) => h.text)).toEqual([]);
    expect(parseHeadings("#\n#  \n").map((h) => h.text)).toEqual([]);
    expect(parseHeadings("####### 7つは見出しではない\n").map((h) => h.text)).toEqual([]);
  });
});
