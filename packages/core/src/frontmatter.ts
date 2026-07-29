import yaml from "js-yaml";

export type Frontmatter = Record<string, unknown>;

export interface ParsedDoc {
  frontmatter: Frontmatter;
  /** frontmatter部分の生テキスト（区切り線を含まない）。frontmatterがない場合は null。 */
  frontmatterRaw: string | null;
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** YAMLフロントマター付きMarkdownを分解する。壊れたYAMLはfrontmatterなしとして扱う。 */
export function parseDoc(content: string): ParsedDoc {
  const m = content.match(FM_RE);
  if (!m) return { frontmatter: {}, frontmatterRaw: null, body: content };
  try {
    const parsed = yaml.load(m[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        frontmatter: parsed as Frontmatter,
        frontmatterRaw: m[1],
        body: content.slice(m[0].length),
      };
    }
  } catch {
    // fallthrough
  }
  return { frontmatter: {}, frontmatterRaw: null, body: content };
}

/** frontmatter + 本文からファイル内容を組み立てる。frontmatterが空なら本文のみ。 */
export function serializeDoc(frontmatter: Frontmatter, body: string): string {
  const keys = Object.keys(frontmatter);
  const normalizedBody = body.replace(/^\n+/, "");
  if (keys.length === 0) return normalizedBody;
  const fmText = yaml.dump(frontmatter, { lineWidth: -1 }).trimEnd();
  return `---\n${fmText}\n---\n\n${normalizedBody}`;
}

/** frontmatterの1キーを更新した新しいファイル内容を返す。 */
export function setFrontmatterKey(content: string, key: string, value: unknown): string {
  const { frontmatter, body } = parseDoc(content);
  const next = { ...frontmatter, [key]: value };
  return serializeDoc(next, body);
}
