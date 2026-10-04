'use client';
// アクション記録画面。エンジン状態の履歴を持ち、Undo できる。
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useHydrated, nowMs } from '@/lib/hydrated';
import AmountSheet from '@/components/AmountSheet';
import CardPicker, { CardRow } from '@/components/CardPicker';
import { BottomBar, Empty, Page, Pill, Section, TopBar, confirmDialog } from '@/components/ui';
import {
  EngineState, activeSeats, addBoardCards, applyAction, autoWinners, boardCardsNeeded, computePots,
  currentActor, distribute, potTotal, stackLeft, toCallAmount,
} from '@/lib/engine';
import { HandDraft, clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { bb as fmtBb, chips } from '@/lib/format';
import { positionMap } from '@/lib/positions';
import { numericId, upsertHand, upsertTournament, useStore } from '@/lib/store';
import { Card, HandRecord, TableState, Tournament } from '@/lib/types';

const TAGS = ['要検討', 'プリフロップ', 'ICM', 'ブラフ', 'バリュー', 'コールダウン', 'ミス?', 'クーラー'];

const STREET_JA: Record<string, string> = { preflop: 'プリフロップ', flop: 'フロップ', turn: 'ターン', river: 'リバー' };

export default function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const s = useStore();
  const t = s.tournaments[id];
  if (!hydrated || !t) {
    return (
      <>
        <TopBar title="記録" back={`/t/${id}`} />
        <Page><Empty>読み込み中…</Empty></Page>
      </>
    );
  }
  return <RecordInner id={id} t={t} />;
}

function RecordInner({ id, t }: { id: string; t: Tournament }) {
  const router = useRouter();
  // ハイドレーション後にのみマウントされるので、ストレージから直接初期化できる
  const [draft, setDraft] = useState<HandDraft | null>(() => loadDraft(id));
  const [amount, setAmount] = useState<null | 'bet' | 'raise'>(null);
  const [picker, setPicker] = useState<null | { kind: 'board' } | { kind: 'player'; seat: number }>(null);
  const [winners, setWinners] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const state: EngineState | null = draft ? draft.history[draft.history.length - 1] : null;

  const push = useCallback((next: EngineState) => {
    if (!draft) return;
    const nd = { ...draft, history: [...draft.history, next] };
    setDraft(nd);
    saveDraft(nd);
  }, [draft]);

  const undo = () => {
    if (!draft || draft.history.length <= 1) return;
    const nd = { ...draft, history: draft.history.slice(0, -1) };
    setDraft(nd);
    saveDraft(nd);
    setWinners([]);
  };

  /** プレイヤーのカードを(履歴全体に)設定する */
  const setPlayerCards = (seat: number, cards: Card[] | null) => {
    if (!draft) return;
    const fix = (st: EngineState): EngineState => ({
      ...st,
      players: st.players.map((p) => (p.seat === seat ? { ...p, cards } : p)),
    });
    const nd: HandDraft = {
      ...draft,
      setup: { ...draft.setup, players: draft.setup.players.map((p) => (p.seat === seat ? { ...p, cards } : p)) },
      history: draft.history.map(fix),
    };
    setDraft(nd);
    saveDraft(nd);
  };

  const seats = useMemo(() => (state ? state.players.map((p) => p.seat) : []), [state]);
  const posMap = useMemo(() => (state ? positionMap(seats, state.buttonSeat) : {}), [seats, state]);
  const usedCards: Card[] = useMemo(() => {
    if (!state) return [];
    return [...state.board, ...state.players.flatMap((p) => p.cards ?? [])];
  }, [state]);

  if (!draft || !state) {
    return (
      <>
        <TopBar title="記録" back={`/t/${id}`} />
        <Page>
          <Empty>
            記録中のハンドがありません。
            <button className="btn-primary mt-3 w-full" onClick={() => router.replace(`/t/${id}/setup`)}>ハンド設定へ</button>
          </Empty>
        </Page>
      </>
    );
  }

  const actor = currentActor(state);
  const actorP = actor != null ? state.players.find((p) => p.seat === actor) : null;
  const toCall = actor != null ? toCallAmount(state, actor) : 0;
  const pot = potTotal(state);
  const hero = state.players.find((p) => p.isHero)!;
  const active = activeSeats(state);
  const needCards = boardCardsNeeded(state);
  const finished = state.phase === 'finished';
  const showdown = finished && active.length >= 2;

  // 最低ベット/レイズ額(ストリート合計)
  const lastRaiseBy = Math.max(
    state.bigBlind,
    ...state.actions.filter((a) => a.street === state.street && a.type === 'raise').map((a) => a.amount ?? 0),
    ...state.actions.filter((a) => a.street === state.street && a.type === 'bet').map((a) => a.amount ?? 0),
  );
  const maxTotal = actor != null ? (state.committed[actor] ?? 0) + stackLeft(state, actor) : 0;
  const minTotal = Math.min(maxTotal, state.currentBet > 0 ? state.currentBet + lastRaiseBy : state.bigBlind);

  // ショウダウン: 勝者候補と結果プレビュー
  const pots = finished ? computePots(state) : [];
  const auto = showdown ? autoWinners(state, active) : null;
  const effectiveWinners = showdown ? (winners.length > 0 ? winners : auto ?? []) : active;
  const preview = finished ? distribute(state, effectiveWinners) : [];
  const canSave = finished && (!showdown || effectiveWinners.length > 0) && hero.cards?.length === 2;

  const save = () => {
    if (!canSave) return;
    const results = preview;
    const collected = results.filter((r) => r.seat === hero.seat).reduce((a, r) => a + r.amount, 0);
    const handNo = t.handCount + 1;
    const rec: HandRecord = {
      id: numericId(),
      tournamentId: id,
      handNo,
      timestamp: draft.startedAt,
      level: draft.setup.level,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      ante: state.ante,
      anteType: state.anteType,
      buttonSeat: state.buttonSeat,
      sbSeat: state.sbSeat,
      bbSeat: state.bbSeat,
      sbPosted: state.sbPosted,
      bbPosted: state.bbPosted,
      antesPosted: state.antesPosted,
      players: state.players,
      actions: state.actions,
      board: state.board,
      uncalledEvents: state.uncalledEvents,
      results,
      wentToShowdown: showdown,
      heroSeat: hero.seat,
      heroNet: collected - (state.totalCommitted[hero.seat] ?? 0),
      playersRemaining: draft.setup.playersRemaining,
      tableSizeMax: t.tableSizeMax,
      note: note.trim() || undefined,
      tags: tags.length ? tags : undefined,
      updatedAt: nowMs(),
    };
    upsertHand(rec);

    // 次ハンドへの引き継ぎ: 終了時スタック
    const next: TableState = {
      players: state.players.map((p) => ({
        seat: p.seat,
        name: p.name,
        stack: p.startStack - (state.totalCommitted[p.seat] ?? 0) + results.filter((r) => r.seat === p.seat).reduce((a, r) => a + r.amount, 0),
        isHero: p.isHero,
        bounty: p.bounty,
      })),
      buttonSeat: state.buttonSeat,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      ante: state.ante,
      anteType: state.anteType,
      level: draft.setup.level,
      playersRemaining: draft.setup.playersRemaining,
    };
    upsertTournament({ ...t, handCount: handNo, lastState: next });
    clearDraft(id);
    router.replace(`/t/${id}`);
  };

  const discard = () => {
    if (confirmDialog('このハンドの記録を破棄しますか?')) {
      clearDraft(id);
      router.replace(`/t/${id}`);
    }
  };

  return (
    <>
      <TopBar
        title={`ハンド #${t.handCount + 1}`}
        back={`/t/${id}`}
        sub={`Lv${draft.setup.level} ${state.smallBlind}/${state.bigBlind}${state.ante ? `/${state.ante}` : ''} ・ ${STREET_JA[state.street]}`}
        right={
          <button className="tap px-3 text-sm text-accent disabled:opacity-30" disabled={draft.history.length <= 1} onClick={undo}>
            ↶ 戻す
          </button>
        }
      />
      <Page className="pb-44">
        {/* ポットとボード */}
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-felt/60 px-4 py-3">
          <div>
            <p className="text-[11px] text-fg/70">POT</p>
            <p className="text-2xl font-bold tabular-nums">{chips(pot)}</p>
            <p className="text-[11px] text-fg/70">{fmtBb(pot, state.bigBlind)}</p>
          </div>
          <button className="flex items-center gap-1" onClick={() => needCards > 0 && setPicker({ kind: 'board' })}>
            <CardRow cards={state.board} count={5} size="md" />
          </button>
        </div>

        {/* 座席一覧 */}
        <Section>
          <ul className="divide-y divide-line">
            {state.players.map((p) => {
              const folded = state.folded.includes(p.seat);
              const left = stackLeft(state, p.seat);
              const isActor = actor === p.seat;
              const com = state.committed[p.seat] ?? 0;
              const allIn = !folded && left === 0;
              return (
                <li key={p.seat} className={`flex items-center gap-2 py-2 ${folded ? 'opacity-35' : ''} ${isActor ? '-mx-3 rounded-xl bg-accent/10 px-3' : ''}`}>
                  <span className={`w-11 shrink-0 text-xs font-bold ${p.seat === state.buttonSeat ? 'text-warn' : 'text-muted'}`}>{posMap[p.seat]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {p.name}{p.isHero ? <span className="ml-1 text-warn">★</span> : ''}
                    </p>
                    <p className="text-[11px] text-muted tabular-nums">{chips(left)} ・ {fmtBb(left, state.bigBlind)}</p>
                  </div>
                  <button
                    className="shrink-0"
                    onClick={() => (p.isHero || showdown || finished) && setPicker({ kind: 'player', seat: p.seat })}
                  >
                    <CardRow cards={p.cards ?? []} count={2} size="sm" />
                  </button>
                  <div className="w-16 shrink-0 text-right">
                    {folded ? <Pill>FOLD</Pill> : allIn ? <Pill tone="danger">ALL-IN</Pill> : com > 0 ? <span className="text-sm font-semibold tabular-nums text-accent">{chips(com)}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* アクションログ */}
        {state.actions.length > 0 && (
          <Section title="アクション">
            <p className="text-xs leading-6 text-muted">
              {state.actions.map((a, i) => {
                const n = posMap[a.seat];
                const txt = a.type === 'fold' ? 'F' : a.type === 'check' ? 'X' : a.type === 'call' ? `C ${chips(a.amount ?? 0)}` : a.type === 'bet' ? `B ${chips(a.amount ?? 0)}` : `R→${chips(a.toAmount ?? 0)}`;
                const streetBreak = i > 0 && state.actions[i - 1].street !== a.street;
                return (
                  <span key={i}>
                    {streetBreak && <span className="mx-1 text-fg">|</span>}
                    <span className="mr-2 whitespace-nowrap"><b className="text-fg">{n}</b> {txt}{a.allIn ? '!' : ''}</span>
                  </span>
                );
              })}
            </p>
          </Section>
        )}

        {/* ショウダウン / 結果 */}
        {finished && (
          <Section title={showdown ? 'ショウダウン' : '結果'}>
            {showdown && (
              <>
                <p className="mb-2 text-xs text-muted">
                  相手のカードが分かれば入力(上の座席のカードをタップ)。全員分が分かれば勝者は自動判定、不明なら勝者を選択。
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {active.map((seat) => {
                    const p = state.players.find((x) => x.seat === seat)!;
                    const on = effectiveWinners.includes(seat);
                    return (
                      <button
                        key={seat}
                        className={`tap rounded-xl px-3 text-sm font-semibold ${on ? 'bg-accent text-accent-fg' : 'bg-elev2 text-fg'}`}
                        onClick={() => {
                          const base = winners.length > 0 ? winners : auto ?? [];
                          setWinners(base.includes(seat) ? base.filter((x) => x !== seat) : [...base, seat]);
                        }}
                      >
                        {posMap[seat]} {p.name}
                      </button>
                    );
                  })}
                </div>
                {pots.length > 1 && (
                  <p className="mb-2 text-[11px] text-muted">
                    {pots.map((p, i) => `${i === 0 ? 'メイン' : `サイド${i}`} ${chips(p.amount)} (${p.eligible.map((s2) => posMap[s2]).join('/')})`).join(' ・ ')}
                  </p>
                )}
              </>
            )}
            <ul className="mb-3 text-sm">
              {preview.map((r, i) => {
                const p = state.players.find((x) => x.seat === r.seat)!;
                return (
                  <li key={i} className="flex justify-between py-0.5">
                    <span>{posMap[r.seat]} {p.name}{p.isHero ? ' ★' : ''}</span>
                    <span className="tabular-nums text-accent">+{chips(r.amount)}{pots.length > 1 ? ` (${r.potIndex === 0 ? 'main' : `side${r.potIndex}`})` : ''}</span>
                  </li>
                );
              })}
            </ul>
            {hero.cards?.length !== 2 && (
              <p className="mb-2 text-sm text-warn">★ あなたのホールカードを入力してください(GTO Wizard の解析に必須)</p>
            )}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TAGS.map((tg) => (
                <button
                  key={tg}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${tags.includes(tg) ? 'bg-info/30 text-info' : 'bg-elev2 text-muted'}`}
                  onClick={() => setTags(tags.includes(tg) ? tags.filter((x) => x !== tg) : [...tags, tg])}
                >
                  {tg}
                </button>
              ))}
            </div>
            <textarea className="field min-h-16" placeholder="メモ(相手のタイプ、迷った点など)" value={note} onChange={(e) => setNote(e.target.value)} />
          </Section>
        )}

        <button className="btn-ghost w-full text-danger" onClick={discard}>このハンドを破棄</button>
      </Page>

      <BottomBar>
        {state.phase === 'acting' && actorP && (
          <>
            <p className="mb-1.5 text-center text-sm">
              <b className="text-warn">{posMap[actorP.seat]}</b> {actorP.name}{actorP.isHero ? ' ★' : ''} のアクション
              {toCall > 0 && <span className="text-muted"> ・ コール {chips(toCall)}</span>}
            </p>
            <div className="grid grid-cols-4 gap-2">
              <button className="btn-secondary text-base" onClick={() => push(applyAction(state, { type: 'fold' }))}>Fold</button>
              <button
                className="btn-secondary text-base"
                onClick={() => push(applyAction(state, { type: toCall > 0 ? 'call' : 'check' }))}
              >
                {toCall > 0 ? (toCall >= stackLeft(state, actorP.seat) ? 'Call AI' : 'Call') : 'Check'}
              </button>
              <button
                className="btn-primary text-base"
                disabled={maxTotal <= state.currentBet}
                onClick={() => setAmount(state.currentBet > 0 ? 'raise' : 'bet')}
              >
                {state.currentBet > 0 ? 'Raise' : 'Bet'}
              </button>
              <button className="btn-danger text-base" onClick={() => push(applyAction(state, { type: 'allin' }))}>All-in</button>
            </div>
          </>
        )}
        {state.phase === 'need-board' && (
          <button className="btn-primary w-full text-lg" onClick={() => setPicker({ kind: 'board' })}>
            {STREET_JA[state.street]}のカードを入力({needCards}枚)
          </button>
        )}
        {finished && (
          <button className="btn-primary w-full text-lg" disabled={!canSave} onClick={save}>
            保存して次のハンドへ
          </button>
        )}
      </BottomBar>

      {actor != null && (
        <AmountSheet
          open={amount !== null}
          mode={amount ?? 'bet'}
          street={state.street}
          bigBlind={state.bigBlind}
          pot={pot}
          currentBet={state.currentBet}
          toCall={toCall}
          committed={state.committed[actor] ?? 0}
          stackLeft={stackLeft(state, actor)}
          minTotal={minTotal}
          onClose={() => setAmount(null)}
          onConfirm={(total) => {
            push(applyAction(state, amount === 'raise' ? { type: 'raise', toAmount: total } : { type: 'bet', amount: total }));
            setAmount(null);
          }}
        />
      )}

      <CardPicker
        open={picker?.kind === 'board'}
        title={`${STREET_JA[state.street]}のボード`}
        count={needCards || 1}
        used={usedCards}
        onClose={() => setPicker(null)}
        onDone={(c) => {
          if (c.length === needCards) push(addBoardCards(state, c));
          setPicker(null);
        }}
      />
      <CardPicker
        open={picker?.kind === 'player'}
        title={picker?.kind === 'player' ? `${state.players.find((p) => p.seat === picker.seat)?.name} のカード` : ''}
        count={2}
        initial={picker?.kind === 'player' ? state.players.find((p) => p.seat === picker.seat)?.cards ?? [] : []}
        used={usedCards}
        allowPartial
        onClose={() => setPicker(null)}
        onDone={(c) => {
          if (picker?.kind === 'player') setPlayerCards(picker.seat, c.length === 2 ? c : null);
          setPicker(null);
          setWinners([]);
        }}
      />
    </>
  );
}
