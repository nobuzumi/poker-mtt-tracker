'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { CardRow } from '@/components/CardPicker';
import { BottomBar, Empty, Page, Pill, Section, Sheet, TopBar, useToast } from '@/components/ui';
import { exportTournament } from '@/lib/exporter';
import { bb, chips, signed } from '@/lib/format';
import { positionMap } from '@/lib/positions';
import { handsOf, useStore } from '@/lib/store';
import { loadDraft } from '@/lib/draft';
import { copyText, shareTextFile } from '@/lib/share';
import { HandRecord } from '@/lib/types';

function handWarnings(h: HandRecord): string[] {
  const w: string[] = [];
  const hero = h.players.find((p) => p.seat === h.heroSeat);
  if (!hero?.cards || hero.cards.length !== 2) w.push('ヒーローカード未入力');
  // ポストフロップが3人以上 → GTO Wizard は解析対象外
  const foldedPre = new Set(h.actions.filter((a) => a.street === 'preflop' && a.type === 'fold').map((a) => a.seat));
  const toFlop = h.players.filter((p) => !foldedPre.has(p.seat)).length;
  if (h.board.length >= 3 && toFlop >= 3) w.push('マルチウェイ');
  return w;
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const s = useStore();
  const t = s.tournaments[id];
  const hands = handsOf(s, id);
  const [toast, show] = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  // 下書きの有無はストレージ依存なので SSR では false、クライアントで実値
  const hasDraft = useSyncExternalStore(() => () => {}, () => !!loadDraft(id), () => false);

  if (!t) {
    return (
      <>
        <TopBar title="トーナメント" back="/" />
        <Page><Empty>読み込み中…</Empty></Page>
      </>
    );
  }

  const net = hands.reduce((a, h) => a + h.heroNet, 0);
  const hero = t.lastState?.players.find((p) => p.isHero);
  const exportText = () => exportTournament(hands, t);
  const fileName = `${t.date}_${t.name.replace(/[^\w\-]+/g, '_')}.txt`;

  return (
    <>
      {toast}
      <TopBar
        title={t.name}
        back="/"
        sub={`${t.date}${t.venue ? ` ・ ${t.venue}` : ''}`}
        right={<Link href={`/t/${id}/edit`} className="tap flex items-center px-3 text-sm text-accent">設定</Link>}
      />
      <Page>
        <Section>
          <div className="flex flex-wrap gap-1.5">
            <Pill>{t.tableSizeMax}-max</Pill>
            <Pill>{t.isPko ? `PKO ${t.currency} ${t.buyIn}+${t.bounty}+${t.fee}` : `${t.currency} ${t.buyIn}+${t.fee}`}</Pill>
            <Pill>{t.anteType === 'bb' ? 'BBアンティ' : t.anteType === 'classic' ? '全員アンティ' : 'アンティなし'}</Pill>
            {t.totalEntries && <Pill>{t.totalEntries} entries</Pill>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-elev2 p-2">
              <p className="text-[11px] text-muted">レベル</p>
              <p className="text-sm font-semibold">{t.lastState ? `Lv${t.lastState.level}` : '-'}</p>
              <p className="text-[11px] text-muted">{t.lastState ? `${t.lastState.smallBlind}/${t.lastState.bigBlind}${t.lastState.ante ? `/${t.lastState.ante}` : ''}` : ''}</p>
            </div>
            <div className="rounded-xl bg-elev2 p-2">
              <p className="text-[11px] text-muted">スタック</p>
              <p className="text-sm font-semibold tabular-nums">{hero ? chips(hero.stack) : chips(t.startingStack)}</p>
              <p className="text-[11px] text-muted">{hero && t.lastState ? bb(hero.stack, t.lastState.bigBlind) : ''}</p>
            </div>
            <div className="rounded-xl bg-elev2 p-2">
              <p className="text-[11px] text-muted">収支 / {hands.length}h</p>
              <p className={`text-sm font-semibold tabular-nums ${net >= 0 ? 'text-accent' : 'text-danger'}`}>{signed(net)}</p>
              <p className="text-[11px] text-muted">{t.lastState?.playersRemaining ? `残り${t.lastState.playersRemaining}人` : ''}</p>
            </div>
          </div>
        </Section>

        <Section
          title={`ハンド (${hands.length})`}
          right={hands.length > 0 && <button className="text-xs font-semibold text-accent" onClick={() => setExportOpen(true)}>エクスポート</button>}
        >
          {hands.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">まだハンドがありません</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...hands].reverse().map((h) => {
                const heroP = h.players.find((p) => p.seat === h.heroSeat);
                const pos = positionMap(h.players.map((p) => p.seat), h.buttonSeat)[h.heroSeat];
                const warns = handWarnings(h);
                const street = h.board.length >= 5 ? 'R' : h.board.length === 4 ? 'T' : h.board.length === 3 ? 'F' : 'P';
                return (
                  <li key={h.id}>
                    <Link href={`/t/${id}/hand/${h.id}`} className="flex items-center gap-3 py-2.5 active:bg-elev2">
                      <span className="w-8 text-xs text-muted tabular-nums">#{h.handNo}</span>
                      <CardRow cards={heroP?.cards ?? []} count={2} size="sm" />
                      <span className="w-12 text-sm font-semibold">{pos}</span>
                      <span className="flex-1 truncate text-xs text-muted">
                        Lv{h.level} ・ {street}{h.wentToShowdown ? ' ・ SD' : ''}{h.tags?.length ? ` ・ ${h.tags.join(' ')}` : ''}
                      </span>
                      {warns.map((w) => <Pill key={w} tone="warn">{w}</Pill>)}
                      <span className={`w-16 text-right text-sm font-semibold tabular-nums ${h.heroNet >= 0 ? 'text-accent' : 'text-danger'}`}>{signed(h.heroNet)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </Page>

      <BottomBar>
        <Link href={`/t/${id}/${hasDraft ? 'record' : 'setup'}`} className="btn-primary w-full text-lg">
          {hasDraft ? '記録中のハンドを再開' : `ハンド #${t.handCount + 1} を記録`}
        </Link>
      </BottomBar>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="GTO Wizard へエクスポート">
        <p className="mb-3 text-xs text-muted">
          {hands.length} ハンドを PokerStars 形式で書き出します。GTO Wizard → Upload → Files にファイルを渡すか、
          Single Hand タブにテキストを貼り付けてください。
        </p>
        <div className="space-y-2">
          <button
            className="btn-primary w-full"
            onClick={async () => {
              const r = await shareTextFile(fileName, exportText());
              show(r === 'shared' ? '共有しました' : r === 'downloaded' ? 'ダウンロードしました' : '共有できませんでした');
              setExportOpen(false);
            }}
          >
            .txt ファイルとして共有 / 保存
          </button>
          <button
            className="btn-secondary w-full"
            onClick={async () => {
              show((await copyText(exportText())) ? 'クリップボードにコピーしました' : 'コピーできませんでした');
              setExportOpen(false);
            }}
          >
            全ハンドのテキストをコピー
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          ⚠ 同じハンドを再アップロードすると GTO Wizard 側で「重複」として無視されます。残り人数や賞金構造は各ハンドの詳細画面の「ICMメモ」からコピーして GTO Wizard AI に手入力してください。
        </p>
      </Sheet>
    </>
  );
}
