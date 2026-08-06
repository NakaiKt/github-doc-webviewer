"use client";

/**
 * 表示設定（コードの折り返し / 本文の全幅表示）。
 *
 * ドキュメントごとではなくアプリ全体の設定としてlocalStorageに持つ。
 * frontmatterに書くとMarkdownの実体に表示都合のプロパティが混ざり、
 * 「このツールをやめてもGitHub上でそのまま読める」という原則から外れるため。
 */
import { create } from "zustand";

export interface DisplaySettings {
  /** コードブロックを折り返して表示する（横スクロールをやめる） */
  codeWrap: boolean;
  /** 本文の最大幅を外して画面幅いっぱいに広げる */
  fullWidth: boolean;
}

const KEY = "docvault.display";
const DEFAULTS: DisplaySettings = { codeWrap: false, fullWidth: false };

/**
 * 反映はhtml要素のクラスで行う。エディタ・埋め込み内の閲覧描画・prose幅が
 * 同じCSSルールを共有でき、Reactの再レンダリングを挟まずに切り替わる。
 */
function applyClasses(s: DisplaySettings) {
  const root = document.documentElement;
  root.classList.toggle("dv-code-wrap", s.codeWrap);
  root.classList.toggle("dv-full-width", s.fullWidth);
}

function load(): DisplaySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      codeWrap: typeof v?.codeWrap === "boolean" ? v.codeWrap : DEFAULTS.codeWrap,
      fullWidth: typeof v?.fullWidth === "boolean" ? v.fullWidth : DEFAULTS.fullWidth,
    };
  } catch {
    return DEFAULTS;
  }
}

interface DisplayStore extends DisplaySettings {
  /** localStorageはSSR時に読めないので、マウント後に流し込む */
  hydrate: () => void;
  toggle: (key: keyof DisplaySettings) => void;
}

export const useDisplay = create<DisplayStore>((set, get) => ({
  ...DEFAULTS,
  hydrate: () => {
    const s = load();
    set(s);
    applyClasses(s);
  },
  toggle: (key) => {
    const next: DisplaySettings = {
      codeWrap: get().codeWrap,
      fullWidth: get().fullWidth,
      [key]: !get()[key],
    };
    set(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    applyClasses(next);
  },
}));
