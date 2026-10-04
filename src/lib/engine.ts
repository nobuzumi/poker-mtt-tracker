// ベッティングエンジン:
// ブラインド/アンティの投入、アクション順、ラウンド終了判定、
// 返還ベット(uncalled bet)、サイドポット計算までを担う。
// ルール強制はしない(実際に起きたアクションをそのまま記録できるよう寛容に扱う)。
import {
  AnteType, Card, HandAction, HandPlayer, PotResult, Street, UncalledEvent,
} from './types';
import { compareScore, evaluate7 } from './handEval';

export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export type Phase = 'acting' | 'need-board' | 'finished';

export interface EngineState {
  players: HandPlayer[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  anteType: AnteType;
  sbSeat: number | null;
  bbSeat: number;
  sbPosted: number;
  bbPosted: number;
  antesPosted: Record<number, number>;
  street: Street;
  board: Card[];
  actions: HandAction[];
  folded: number[];
  committed: Record<number, number>;      // 現在のストリートでの投入額
  totalCommitted: Record<number, number>; // ハンド全体での投入額(アンティ含む)
  currentBet: number;
  toAct: number[]; // これから行動する座席(先頭が現在の手番)
  uncalledEvents: UncalledEvent[];
  phase: Phase;
}

// ---------- ヘルパー ----------

function seatList(players: HandPlayer[]): number[] {
  return players.map((p) => p.seat).sort((a, b) => a - b);
}

/** fromSeat の「次」から時計回りに並べた座席列(fromSeat自身は含まない) */
export function orderAfter(seats: number[], fromSeat: number): number[] {
  const sorted = [...seats].sort((a, b) => a - b);
  return [...sorted.filter((s) => s > fromSeat), ...sorted.filter((s) => s < fromSeat)];
}

/** fromSeat を先頭に時計回りに並べた座席列 */
export function orderFrom(seats: number[], fromSeat: number): number[] {
  const sorted = [...seats].sort((a, b) => a - b);
  return [...sorted.filter((s) => s >= fromSeat), ...sorted.filter((s) => s < fromSeat)];
}

export function player(state: EngineState, seat: number): HandPlayer {
  return state.players.find((p) => p.seat === seat)!;
}

export function stackLeft(state: EngineState, seat: number): number {
  return player(state, seat).startStack - (state.totalCommitted[seat] ?? 0);
}

export function activeSeats(state: EngineState): number[] {
  return seatList(state.players).filter((s) => !state.folded.includes(s));
}

/** まだ行動可能(未フォールド・オールインでない)な座席 */
export function actingSeats(state: EngineState): number[] {
  return activeSeats(state).filter((s) => stackLeft(state, s) > 0);
}

export function potTotal(state: EngineState): number {
  return Object.values(state.totalCommitted).reduce((a, b) => a + b, 0);
}

export function currentActor(state: EngineState): number | null {
  return state.phase === 'acting' && state.toAct.length > 0 ? state.toAct[0] : null;
}

export function toCallAmount(state: EngineState, seat: number): number {
  return Math.min(
    Math.max(0, state.currentBet - (state.committed[seat] ?? 0)),
    stackLeft(state, seat),
  );
}

function clone(state: EngineState): EngineState {
  return {
    ...state,
    board: [...state.board],
    actions: [...state.actions],
    folded: [...state.folded],
    committed: { ...state.committed },
    totalCommitted: { ...state.totalCommitted },
    toAct: [...state.toAct],
    uncalledEvents: [...state.uncalledEvents],
    antesPosted: { ...state.antesPosted },
  };
}

// ---------- 初期化 ----------

export function initEngine(
  players: HandPlayer[],
  buttonSeat: number,
  smallBlind: number,
  bigBind: number,
  ante: number,
  anteType: AnteType = ante > 0 ? 'classic' : 'none',
): EngineState {
  const seats = seatList(players);
  const st: EngineState = {
    players: [...players].sort((a, b) => a.seat - b.seat),
    buttonSeat,
    smallBlind,
    bigBlind: bigBind,
    ante,
    anteType,
    sbSeat: null,
    bbSeat: 0,
    sbPosted: 0,
    bbPosted: 0,
    antesPosted: {},
    street: 'preflop',
    board: [],
    actions: [],
    folded: [],
    committed: {},
    totalCommitted: {},
    currentBet: 0,
    toAct: [],
    uncalledEvents: [],
    phase: 'acting',
  };
  for (const s of seats) {
    st.committed[s] = 0;
    st.totalCommitted[s] = 0;
  }

  // ブラインド座席の決定
  const isHU = seats.length === 2;
  const sbSeat = isHU ? buttonSeat : orderAfter(seats, buttonSeat)[0];
  const bbSeat = orderAfter(seats, sbSeat)[0];
  st.sbSeat = sbSeat;
  st.bbSeat = bbSeat;

  // クラシックアンティ: 全員がポットへ直接支払う(committedには含めない)
  if (ante > 0 && anteType === 'classic') {
    for (const s of seats) {
      const pay = Math.min(ante, stackLeft(st, s));
      if (pay > 0) {
        st.antesPosted[s] = pay;
        st.totalCommitted[s] += pay;
      }
    }
  }

  // ブラインド
  const sbPay = Math.min(smallBlind, stackLeft(st, sbSeat));
  st.sbPosted = sbPay;
  st.committed[sbSeat] += sbPay;
  st.totalCommitted[sbSeat] += sbPay;

  const bbPay = Math.min(bigBind, stackLeft(st, bbSeat));
  st.bbPosted = bbPay;
  st.committed[bbSeat] += bbPay;
  st.totalCommitted[bbSeat] += bbPay;

  // BBアンティ: ビッグブラインドが全員分をまとめて支払う。
  // ショートスタック時はTDAルールに従いブラインドを優先し、残りをアンティに充てる。
  if (ante > 0 && anteType === 'bb') {
    const pay = Math.min(ante, stackLeft(st, bbSeat));
    if (pay > 0) {
      st.antesPosted[bbSeat] = pay;
      st.totalCommitted[bbSeat] += pay;
    }
  }

  st.currentBet = bigBind;

  // プリフロップの最初の手番: HUはBTN(SB)、3人以上はBBの次
  const firstActor = isHU ? sbSeat : orderAfter(seats, bbSeat)[0];
  st.toAct = orderFrom(seats, firstActor).filter(
    (s) => !st.folded.includes(s) && stackLeft(st, s) > 0,
  );

  return closeStreetIfDone(st);
}

// ---------- アクション適用 ----------

export type ActionInput =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }      // ベット額
  | { type: 'raise'; toAmount: number }  // レイズ後の合計額(raise to)
  | { type: 'allin' };

export function applyAction(prev: EngineState, input: ActionInput): EngineState {
  const state = clone(prev);
  const actor = state.toAct[0];
  if (actor == null) return prev;
  const left = stackLeft(state, actor);
  const com = state.committed[actor] ?? 0;

  const record = (a: HandAction) => state.actions.push(a);

  const applyBetOrRaise = (targetTotal: number) => {
    // targetTotal = このストリートでの合計投入額
    const pay = Math.min(Math.max(0, targetTotal - com), left);
    const newCom = com + pay;
    state.committed[actor] = newCom;
    state.totalCommitted[actor] += pay;
    const allIn = stackLeft(state, actor) === 0;
    if (state.currentBet === 0) {
      record({ street: state.street, seat: actor, type: 'bet', amount: newCom, allIn });
      state.currentBet = newCom;
      state.toAct = orderAfter(seatList(state.players), actor).filter(
        (s) => !state.folded.includes(s) && stackLeft(state, s) > 0,
      );
    } else if (newCom > state.currentBet) {
      const raiseBy = newCom - state.currentBet;
      record({
        street: state.street, seat: actor, type: 'raise',
        amount: raiseBy, toAmount: newCom, allIn,
      });
      state.currentBet = newCom;
      state.toAct = orderAfter(seatList(state.players), actor).filter(
        (s) => !state.folded.includes(s) && stackLeft(state, s) > 0,
      );
    } else {
      // レイズ額に届かないオールイン等 → コール扱い
      record({ street: state.street, seat: actor, type: 'call', amount: pay, allIn });
      state.toAct.shift();
    }
  };

  switch (input.type) {
    case 'fold': {
      state.folded.push(actor);
      record({ street: state.street, seat: actor, type: 'fold' });
      state.toAct.shift();
      break;
    }
    case 'check': {
      record({ street: state.street, seat: actor, type: 'check' });
      state.toAct.shift();
      break;
    }
    case 'call': {
      const pay = Math.min(Math.max(0, state.currentBet - com), left);
      state.committed[actor] = com + pay;
      state.totalCommitted[actor] += pay;
      const allIn = stackLeft(state, actor) === 0;
      record({ street: state.street, seat: actor, type: 'call', amount: pay, allIn });
      state.toAct.shift();
      break;
    }
    case 'bet': {
      applyBetOrRaise(input.amount);
      break;
    }
    case 'raise': {
      applyBetOrRaise(input.toAmount);
      break;
    }
    case 'allin': {
      applyBetOrRaise(com + left);
      break;
    }
  }

  return closeStreetIfDone(state);
}

// ---------- ストリート終了処理 ----------

function refundUncalled(state: EngineState) {
  const seats = seatList(state.players);
  let topSeat = -1;
  let m1 = 0;
  for (const s of seats) {
    const c = state.committed[s] ?? 0;
    if (c > m1) {
      m1 = c;
      topSeat = s;
    }
  }
  if (topSeat < 0 || m1 <= 0) return;
  let m2 = 0;
  for (const s of seats) {
    if (s === topSeat) continue;
    m2 = Math.max(m2, state.committed[s] ?? 0);
  }
  if (m1 > m2) {
    const refund = m1 - m2;
    state.committed[topSeat] -= refund;
    state.totalCommitted[topSeat] -= refund;
    state.uncalledEvents.push({ street: state.street, seat: topSeat, amount: refund });
  }
}

function closeStreetIfDone(state: EngineState): EngineState {
  // 残り1人 → フォールド勝ち
  if (activeSeats(state).length <= 1) {
    refundUncalled(state);
    state.phase = 'finished';
    state.toAct = [];
    return state;
  }
  if (state.toAct.length > 0) {
    state.phase = 'acting';
    return state;
  }
  // ベッティングラウンド終了
  refundUncalled(state);
  if (state.street === 'river') {
    state.phase = 'finished';
    return state;
  }
  // 次のストリートへ(ボードカード入力待ち)
  state.street = STREETS[STREETS.indexOf(state.street) + 1];
  state.committed = {};
  for (const s of seatList(state.players)) state.committed[s] = 0;
  state.currentBet = 0;
  state.toAct = [];
  state.phase = 'need-board';
  return state;
}

/** ボードカード追加(need-board時)。flop=3枚, turn/river=1枚 */
export function addBoardCards(prev: EngineState, cards: Card[]): EngineState {
  const state = clone(prev);
  state.board.push(...cards);
  const acting = actingSeats(state);
  if (acting.length <= 1) {
    // 全員オールイン等 → アクションなしで次へ
    state.toAct = [];
    return closeStreetIfDone(state);
  }
  const first = orderAfter(seatList(state.players), state.buttonSeat).filter((s) =>
    acting.includes(s),
  )[0];
  state.toAct = orderFrom(seatList(state.players), first).filter((s) => acting.includes(s));
  state.phase = 'acting';
  return state;
}

export function boardCardsNeeded(state: EngineState): number {
  if (state.phase !== 'need-board') return 0;
  if (state.street === 'flop') return 3;
  return 1;
}

// ---------- ポット計算・分配 ----------

export interface Pot {
  amount: number;
  eligible: number[]; // このポットを獲得しうる座席(未フォールド)
}

export function computePots(state: EngineState): Pot[] {
  const seats = seatList(state.players);
  const contrib: Record<number, number> = {};
  for (const s of seats) contrib[s] = state.totalCommitted[s] ?? 0;
  const active = activeSeats(state);

  const levels = [...new Set(Object.values(contrib).filter((v) => v > 0))].sort(
    (a, b) => a - b,
  );
  const pots: Pot[] = [];
  let prev = 0;
  let carry = 0; // 対象者がいない層(フォールド者だけが入れた分)は次/前のポットへ合流
  for (const level of levels) {
    let amount = 0;
    for (const s of seats) {
      amount += Math.max(0, Math.min(contrib[s], level) - prev);
    }
    const eligible = active.filter((s) => contrib[s] >= level);
    if (amount > 0) {
      if (eligible.length === 0) {
        // 例: BBアンティを払ったBBがフォールドし、その投入額が勝者の投入額を上回る場合
        const last = pots[pots.length - 1];
        if (last) last.amount += amount;
        else carry += amount;
      } else {
        const last = pots[pots.length - 1];
        if (
          last &&
          last.eligible.length === eligible.length &&
          last.eligible.every((s, i) => s === eligible[i])
        ) {
          last.amount += amount + carry; // 同じ対象者のポットは統合
        } else {
          pots.push({ amount: amount + carry, eligible });
        }
        carry = 0;
      }
    }
    prev = level;
  }
  if (carry > 0 && pots.length > 0) pots[pots.length - 1].amount += carry;
  return pots;
}

/**
 * ショウダウン時にボード5枚と全員のカードが判明していれば勝者を自動判定。
 * 判定できない場合はnullを返す。
 */
export function autoWinners(state: EngineState, eligible: number[]): number[] | null {
  if (state.board.length !== 5) return null;
  const withCards = eligible.filter((s) => {
    const p = player(state, s);
    return p.cards && p.cards.length === 2;
  });
  if (withCards.length !== eligible.length || eligible.length === 0) return null;
  let best: number[] = [];
  let bestScore: number[] | null = null;
  for (const s of eligible) {
    const p = player(state, s);
    const r = evaluate7([...p.cards!, ...state.board]);
    if (!bestScore || compareScore(r.score, bestScore) > 0) {
      bestScore = r.score;
      best = [s];
    } else if (compareScore(r.score, bestScore) === 0) {
      best.push(s);
    }
  }
  return best;
}

/**
 * ポットを分配して結果を返す。
 * selectedWinners: ユーザーが選択した勝者(ショウダウン時)。
 * 各ポットは eligible ∩ selectedWinners に等分(端数はボタン左隣から順)。
 */
export function distribute(state: EngineState, selectedWinners: number[]): PotResult[] {
  const pots = computePots(state);
  const results: PotResult[] = [];
  const seats = seatList(state.players);
  // ボタンの左隣から時計回りに全席(ボタン自身を最後に)
  const orderFromBtn = [...orderAfter(seats, state.buttonSeat), state.buttonSeat];

  pots.forEach((pot, potIndex) => {
    let winners = pot.eligible.filter((s) => selectedWinners.includes(s));
    if (winners.length === 0) {
      const auto = autoWinners(state, pot.eligible);
      winners = auto ?? [pot.eligible[0] ?? seats[0]];
    }
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    // 端数はボタンの左隣(時計回りで最初)の勝者から
    const ordered = orderFromBtn.filter((s) => winners.includes(s));
    for (const s of ordered) {
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      if (amt > 0) results.push({ seat: s, amount: amt, potIndex });
    }
  });
  return results;
}
