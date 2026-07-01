import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * ドキュメントID。20人が独立にオフラインで採番しても衝突しない十分なランダム性を持つ
 * （36^14 ≒ 6×10^21 通り）。URL・YAMLどちらでも安全な小文字英数字のみ。
 */
export const generateDocId = customAlphabet(ALPHABET, 14);

/** 埋め込みブロック用の短いID（Obsidianの ^block-id 相当）。 */
export const generateBlockId = customAlphabet(ALPHABET, 6);
