// 7枚からベスト5枚を評価するハンド評価器
// PokerStars形式の役の説明文("a pair of Aces" 等)も生成する
import { Card } from './types';

const RANK_ORDER = '23456789TJQKA';

const SINGULAR: Record<number, string> = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
  9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
  4: 'Four', 3: 'Three', 2: 'Deuce',
};

function plural(r: number): string {
  const s = SINGULAR[r];
  return s === 'Six' ? 'Sixes' : s + 's';
}

export function cardRank(c: Card): number {
  return RANK_ORDER.indexOf(c[0]) + 2;
}

export function cardSuit(c: Card): string {
  return c[1];
}

export interface EvalResult {
  score: number[]; // 辞書式比較: 大きいほど強い
  desc: string;    // PokerStars風の役説明
}

/** score配列の比較。a > b なら正 */
export function compareScore(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function evaluate5(cards: Card[]): EvalResult {
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);
  const isFlush = suits.every((s) => s === suits[0]);

  // ストレート判定(A-5ホイール対応)
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // ホイール
  }

  // ランクごとの枚数
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // (枚数, ランク) の降順
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const straightDesc = (high: number) =>
    high === 5 ? 'Ace to Five' : `${SINGULAR[high - 4]} to ${SINGULAR[high]}`;

  if (isFlush && straightHigh > 0) {
    return {
      score: [8, straightHigh],
      desc: `a straight flush, ${straightDesc(straightHigh)}`,
    };
  }
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return { score: [7, quad, kicker], desc: `four of a kind, ${plural(quad)}` };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const t = groups[0][0];
    const p = groups[1][0];
    return {
      score: [6, t, p],
      desc: `a full house, ${plural(t)} full of ${plural(p)}`,
    };
  }
  if (isFlush) {
    return { score: [5, ...ranks], desc: `a flush, ${SINGULAR[ranks[0]]} high` };
  }
  if (straightHigh > 0) {
    return { score: [4, straightHigh], desc: `a straight, ${straightDesc(straightHigh)}` };
  }
  if (groups[0][1] === 3) {
    const t = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]);
    return { score: [3, t, ...kickers], desc: `three of a kind, ${plural(t)}` };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const hi = groups[0][0];
    const lo = groups[1][0];
    const kicker = groups[2][0];
    return {
      score: [2, hi, lo, kicker],
      desc: `two pair, ${plural(hi)} and ${plural(lo)}`,
    };
  }
  if (groups[0][1] === 2) {
    const p = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]);
    return { score: [1, p, ...kickers], desc: `a pair of ${plural(p)}` };
  }
  return { score: [0, ...ranks], desc: `high card ${SINGULAR[ranks[0]]}` };
}

/** 7枚(ホール2+ボード5)からベスト5枚を評価 */
export function evaluate7(cards: Card[]): EvalResult {
  if (cards.length < 5) {
    return { score: [-1], desc: '' };
  }
  let best: EvalResult | null = null;
  const n = cards.length;
  // 5枚の組み合わせを全探索(7C5 = 21通り)
  const idx = [0, 1, 2, 3, 4];
  const combos: number[][] = [];
  const rec = (start: number, chosen: number[]) => {
    if (chosen.length === 5) {
      combos.push([...chosen]);
      return;
    }
    for (let i = start; i < n; i++) rec(i + 1, [...chosen, i]);
  };
  rec(0, []);
  void idx;
  for (const combo of combos) {
    const hand = combo.map((i) => cards[i]);
    const r = evaluate5(hand);
    if (!best || compareScore(r.score, best.score) > 0) best = r;
  }
  return best!;
}
