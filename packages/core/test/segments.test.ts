import { describe, expect, it } from "vitest";
import { parseSegments } from "../src/segments";

describe("parseSegments", () => {
  it("splits an alert out of the surrounding markdown", () => {
    const segs = parseSegments("前文\n\n> [!NOTE]\n> 覚えておくべきこと\n\n後文\n");
    expect(segs.map((s) => s.type)).toEqual(["md", "alert", "md"]);
    expect(segs[1]).toEqual({ type: "alert", kind: "note", inner: "覚えておくべきこと" });
  });

  it("supports all five kinds, case-insensitively", () => {
    const src = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]
      .map((k) => `> [!${k}]\n> x\n`)
      .join("\n");
    expect(parseSegments(src).map((s) => (s.type === "alert" ? s.kind : s.type))).toEqual([
      "note",
      "tip",
      "important",
      "warning",
      "caution",
    ]);
    expect(parseSegments("> [!tip]\n> x")[0]).toMatchObject({ kind: "tip" });
  });

  it("keeps multi-paragraph and list content inside the alert", () => {
    const segs = parseSegments("> [!WARNING]\n> 一段落目\n>\n> - a\n> - b\n");
    expect(segs[0]).toEqual({
      type: "alert",
      kind: "warning",
      inner: "一段落目\n\n- a\n- b",
    });
  });

  it("supports alerts indented inside a list item", () => {
    const segs = parseSegments("- 項目\n\n  > [!TIP]\n  > ヒント\n");
    expect(segs.find((s) => s.type === "alert")).toEqual({
      type: "alert",
      kind: "tip",
      inner: "ヒント",
    });
  });

  it("renders a marker-only alert as a titled empty block", () => {
    expect(parseSegments("> [!NOTE]\n")[0]).toEqual({ type: "alert", kind: "note", inner: "" });
  });

  it("treats an unknown marker as a plain blockquote", () => {
    const segs = parseSegments("> [!HINT]\n> x\n");
    expect(segs.map((s) => s.type)).toEqual(["md"]);
  });

  it("does not touch alert-looking lines inside a code fence", () => {
    const segs = parseSegments("```md\n> [!NOTE]\n> x\n```\n");
    expect(segs.map((s) => s.type)).toEqual(["md"]);
  });

  it("splits mermaid and embeds", () => {
    const segs = parseSegments("```mermaid\ngraph TD;\n```\n\n![[other.md#^b1]]\n");
    expect(segs).toEqual([
      { type: "mermaid", code: "graph TD;" },
      { type: "embed", target: "other.md#^b1" },
    ]);
  });

  it("hides trailing block-id markers", () => {
    expect(parseSegments("段落 ^abc123")[0]).toEqual({ type: "md", text: "段落" });
  });
});
