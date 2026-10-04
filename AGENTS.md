<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes (poker-mtt-tracker)

- 目的: ライブMTTのハンドをiPhone(PWA)で記録し、GTO Wizard の Hand History Analyzer が読める PokerStars 形式テキストを書き出す。
- 構成: Next.js (App Router, client components) + Tailwind v4 + localStorage ローカルファースト + Supabase 同期(任意) + Vercel。
- 主要ロジック: `src/lib/engine.ts`(ベッティング/ポット), `src/lib/exporter.ts`(PokerStars形式), `src/lib/handEval.ts`(役判定), `src/lib/store.ts`(永続化), `src/lib/sync.ts`(Supabase同期)。
- テスト: `npx vitest run`。ビルド: `npm run build`。Node は `C:\Users\nobuz\tools\nodejs`(ZIP版) を PATH に追加して使う。
- GTO Wizard 互換の制約(exporter のコメント参照): 数値ID、座席1..9、アンティは1人1行、Dealt to はヒーローのみ、PKOはヘッダー三連+座席行の bounty。
- React Compiler の lint(`react-hooks/set-state-in-effect`)が有効。effect 内 setState は避け、`useHydrated()` と open 時のみマウントするパターンを使う。
