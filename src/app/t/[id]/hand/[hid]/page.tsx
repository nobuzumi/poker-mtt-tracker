'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import CardPicker, { CardRow } from '@/components/CardPicker';
import { Empty, Page, Pill, Section, TopBar, confirmDialog, useToast } from '@/components/ui';
import { exportHand, icmContext } from '@/lib/exporter';
import { bb, chips, signed } from '@/lib/format';
import { positionMap } from '@/lib/positions';
import { deleteHand, upsertHand, useStore } from '@/lib/store';
import { copyText, shareTextFile } from '@/lib/share';

const TAGS = ['要検討', 'プリフロップ', 'ICM', 'ブラフ', 'バリュー', 'コールダウン', 'ミス?', 'クーラー'];

export default function HandPage() {
  const { id, hid } = useParams<{ id: string; hid: string }>();
  const router = useRouter();
  const s = useStore();
  const t = s.tournaments[id];
  const h = s.hands[hid];
  const [toast, show] = useToast();
  const [heroPicker, setHeroPicker] = useState(false);

  if (!t || !h) {
    return (
      <>
        <TopBar title="ハンド" back={`/t/${id}`} />
        <Page><Empty>読み込み中…</Empty></Page>
      </>
    );
  }

  const hero = h.players.find((p) => p.seat === h.heroSeat);
  const posMap = positionMap(h.players.map((p) => p.seat), h.buttonSeat);
  const text = exportHand(h, t);
  const ctx = icmContext(h, t);
  const tags = h.tags ?? [];

  return (
    <>
      {toast}
      <TopBar title={`ハンド #${h.handNo}`} back={`/t/${id}`} sub={`${t.name} ・ Lv${h.level} ${h.smallBlind}/${h.bigBlind}`} />
      <Page>
        <Section>
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-3" onClick={() => setHeroPicker(true)}>
              <CardRow cards={hero?.cards ?? []} count={2} size="lg" />
              <div className="text-left">
                <p className="text-sm font-semibold">{posMap[h.heroSeat]} ・ {hero?.name}</p>
                <p className="text-xs text-muted">{chips(hero?.startStack ?? 0)} ({bb(hero?.startStack ?? 0, h.bigBlind)})</p>
              </div>
            </button>
            <div className="text-right">
              <p className={`text-xl font-bold tabular-nums ${h.heroNet >= 0 ? 'text-accent' : 'text-danger'}`}>{signed(h.heroNet)}</p>
              <p className="text-xs text-muted">{bb(h.heroNet, h.bigBlind)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <CardRow cards={h.board} count={5} size="md" />
            <div className="flex flex-wrap gap-1">
              {h.wentToShowdown && <Pill tone="info">Showdown</Pill>}
              {h.playersRemaining && <Pill>残り{h.playersRemaining}人</Pill>}
            </div>
          </div>
          {(!hero?.cards || hero.cards.length !== 2) && (
            <p className="mt-2 text-sm text-warn">ヒーローのカードが未入力です。上のカードをタップして入力してください(GTO Wizard 解析に必須)。</p>
          )}
        </Section>

        <Section title="タグ・メモ">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {TAGS.map((tg) => (
              <button
                key={tg}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${tags.includes(tg) ? 'bg-info/30 text-info' : 'bg-elev2 text-muted'}`}
                onClick={() => upsertHand({ ...h, tags: tags.includes(tg) ? tags.filter((x) => x !== tg) : [...tags, tg] })}
              >
                {tg}
              </button>
            ))}
          </div>
          <textarea
            className="field min-h-16"
            defaultValue={h.note ?? ''}
            placeholder="メモ"
            onBlur={(e) => {
              if ((e.target.value.trim() || undefined) !== h.note) upsertHand({ ...h, note: e.target.value.trim() || undefined });
            }}
          />
        </Section>

        <Section
          title="ハンドヒストリー (PokerStars形式)"
          right={
            <div className="flex gap-3">
              <button className="text-xs font-semibold text-accent" onClick={async () => show((await copyText(text)) ? 'コピーしました' : 'コピー失敗')}>コピー</button>
              <button className="text-xs font-semibold text-accent" onClick={async () => {
                const r = await shareTextFile(`${t.date}_hand${h.handNo}.txt`, text + '\n');
                show(r === 'failed' ? '共有できませんでした' : '共有しました');
              }}>共有</button>
            </div>
          }
        >
          <pre className="overflow-x-auto whitespace-pre text-[11px] leading-4 text-fg/90">{text}</pre>
        </Section>

        <Section
          title="ICM / バウンティ用メモ (GTO Wizard AI に手入力)"
          right={<button className="text-xs font-semibold text-accent" onClick={async () => show((await copyText(ctx)) ? 'コピーしました' : 'コピー失敗')}>コピー</button>}
        >
          <pre className="overflow-x-auto whitespace-pre text-[11px] leading-4 text-fg/90">{ctx}</pre>
        </Section>

        <button
          className="btn-ghost w-full text-danger"
          onClick={() => {
            if (confirmDialog('このハンドを削除しますか?')) {
              deleteHand(h.id);
              router.replace(`/t/${id}`);
            }
          }}
        >
          このハンドを削除
        </button>
      </Page>

      <CardPicker
        open={heroPicker}
        title="あなたのホールカード"
        count={2}
        initial={hero?.cards ?? []}
        used={[...h.board, ...h.players.filter((p) => p.seat !== h.heroSeat).flatMap((p) => p.cards ?? [])]}
        onClose={() => setHeroPicker(false)}
        onDone={(c) => {
          upsertHand({ ...h, players: h.players.map((p) => (p.seat === h.heroSeat ? { ...p, cards: c.length === 2 ? c : null } : p)) });
          setHeroPicker(false);
        }}
      />
    </>
  );
}
