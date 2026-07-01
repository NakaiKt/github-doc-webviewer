# DocVault — GitHubをバックエンドにしたNotion風ドキュメント管理Webアプリ

サーバー・DB・認証基盤を一切持たず、**GitHubリポジトリを唯一のデータストア**とする、
チーム（〜20人）向けの構造化ドキュメント管理ツール。
Obsidianの「1 vault = 1リポジトリ」に相当する単一リポジトリ選択方式で動作します。

**最重要の設計原則**: このツールをやめても、中身はGitHub上・Obsidian等でそのまま読める状態を維持する。

- ドキュメントの実体は **YAMLフロントマター付きMarkdown**（独自ブロックJSONなし）
- 画像は `assets/` に独立バイナリとして保存し、本文から**相対パス**で参照（Base64埋め込みなし）
- ドキュメント間リンクは**通常の相対Markdownリンク**（GitHub上でもクリック可能）
- Alerts・MermaidはGitHubがネイティブ描画する記法をそのまま使用

## 構成（pnpmモノレポ）

```
packages/core   # 純粋ロジック: GitHub APIクライアント / frontmatter / リンク書き換え /
                # ブロックID / 未参照画像検出 / パス解決（vitestユニットテスト付き）
apps/web        # Next.js (App Router, 静的エクスポート) + React + Tailwind のUI
```

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # apps/web/out/ に静的サイトを出力（任意の静的ホスティングに配置可能）
pnpm test     # coreのユニットテスト
```

## 起動フロー

1. アプリを開く → **fine-grained PAT** を貼り付け（localStorageにのみ保存。OAuth不使用）
   - 必要権限: 対象リポジトリの **Contents: Read and write**（Metadata: Read-onlyは自動付与）
2. ドキュメント用リポジトリを1つ選択（vault選択。サイドバーからいつでも切り替え可能）
3. Notion風UIで閲覧・編集。全機能は選択中の1リポジトリ内で完結

共有リンクを開いたユーザーがPAT未登録の場合は、PAT発行を案内する画面を挟んでから
同じドキュメントに到達します（サーバーレス構成上の自然な仕様）。

## 主な機能

| 機能 | 実装 |
| --- | --- |
| WYSIWYG編集 | Milkdown Crepe（ProseMirror + remark）。保存されるのは常にプレーンなGFM |
| 閲覧モード | GFM完全描画: Alerts 5種 / Mermaid / タスクリスト / 脚注 / 絵文字(:code:) / シンタックスハイライト / セクションアンカー |
| ドキュメントツリー | 任意階層に新規作成。表示名はファイル名（拡張子なし）。フォルダ作成対応（Gitの制約上 `.gitkeep` で空フォルダを表現） |
| 移動 | 移動ダイアログ + ツリーへの**ドラッグ&ドロップ**。参照元全ファイルの相対リンクと、移動したファイル自身の相対リンク・**画像相対パス**を自動で再計算し、**1コミット**で反映 |
| 共有リンク | `?repo={owner}/{repo}&doc={id}`。frontmatterのIDに紐づくため**ファイルを移動しても同じリンクで到達** |
| ID採番 | 遅延方式。開いた/編集したときに `nanoid`（36^14）で採番しfrontmatterへ書き込み |
| データベースビュー | 全ファイルのfrontmatterを横断集計してテーブル（ソート可）/ カンバン（任意プロパティでグループ化） |
| 検索 | MiniSearchによるクライアントサイド全文検索。pull済みキャッシュから構築（Code Search API不使用） |
| テンプレート | `_templates/*.md` に保存（リポジトリ内なので他ツールからも見える）。`{{title}}` `{{date}}` プレースホルダ対応 |
| 埋め込みブロック | Obsidian互換 `![[file.md#^block-id]]`。閲覧モードで実体を参照表示し、**その場編集で元ファイルへ書き戻し**（Notionの同期ブロック相当。書き戻しは本アプリ独自機能） |
| 未参照画像の削除 | 本文Markdown画像・リンク・埋め込み・**frontmatter内画像（cover等、ネスト含む）**を走査し、候補一覧を提示→ユーザー確認後に削除 |
| 同期 | main直push。1分ごと自動pull/push + 編集停止後5秒のデバウンスpush + 手動同期ボタン |
| 競合 | pushの直前にref確認。ズレていたらpullし、同一ファイルが両側で変更されていた場合のみ「最新を取得 / このまま上書き」のシンプルなダイアログ（3-wayマージなし） |
| テーマ | ダーク/ライト切り替え（エディタ・Mermaidにも反映） |

## 同期エンジンの設計

読み書きはすべて **Git Data API** に統一しています。

- **pull**: `GET git/ref/heads/main` でHEADのSHAを確認し、**変化があった場合のみ** treeを再帰取得。
  blob SHAが変わったMarkdownだけをblob APIで差分取得（毎分の全ファイル取得はしない）
- **push**: dirtyな全ファイルを blob作成 → tree作成 → commit作成 → `PATCH git/refs`（force: false）
  の1コミットにまとめる。refが進んでいた場合は422で弾かれる（= 競合検知）ため、
  pullして自動リベース。**同一ファイルが両側で変更されていたときだけ**競合ダイアログを表示
- **サイズ制限**: blob APIは100MBまで扱えるため、Contents APIの約1MB制限を受けない。
  画像アップロードもblob経由で同じコミットフローに乗る
- プライベートリポジトリの画像は blob APIで取得して objectURL 化して表示（PATだけで表示可能）
- **偽競合の防止**: GitHub APIのGETは `Cache-Control: max-age=60` を返すため、
  ブラウザHTTPキャッシュに乗ると自分のpush直後に古いrefが見えて偽の競合になる →
  全リクエストを `cache: "no-store"` で素通しする。また、pull/push/移動/削除の
  書き込み操作は内部キューで直列化し、自分のコミット同士のref衝突を防ぐ。
  pull中のキー入力はpull完了時点の最新stateへマージし、編集の巻き戻りを防ぐ

## 検討事項への回答

### WYSIWYGエディタの選定
**Milkdown Crepe（ProseMirror系）を採用。** Milkdownは内部表現がremark ASTで、
パースとシリアライズが対称なため「Markdownが実体」という本アプリの前提に最も適合します
（TipTapはHTML/独自JSONが実体でMarkdownは変換層になる）。実装上の注意点は2つ:

1. remark-stringifyがテキスト中の `[` を `\[` にエスケープするため、
   `> [!NOTE]` / `![[...]]` / `[^1]` が保存時に壊れる → 保存前に正規化して戻す
   （`apps/web/lib/crepeMarkdown.ts`）
2. 初期化直後にも正規化済みMarkdownで `markdownUpdated` が発火する →
   ユーザーが実際に操作するまで変更を伝播しない（開いただけでコミットが走らない）

### 埋め込みブロックの書き戻し
ブロック特定はObsidian互換の**行末 `^block-id` マーカー**（`packages/core/src/blocks.ts`）。
ブロック＝マーカー行を含む空行区切りの連続行として抽出・置換し、マーカーは書き戻し後も維持します。
書き戻しは「元ファイルの内容置換 → 通常の保存フロー」に乗せるため、
元ファイルがリモートで先に更新されていた場合も**通常の競合検知（ref/SHAベース）がそのまま働きます**。

### パーサー/シリアライザ構成（編集⇔保存の往復）
- 保存形態: 常にプレーンGFM（+ Alerts / Mermaid / `![[...]]` / `^id` はすべてGFMとして無害なテキスト）
- 編集時: Crepe（remark）。Mermaid・Alerts・埋め込みは**コードブロック/引用/テキストのまま保持**され、往復で壊れない
- 閲覧時: フェンス考慮の行単位セグメント分割（`lib/segments.ts`）で
  Mermaid / Alerts / 埋め込みを専用コンポーネントへ、残りを react-markdown
  （remark-gfm + remark-gemoji + rehype-highlight + rehype-slug）で描画

### ファイル移動UI
移動ダイアログ（必須要件）に加えて、ツリー上の**ドラッグ&ドロップ移動も実装済み**
（フォルダ/ルートへドロップ）。どちらも同じ `moveDoc` に集約され、リンク書き換え＋1コミットで反映されます。

### Drawio等の自由作図
スコープ外（Mermaidを基本とする）。将来 `.drawio.svg` を画像として扱う拡張は
現在のassets設計と互換です。

## テスト

- `packages/core`: vitestユニットテスト30件（リンク書き換え・パス解決・ブロック置換・
  frontmatter・未参照画像検出）
- E2E: GitHub REST APIをインメモリモックしたPlaywrightスモークテストで、
  PAT入力 → 共有リンク到達 → WYSIWYG → 閲覧描画（Mermaid/Alerts/画像）→ 埋め込み書き戻し →
  DBビュー → 検索 → 移動時のリンク/画像パス書き換え → 未参照画像削除 → テンプレート作成 →
  デバウンスpush までを検証済み

## 既知の制約

- WYSIWYG編集中のMermaid・Alerts・埋め込みはソース表示（閲覧モードで描画）
- 埋め込みの書き戻しはブロック指定（`#^id`）のときのみ。ファイル全体埋め込みは参照表示+元ファイルへのリンク
- ID未付与（未オープン）のファイルは共有リンク生成の対象外（仕様通りの遅延採番）
- リポジトリのtreeが極端に大きい場合（Git Trees APIのtruncation、10万エントリ超）は未対応
