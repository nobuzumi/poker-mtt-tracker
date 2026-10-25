// 使い方ガイド。静的な内容なのでサーバーコンポーネントのまま(SW にキャッシュされればオフラインでも開ける)。
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Page, Section, TopBar } from '@/components/ui';

export const metadata: Metadata = { title: '使い方 – MTT Hand Tracker' };

const TOC = [
  ['overview', '全体の流れ'],
  ['start', 'はじめに'],
  ['tournament', 'トーナメント作成'],
  ['setup', 'ハンド設定'],
  ['record', 'アクション記録'],
  ['showdown', 'ショウダウンと保存'],
  ['hand', 'ハンド詳細'],
  ['export', 'GTO Wizard へ'],
  ['sync', '同期・バックアップ'],
  ['faq', '困ったとき'],
] as const;

/** 画面上のボタン名・ラベルを示すチップ */
function B({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-block rounded-md bg-elev2 px-1.5 py-0.5 text-[0.85em] font-semibold text-fg">{children}</span>;
}
function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-4 text-sm font-semibold text-fg first:mt-0">{children}</h3>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-sm leading-6 text-fg/90">{children}</p>;
}
function Steps({ children }: { children: ReactNode }) {
  return <ol className="mb-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-fg/90">{children}</ol>;
}
function Bullets({ children }: { children: ReactNode }) {
  return <ul className="mb-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-fg/90">{children}</ul>;
}
function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const cls = tone === 'warn' ? 'border-warn/40 bg-warn/10' : 'border-info/40 bg-info/10';
  return <div className={`mb-2 rounded-xl border p-3 text-xs leading-5 text-fg/90 ${cls}`}>{children}</div>;
}

export default function HelpPage() {
  return (
    <>
      <TopBar title="使い方" back="/" sub="MTT Hand Tracker ガイド" />
      <Page>
        <nav className="scroll-hide -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full bg-elev2 px-3 py-1.5 text-xs font-semibold text-fg">
              {label}
            </a>
          ))}
        </nav>

        <Section id="overview" title="全体の流れ">
          <ol className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {['トーナメント作成', 'ハンド設定', 'アクション記録', '保存', 'エクスポート'].map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted">→</span>}
                <span className="rounded-lg bg-elev2 px-2 py-1">{s}</span>
              </li>
            ))}
          </ol>
          <P>
            このアプリは、ライブトーナメントで起きたハンドを iPhone で記録し、<b>GTO Wizard の Hand History Analyzer が読める
            PokerStars 形式のテキスト</b>に書き出すためのものです。トーナメントを1回作ったら、あとは「ハンド設定 → アクション記録 → 保存」を
            ハンドごとに繰り返し、帰ってからまとめてエクスポートします。
          </P>
          <P>
            入力項目はすべて GTO Wizard から逆算しています。解析に<b>必ず必要</b>なのは「自分のカード・全員のスタック・アクション・ボード」の4つ。
            それ以外(残り人数、賞金構造、タグ、メモ)は任意です。
          </P>
        </Section>

        <Section id="start" title="はじめに(初回だけ)">
          <H>1. ホーム画面に追加する</H>
          <P>
            Safari でこのアプリを開き、共有ボタン(□に↑)→ <B>ホーム画面に追加</B>。ホームのアイコンから起動すると全画面のアプリとして動きます。
            一度オンラインで開いておけば、電波の弱い会場でも起動・記録できます。
          </P>
          <H>2. 同期(任意)</H>
          <P>
            データは端末に保存されるので、ログインしなくても全機能が使えます。PC と iPhone でデータを共有したい場合だけ、
            ホーム右上の <B>ローカル</B> をタップ → メールアドレスとパスワードで <B>新規登録</B>(2回目以降は <B>ログイン</B>)。
            ログインすると右上が <B>同期ON</B> になります。
          </P>
          <Note>ホーム画面に追加したアプリは Safari とは別の保存領域で動くため、アイコンから起動した初回はもう一度ログインが必要です。</Note>
          <H>3. 既定値</H>
          <P>
            同じアカウント画面の「既定値」で、あなたの表示名(初期値 Hero)・通貨・テーブル人数を設定できます。
            新しいトーナメントを作るときの初期値になります。
          </P>
        </Section>

        <Section id="tournament" title="トーナメントを作る">
          <P>ホームの <B>＋ 新しいトーナメント</B> から。必須は <b>トーナメント名・あなたの表示名・初期スタック</b> の3つだけです。</P>
          <Bullets>
            <li><b>あなたの表示名</b> … ハンドヒストリー内の自分の名前。GTO Wizard はこの名前の「Dealt to」行で自分を判定するので、<b>英数字</b>を推奨。</li>
            <li><b>バイイン</b> … 賞金プール分と手数料を分けて入力。PKO の場合は形式を <B>PKO / バウンティ</B> にして、初期バウンティも入れる。</li>
            <li><b>テーブル最大人数</b> … 6 / 8 / 9 から選ぶ。GTO Wizard の MTT ソリューションは 6-max と 8-max 基準で、9-max は「UTG がフォールドしたハンド」だけが解析対象になります。</li>
            <li><b>アンティ方式</b> … 会場のルール通りに。BB アンティ / 全員アンティ / なし。</li>
            <li><b>総エントリー数・賞金構造</b> … ICM 用。わかり次第でよく、あとから右上の <B>設定</B> で追記できます。</li>
          </Bullets>
          <P>
            作成するとトーナメント画面に移ります。右上の <B>設定</B> から内容の修正、終了後の最終順位・獲得賞金の記録、トーナメントの削除ができます。
          </P>
        </Section>

        <Section id="setup" title="ハンド設定(ハンドごとに、記録の前)">
          <P>トーナメント画面の下の <B>ハンド #n を記録</B> を押すと、このハンドのテーブル状況を入力する画面になります。</P>
          <H>ブラインド</H>
          <P>
            Lv・SB・BB・アンティ。2ハンド目以降は前のハンドの値を引き継ぐので、<b>レベルが上がったときだけ</b>直します。
            <B>Lv↑</B> はレベルを +1 してブラインドを2倍にする省力ボタンなので、実際のストラクチャーに合わせて数字を直してください。
            「残り人数」は任意で、ICM メモに使われます。
          </P>
          <H>座席</H>
          <P>1行が1座席です。左から順に:</P>
          <Bullets>
            <li><b>座席番号</b> … タップで着席 / 離席の切り替え。空席は外しておく(薄く表示)。</li>
            <li><b>BTN</b> … ディーラーボタンの席でタップ。他の席には SB / BB / UTG … CO のポジション名が自動で付きます。</li>
            <li><b>名前</b> … 相手を区別できる短い名前(例: 赤帽、P3 のまま でも可)。</li>
            <li><b>スタック</b> … いまのチップ量。</li>
            <li><b>賞金</b>(PKO のときだけ)… その人がいま持っているバウンティ額。</li>
            <li><b>★</b> … 自分の席。</li>
          </Bullets>
          <Note>
            座席番号は実際のテーブルの席番号と同じでなくても構いません。ただし<b>時計回りの順番</b>だけは実際と同じにしてください(手番の順に影響します)。
          </Note>
          <P>
            前のハンドを保存すると、終了時のスタックが自動で入り、ボタンは次の席に移動し、スタックが 0 になった人は自動で離席になります。
            実際と違うところ(リバイ、席替え、新しい人)だけ直せば OK です。
          </P>
          <H>あなたのハンド</H>
          <P>ここで入れても、記録中に入れても構いません。<b>保存時には必須</b>です。</P>
          <P>
            画面下に黄色い注意(プレイヤーは2人以上、ボタン未選択、★未選択、BB 未入力、スタック 0 の人がいる)が出ている間は開始できません。
            解消したら <B>アクション記録を開始</B>。
          </P>
        </Section>

        <Section id="record" title="アクション記録">
          <H>画面の見方</H>
          <Bullets>
            <li><b>上段</b> … POT の合計(チップと bb 換算)とボード。</li>
            <li><b>座席一覧</b> … 緑の帯がついている行が<b>いまの手番</b>。左がポジション(黄色 = BTN)、名前(★ = 自分)、残りスタック、カード、右端はこのストリートに入れた額 / FOLD / ALL-IN。</li>
            <li><b>アクション</b> … これまでのログ。F = フォールド、X = チェック、C = コール、B = ベット、R→ = レイズ(到達額)。末尾の「!」はオールイン、「|」はストリートの区切り。</li>
            <li><b>下段</b> … 手番の人のアクションボタン。</li>
          </Bullets>
          <H>記録の仕方</H>
          <P>手番は自動で回ります。<b>その人が実際にした行動のボタンを押すだけ</b>です。</P>
          <Bullets>
            <li><B>Fold</B> / <B>Check</B> / <B>Call</B> … コールに必要な額は上に表示されます。<B>Call AI</B> と出ているときは、コールするとオールインになります。</li>
            <li><B>Bet</B> / <B>Raise</B> … 金額シートが開きます(下記)。</li>
            <li><B>All-in</B> … 残り全部。</li>
          </Bullets>
          <H>金額シート(ベット / レイズ)</H>
          <Bullets>
            <li>上のクイックボタンは、プリフロップでは <b>BB の倍数</b>(2x〜4x。3bet 以降は直前のレイズ額の倍数)、フロップ以降では <b>ポットに対する %</b>。</li>
            <li>正確な額はテンキーで。<B>00</B> <B>000</B> で桁を足し、<B>百の位丸め</B> で端数を整えられます。</li>
            <li>入れる数字は<b>そのストリートでの合計額(raise to)</b>です。相手の 600 に対して「1,500 にレイズ」なら 1500。</li>
            <li>「最低」未満・「最大」超えは確定できません。最大 = オールインです。</li>
          </Bullets>
          <Note>GTO Wizard はベットサイズを最寄りの解析済みサイズに丸めるので、クイックボタンの近似値でも十分です。正確さより記録を止めないことを優先してください。</Note>
          <H>ボードの入力</H>
          <P>
            ベッティングが終わると下に <B>フロップのカードを入力(3枚)</B> のようなボタンが出ます。カード一覧から必要な枚数をタップすると自動で閉じます。
            すでに使われているカード(自分の手札など)は選べません。全員がオールインになった場合は、残りのボードを順に入力するだけです。
          </P>
          <H>自分のカード・やり直し</H>
          <Bullets>
            <li>自分のカードは、座席一覧の<b>自分の行のカード</b>をタップすればいつでも入力・変更できます。</li>
            <li>右上の <B>↶ 戻す</B> で1手ずつ取り消せます(ボードの入力も含め、何手でも)。</li>
            <li>記録の途中でアプリを閉じても下書きは端末に残ります。トーナメント画面の <B>記録中のハンドを再開</B> から続けられます。</li>
            <li>最初からやり直すときは一番下の <B>このハンドを破棄</B>。</li>
          </Bullets>
          <Note tone="warn">
            最小レイズ額に満たないオールインは自動的に「コール」として記録されます。コールされなかった分のベットは自動で返還されます。
            ストラドルやデッドブラインドには対応していません。
          </Note>
        </Section>

        <Section id="showdown" title="ショウダウンと保存">
          <P>ハンドが終わると(1人を残して全員フォールド、またはリバーのアクション終了)、画面に「結果」または「ショウダウン」の欄が出ます。</P>
          <H>ショウダウンのとき</H>
          <Steps>
            <li>相手のカードが見えたら、座席一覧でその人のカードをタップして入力(ショウダウン後のみ可。2枚そろったときだけ記録されます)。</li>
            <li>残っている全員のカードが入っていれば<b>勝者は自動判定</b>されます(サイドポットも計算)。</li>
            <li>相手がマックしてカードが不明なら、勝者のボタンをタップして選びます。チョップは複数選択。</li>
            <li>その下に各プレイヤーの獲得額のプレビューが出るので、実際と合っているか確認。</li>
          </Steps>
          <H>タグとメモ</H>
          <P>
            「要検討」「ICM」「ブラフ」などのタグと自由メモを付けられます。あとで GTO Wizard で見直すハンドに「要検討」を付けておくと一覧で探しやすくなります。
          </P>
          <H>保存</H>
          <P>
            <B>保存して次のハンドへ</B> を押すと保存されます。<b>自分のカードが2枚入っていないと押せません</b>(黄色い警告が出ます)。
            保存すると、終了時のスタックとボタンの位置が次のハンド設定に引き継がれます。
          </P>
          <Note tone="warn">保存したあとはアクションの修正はできません。間違いに気づいたら、そのハンドを削除して取り直してください。カード・タグ・メモはあとからでも修正できます。</Note>
        </Section>

        <Section id="hand" title="ハンド詳細と一覧">
          <P>
            トーナメント画面の「ハンド」一覧には、番号・自分のカード・ポジション・レベル・到達ストリート(P / F / T / R)・SD(ショウダウン)・タグ・収支が並びます。
            タップすると詳細画面です。
          </P>
          <Bullets>
            <li><b>⚠ ヒーローカード未入力</b> … GTO Wizard で解析できません。詳細画面の上のカードをタップして入力してください。</li>
            <li><b>⚠ マルチウェイ</b> … フロップ以降に3人以上残ったハンド。記録はできますが GTO Wizard の解析対象外です。</li>
          </Bullets>
          <P>
            詳細画面では、自分のカードの修正、タグ・メモの編集、PokerStars 形式のハンドヒストリーの <B>コピー</B> / <B>共有</B>、
            ICM / バウンティ用メモの <B>コピー</B>、ハンドの削除ができます。
          </P>
        </Section>

        <Section id="export" title="GTO Wizard へエクスポート">
          <H>全ハンドをまとめて</H>
          <Steps>
            <li>トーナメント画面の「ハンド (n)」の右にある <B>エクスポート</B> をタップ。</li>
            <li><B>.txt ファイルとして共有 / 保存</B> → AirDrop で PC に送る、「ファイル」に保存、メールで送る など。または <B>全ハンドのテキストをコピー</B>。</li>
            <li>GTO Wizard の Hand History Analyzer → <b>Upload</b> → <b>Files</b> に .txt を渡す。コピーした場合は <b>Single Hand</b> タブに貼り付け。</li>
          </Steps>
          <H>1ハンドだけ</H>
          <P>ハンド詳細画面の「ハンドヒストリー」の <B>コピー</B> または <B>共有</B>。</P>
          <H>ICM / PKO の解析</H>
          <P>
            残り人数・賞金構造・バウンティはハンドヒストリーの形式に含められません。ハンド詳細画面の「ICM / バウンティ用メモ」を <B>コピー</B> して、
            GTO Wizard AI(ICM / PKO ソルバー)に手入力してください。
          </P>
          <Note>
            同じハンドを再アップロードしても GTO Wizard 側で「重複」として無視されるので、エクスポートは何度行っても大丈夫です。
            ヘッダーの通貨は常に $ 表記になります(金額は入力値のまま)。GTO Wizard は通貨を検証しないので問題ありません。
          </Note>
        </Section>

        <Section id="sync" title="同期とバックアップ">
          <Bullets>
            <li>データはまず端末に保存されます。電波がなくても記録できます。</li>
            <li>ログイン中は、<b>ホーム画面を開いたとき</b>に自動で同期されます。すぐ反映したいときはアカウント画面の <B>今すぐ同期</B>。</li>
            <li><B>全件取得し直す</B> は、クラウドの全データを取り直します。別の端末で記録した内容が見当たらないときに。</li>
            <li>別の端末で使うには、同じメールアドレス・パスワードでログインするだけです。ログアウトしても端末のデータは消えません。</li>
            <li><b>バックアップ (JSON)</b> … 端末内の全データをファイルに書き出し / 取り込み。取り込みは既存データに追加(マージ)されます。同期を使わない場合の保険に。</li>
          </Bullets>
          <Note tone="warn">
            「同期エラー」が出ても、記録は端末に残っています。電波が戻ってから、またはしばらくしてから <B>今すぐ同期</B> を押してください。
            長く続く場合はクラウド側(Supabase)が一時停止している可能性があります。
          </Note>
        </Section>

        <Section id="faq" title="困ったとき">
          <H>「アクション記録を開始」が押せない</H>
          <P>画面下の黄色い注意を解消してください(2人以上着席、BTN、★、BB、スタック 0 の人を外す)。</P>
          <H>「保存して次のハンドへ」が押せない</H>
          <P>自分のカードが未入力か、ショウダウンの勝者が選ばれていません。</P>
          <H>手番が実際と違う</H>
          <P>
            <B>↶ 戻す</B> で間違えたところまで戻ってください。ボタンの位置や着席している人が違っていた場合は、<B>このハンドを破棄</B> してハンド設定からやり直します。
          </P>
          <H>誰かが席を立った / 新しい人が来た / リバイした</H>
          <P>次のハンド設定で、座席番号をタップして離席・着席を切り替え、名前とスタックを直します。</P>
          <H>10人テーブル</H>
          <P>GTO Wizard が Seat 10 を認識しないため、現在は対応していません(最大 9 人)。</P>
          <H>画面が古い / 動作がおかしい</H>
          <P>アプリを完全に閉じて(アプリスイッチャーで上にスワイプ)、オンラインの状態で開き直してください。</P>
          <H>電波がない</H>
          <P>そのまま記録できます。同期は電波が戻ってから自動で行われます。初回だけはオンラインで開いておいてください。</P>
          <p className="mt-4 text-center text-xs text-muted">
            <Link href="/" className="font-semibold text-accent">ホームへ戻る</Link>
          </p>
        </Section>
      </Page>
    </>
  );
}
