# MTT Hand Tracker

ライブMTT(トーナメント)のハンドを iPhone で記録し、**GTO Wizard の Hand History Analyzer が読める PokerStars 形式**で書き出す PWA(Webアプリ)です。

- どこからでも使える: Vercel にデプロイした URL を iPhone の「ホーム画面に追加」で起動
- 会場の電波が弱くても動く: データは端末(localStorage)に保存。ログインしていれば Supabase に同期
- GTO Wizard から逆算した入力項目: テーブル人数 / アンティ方式 / 全員のスタック / ベットサイズ / ボード / ショウダウン / PKO バウンティ / 残り人数 / 賞金構造

## 画面と流れ

1. **トーナメント作成** … 名前、バイイン内訳(賞金分+手数料)、PKOなら初期バウンティ、テーブル人数(6/8/9)、アンティ方式(BB/全員/なし)、初期スタック、総エントリー数、賞金構造
2. **ハンド設定** … レベル・ブラインド・アンティ、残り人数、各座席の名前とスタック(前ハンドから自動引き継ぎ)、ボタン位置、自分の座席(★)、自分のカード
3. **アクション記録** … 手番が自動で回る。Fold / Check・Call / Bet・Raise(x BB・ポット% のクイックボタン+テンキー) / All-in。ボードはカード選択、ショウダウンは相手のカード入力か勝者選択。「戻す」で1手ずつ Undo
4. **保存** … 終了スタックを次ハンドへ引き継ぎ、ボタンを移動
5. **エクスポート** … トーナメント画面右上の「エクスポート」から .txt を共有(AirDrop / ファイル保存)またはテキストをコピー → GTO Wizard の Upload へ

ハンド詳細画面には、HHに載せられない **ICM/バウンティ用メモ**(残り人数・残り%・各スタックのBB換算・賞金構造)があり、GTO Wizard AI(ICM/PKOソルバー)に手入力する際にコピーできます。

## GTO Wizard 互換のために守っていること

| 項目 | 対応 |
|---|---|
| 形式 | PokerStars トーナメント形式、英語のみ |
| Hand # / Tournament # | 数値のみ(時刻+乱数で一意)。再アップロードは GTO Wizard 側で重複として無視される |
| 座席 | 1〜9(ボタンが Seat 10 だと認識されないため、10-max は非対応) |
| アンティ | 1人1行の `posts the ante`。BBアンティは人数で按分(端数はBBに)して出力 |
| ヒーロー | `Dealt to <名前> [..]` はヒーローのみ。相手のカードはショウダウンでのみ |
| PKO | ヘッダーを `$賞金分+$バウンティ+$手数料 USD`、座席行に `, $X bounty` |
| ベットサイズ | 実額を記録(GTO Wizard が最寄りの解析済みサイズに丸める) |
| 返還ベット | `Uncalled bet (N) returned to ...` を出力し、`Total pot` は回収額の合計 |
| 通貨 | ヘッダーの通貨は常に `$`/`USD` 表記(金額は入力値のまま)。GTO Wizard は検証しない |
| 9-max | GTO Wizard は 8-max ツリーで解析するため、UTG がフォールドしたハンドのみ対象 |
| マルチウェイ | ポストフロップ3人以上は GTO Wizard の解析対象外(ハンド一覧に ⚠ 表示) |

## 開発

```bash
npm install
npm run dev        # http://localhost:3000
npx vitest run     # エンジン・エクスポーター・UIフローのテスト
npm run build
```

Node.js は ZIP 版(`C:\Users\nobuz\tools\nodejs`)を PATH に通して使います。

主要ファイル:

- `src/lib/engine.ts` … ベッティングエンジン(手番、ブラインド/アンティ、返還ベット、サイドポット)
- `src/lib/exporter.ts` … PokerStars 形式テキスト生成、ICMメモ
- `src/lib/handEval.ts` … 7枚役判定(ショウダウン自動判定・役名)
- `src/lib/store.ts` … localStorage ストア / `src/lib/sync.ts` … Supabase 同期
- `src/app/t/[id]/setup` `record` `hand/[hid]` … ハンド設定・記録・詳細画面

## デプロイ手順(GitHub → Vercel → Supabase)

### 1. GitHub にプッシュ

```bash
git add -A
git commit -m "Initial commit"
# GitHub で空のリポジトリ poker-mtt-tracker を作成してから
git remote add origin https://github.com/<ユーザー名>/poker-mtt-tracker.git
git push -u origin main
```

### 2. Vercel

1. Vercel ダッシュボード → **Add New → Project** → GitHub のリポジトリを Import
2. Framework は Next.js が自動検出されるのでそのまま **Deploy**
3. 発行された URL(`https://xxx.vercel.app`)を iPhone の Safari で開き、共有 → **ホーム画面に追加**

この時点では **ローカル保存のみ** で全機能が使えます。

### 3. Supabase(同期を使う場合)

1. Supabase ダッシュボード → **New project**(リージョンは Tokyo 推奨)
2. **SQL Editor** で `supabase/schema.sql` の内容を貼り付けて実行(テーブル2つ + RLS)
3. **Authentication → Providers → Email** を有効化。自分専用なら **Confirm email をオフ** にするとメール確認なしで登録できます
4. **Project Settings → API** から `Project URL` と `anon public` キーをコピー
5. Vercel → プロジェクト → **Settings → Environment Variables** に追加して **Redeploy**

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |

6. アプリの右上「ローカル」→ アカウント画面でメール+パスワードを **新規登録** → 以降は起動時に自動同期

ローカル開発で同期も試す場合は `.env.example` を `.env.local` にコピーして値を入れてください。

### 4. Supabase Free プランの自動停止対策(keepalive)

Supabase Free プランは「直近1週間の DB 活動が不十分」だとプロジェクトを自動で一時停止します(公式の目安は「1日に数回のユーザーリクエスト」)。停止すると同期だけが失敗し(ローカル記録・エクスポートは使える)、ダッシュボードの **Restore project** で復帰できます。

これを防ぐため `/api/keepalive`(`src/app/api/keepalive/route.ts`)が両テーブルに複数クエリを投げ、2系統のスケジューラから呼ばれます:

| 経路 | 設定ファイル | 頻度 | 確認場所 |
|---|---|---|---|
| Vercel Cron | `vercel.json` | 毎日 UTC 3:00(±59分) | Vercel → プロジェクト → Settings → Cron Jobs |
| GitHub Actions | `.github/workflows/keepalive.yml` | 1日4回(UTC 0/6/12/18 時台) | GitHub → リポジトリ → Actions → Supabase keepalive |

- GitHub Actions は失敗するとメールが届くので監視も兼ねます。手動実行は Actions タブの **Run workflow** から。
- public リポジトリは60日間コミット等が無いとスケジュール実行が自動停止するので、その通知が来たら Actions タブで再有効化してください。
- Vercel に `CRON_SECRET` を設定する場合は、同じ値を GitHub の **Settings → Secrets and variables → Actions** に `CRON_SECRET` として登録してください(未設定なら不要)。
- 「Your project is scheduled to be paused」のメールが来たときの応急処置は、ブラウザで `https://poker-mtt-tracker.vercel.app/api/keepalive` を何度か開くか、Supabase ダッシュボードでプロジェクトを開くことです。

## 既知の制限 / 今後

- ストラドル、デッドブラインド、ミスドブラインドの投稿は未対応(ボタン位置と座席の有効/無効で調整)
- GTO Wizard が BBアンティの単一行(`BB: posts the ante N`)を正しく解釈するかは未確認のため、按分出力を既定にしています(`exportHand` の `bbAnteMode: 'single'` で切替可能)
- 同期は last-write-wins(同じハンドを複数端末で同時編集すると後勝ち)
