'use client';
// ハンド開始前のテーブル設定。
// 前ハンドからスタック・ボタン位置・ブラインドを引き継ぎ、必要なところだけ直して開始する。
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import CardPicker, { CardRow } from '@/components/CardPicker';
import { nowMs, useHydrated } from '@/lib/hydrated';
import { BottomBar, Empty, Field, Page, Section, Segmented, TopBar } from '@/components/ui';
import { initEngine, orderAfter } from '@/lib/engine';
import { saveDraft } from '@/lib/draft';
import { chips, toInt } from '@/lib/format';
import { positionMap } from '@/lib/positions';
import { useStore } from '@/lib/store';
import { AnteType, Card, HandPlayer, HandSetup, Tournament } from '@/lib/types';

interface SeatDraft {
  seat: number;
  active: boolean;
  name: string;
  stack: string;
  bounty: string;
  isHero: boolean;
}

function initialDrafts(t: Tournament) {
  const st = t.lastState;
  const drafts: SeatDraft[] = [];
  for (let seat = 1; seat <= t.tableSizeMax; seat++) {
    const p = st?.players.find((x) => x.seat === seat);
    drafts.push({
      seat,
      active: st ? !!p && p.stack > 0 : true,
      name: p?.name ?? (seat === 1 && !st ? t.heroName : `P${seat}`),
      stack: p ? String(p.stack) : String(t.startingStack),
      bounty: p?.bounty != null ? String(p.bounty) : t.isPko ? String(t.bounty) : '',
      isHero: p ? p.isHero : seat === 1,
    });
  }
  // ボタンは前ハンドの次の有効座席へ
  let button = 1;
  if (st) {
    const activeSeats = drafts.filter((d) => d.active).map((d) => d.seat);
    button = orderAfter(activeSeats, st.buttonSeat)[0] ?? activeSeats[0] ?? 1;
  }
  return {
    drafts,
    button,
    level: String(st?.level ?? 1),
    sb: String(st?.smallBlind ?? 100),
    bb: String(st?.bigBlind ?? 200),
    ante: String(st?.ante ?? (t.anteType === 'none' ? 0 : 200)),
    anteType: st?.anteType ?? t.anteType,
    remaining: st?.playersRemaining ? String(st.playersRemaining) : '',
  };
}

export default function SetupPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const s = useStore();
  const t = s.tournaments[id];
  if (!hydrated || !t) {
    return (
      <>
        <TopBar title="ハンド設定" back={`/t/${id}`} />
        <Page><Empty>読み込み中…</Empty></Page>
      </>
    );
  }
  return <SetupInner id={id} t={t} />;
}

function SetupInner({ id, t }: { id: string; t: Tournament }) {
  const router = useRouter();
  const [init] = useState(() => initialDrafts(t));
  const [drafts, setDrafts] = useState<SeatDraft[]>(init.drafts);
  const [button, setButton] = useState(init.button);
  const [level, setLevel] = useState(init.level);
  const [sb, setSb] = useState(init.sb);
  const [bbText, setBb] = useState(init.bb);
  const [ante, setAnte] = useState(init.ante);
  const [anteType, setAnteType] = useState<AnteType>(init.anteType);
  const [remaining, setRemaining] = useState(init.remaining);
  const [heroCards, setHeroCards] = useState<Card[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const active = drafts.filter((d) => d.active);
  const activeSeats = active.map((d) => d.seat);
  const posMap: Record<number, string> = activeSeats.includes(button) ? positionMap(activeSeats, button) : {};
  const hero = drafts.find((d) => d.isHero && d.active);
  const bigBlind = toInt(bbText);

  const problems: string[] = [];
  if (active.length < 2) problems.push('プレイヤーは2人以上必要です');
  if (!activeSeats.includes(button)) problems.push('ボタンの座席を選んでください');
  if (!hero) problems.push('あなたの座席(★)を選んでください');
  if (bigBlind <= 0) problems.push('BBを入力してください');
  if (active.some((d) => toInt(d.stack) <= 0)) problems.push('スタックが0のプレイヤーがいます(外すか入力)');

  const upd = (seat: number, patch: Partial<SeatDraft>) =>
    setDrafts(drafts.map((d) => (d.seat === seat ? { ...d, ...patch } : d)));

  const start = () => {
    if (!t || problems.length > 0) return;
    const players: HandPlayer[] = active.map((d) => ({
      seat: d.seat,
      name: d.name.trim() || `P${d.seat}`,
      startStack: toInt(d.stack),
      isHero: d.isHero,
      cards: d.isHero && heroCards.length === 2 ? heroCards : null,
      bounty: t.isPko ? toInt(d.bounty) || undefined : undefined,
    }));
    const setup: HandSetup = {
      players,
      buttonSeat: button,
      smallBlind: toInt(sb),
      bigBlind,
      ante: anteType === 'none' ? 0 : toInt(ante),
      anteType,
      level: toInt(level, 1),
      playersRemaining: toInt(remaining) || undefined,
    };
    const engine = initEngine(players, button, setup.smallBlind, setup.bigBlind, setup.ante, setup.anteType);
    saveDraft({ tournamentId: id, setup, history: [engine], startedAt: nowMs() });
    router.replace(`/t/${id}/record`);
  };

  return (
    <>
      <TopBar title={`ハンド #${t.handCount + 1} の設定`} back={`/t/${id}`} sub={t.name} />
      <Page>
        <Section title="ブラインド">
          <div className="grid grid-cols-4 gap-2">
            <Field label="Lv">
              <input className="field px-2" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
            </Field>
            <Field label="SB">
              <input className="field px-2" inputMode="numeric" value={sb} onChange={(e) => setSb(e.target.value)} />
            </Field>
            <Field label="BB">
              <input className="field px-2" inputMode="numeric" value={bbText} onChange={(e) => setBb(e.target.value)} />
            </Field>
            <Field label={anteType === 'bb' ? 'BBアンティ' : 'アンティ'}>
              <input className="field px-2" inputMode="numeric" value={ante} disabled={anteType === 'none'} onChange={(e) => setAnte(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Segmented<AnteType>
              size="sm"
              value={anteType}
              options={[{ value: 'bb', label: 'BBアンティ' }, { value: 'classic', label: '全員' }, { value: 'none', label: 'なし' }]}
              onChange={setAnteType}
            />
            <button
              className="btn-secondary px-3 text-sm"
              onClick={() => {
                // よくあるストラクチャーの目安: SB/BB を1.5〜2倍に。手で直す前提の省力ボタン
                const nb = bigBlind * 2;
                setLevel(String(toInt(level, 1) + 1));
                setSb(String(nb / 2));
                setBb(String(nb));
                if (anteType === 'bb') setAnte(String(nb));
                else if (anteType === 'classic') setAnte(String(Math.round(nb / 8)));
              }}
            >
              Lv↑
            </button>
          </div>
          <div className="mt-3">
            <Field label="残り人数(ICM用・任意)">
              <input className="field" inputMode="numeric" value={remaining} onChange={(e) => setRemaining(e.target.value)} placeholder={t.totalEntries ? `/ ${t.totalEntries}` : ''} />
            </Field>
          </div>
        </Section>

        <Section
          title="座席"
          right={<span className="text-[11px] text-muted">BTN=ボタン ★=あなた</span>}
        >
          <ul className="divide-y divide-line">
            {drafts.map((d) => (
              <li key={d.seat} className={`flex items-center gap-2 py-2 ${d.active ? '' : 'opacity-40'}`}>
                <button
                  className={`tap flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${d.active ? 'bg-elev2' : 'bg-transparent border border-dashed border-line'}`}
                  onClick={() => upd(d.seat, { active: !d.active })}
                  title="タップで着席/離席"
                >
                  {d.seat}
                </button>
                <button
                  className={`tap w-12 shrink-0 rounded-lg text-xs font-bold ${button === d.seat ? 'bg-warn text-black' : 'bg-elev2 text-muted'}`}
                  disabled={!d.active}
                  onClick={() => setButton(d.seat)}
                >
                  {button === d.seat ? 'BTN' : posMap[d.seat] ?? '-'}
                </button>
                <input
                  className="field min-w-0 flex-1 px-2 py-2"
                  value={d.name}
                  disabled={!d.active}
                  onChange={(e) => upd(d.seat, { name: e.target.value })}
                  onFocus={(e) => e.target.select()}
                />
                <input
                  className="field w-24 px-2 py-2 text-right tabular-nums"
                  inputMode="numeric"
                  value={d.stack}
                  disabled={!d.active}
                  onChange={(e) => upd(d.seat, { stack: e.target.value.replace(/[^0-9]/g, '') })}
                  onFocus={(e) => e.target.select()}
                />
                {t.isPko && (
                  <input
                    className="field w-16 px-1 py-2 text-right text-xs tabular-nums"
                    inputMode="decimal"
                    value={d.bounty}
                    disabled={!d.active}
                    placeholder="賞金"
                    onChange={(e) => upd(d.seat, { bounty: e.target.value })}
                  />
                )}
                <button
                  className={`tap w-9 shrink-0 text-xl ${d.isHero ? 'text-warn' : 'text-muted/40'}`}
                  disabled={!d.active}
                  onClick={() => setDrafts(drafts.map((x) => ({ ...x, isHero: x.seat === d.seat, name: x.seat === d.seat ? (x.name.startsWith('P') && x.name.length <= 3 ? t.heroName : x.name) : x.name })))}
                >
                  ★
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            有効 {active.length} 人 ・ スタック合計 {chips(active.reduce((a, d) => a + toInt(d.stack), 0))}
            {hero && bigBlind > 0 ? ` ・ あなた ${(toInt(hero.stack) / bigBlind).toFixed(1)}bb` : ''}
          </p>
        </Section>

        <Section title="あなたのハンド">
          <button className="flex w-full items-center justify-between rounded-xl bg-elev2 px-3 py-2" onClick={() => setPickerOpen(true)}>
            <CardRow cards={heroCards} count={2} size="lg" />
            <span className="text-sm text-muted">{heroCards.length === 2 ? 'タップで変更' : 'タップして選択(あとでも可)'}</span>
          </button>
        </Section>

        {problems.length > 0 && (
          <ul className="mb-3 space-y-1 text-sm text-warn">
            {problems.map((p) => <li key={p}>・{p}</li>)}
          </ul>
        )}
      </Page>

      <BottomBar>
        <button className="btn-primary w-full text-lg" disabled={problems.length > 0} onClick={start}>
          アクション記録を開始
        </button>
      </BottomBar>

      <CardPicker
        open={pickerOpen}
        title="あなたのホールカード"
        count={2}
        initial={heroCards}
        used={[]}
        onClose={() => setPickerOpen(false)}
        onDone={(c) => {
          setHeroCards(c);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
