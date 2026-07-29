import { describe, expect, it } from "vitest";
import { alertSnippet, matchAlertMarker, normalizeAlerts } from "../src/alerts";

describe("alerts", () => {
  it("recognises the five GitHub alert kinds", () => {
    expect(matchAlertMarker("[!NOTE]")).toBe("note");
    expect(matchAlertMarker("[!tip]")).toBe("tip");
    expect(matchAlertMarker("  [!IMPORTANT]  ")).toBe("important");
    expect(matchAlertMarker("[!WARNING]")).toBe("warning");
    expect(matchAlertMarker("[!CAUTION]")).toBe("caution");
    expect(matchAlertMarker("[!UNKNOWN]")).toBeNull();
    expect(matchAlertMarker("[!NOTE] 本文が続く")).toBeNull();
  });

  it("unescapes markers written back by remark-stringify", () => {
    expect(normalizeAlerts("> \\[!NOTE]\n> body")).toBe("> [!NOTE]\n> body");
    expect(normalizeAlerts("> \\[!WARNING\\]\n> body")).toBe("> [!WARNING]\n> body");
  });

  it("drops a trailing hard break on the marker line", () => {
    expect(normalizeAlerts("> \\[!TIP]\\\n> body")).toBe("> [!TIP]\n> body");
  });

  it("collapses the blank quote line between marker and body", () => {
    expect(normalizeAlerts("> \\[!NOTE]\n>\n> body\n")).toBe("> [!NOTE]\n> body\n");
  });

  it("keeps a marker-only alert (no body) intact", () => {
    expect(normalizeAlerts("> \\[!NOTE]\n\ntext")).toBe("> [!NOTE]\n\ntext");
  });

  it("normalises the kind to upper case and preserves indentation", () => {
    expect(normalizeAlerts("  > \\[!note]\n  > body")).toBe("  > [!NOTE]\n  > body");
  });

  it("leaves ordinary blockquotes alone", () => {
    expect(normalizeAlerts("> just a quote\n>\n> second")).toBe("> just a quote\n>\n> second");
  });

  it("builds a snippet in GitHub's canonical form", () => {
    expect(alertSnippet("caution", "危険")).toBe("> [!CAUTION]\n> 危険");
  });
});
