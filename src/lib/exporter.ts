// PokerStars形式のハンドヒストリーテキストを生成する
// (GTO Wizard Hand History Analyzer が読み込める形式)
//
// GTO Wizard 向けの注意点(調査結果に基づく):
//  - Hand # / Tournament # は数値のみ。重複IDは「重複」として無視される
//  - ボタンが Seat 10 だと認識されないため、座席は 1..9 に収める
//  - アンティは「1人1行の posts the ante」形式が確実。BBアンティでも人数で按分して出力する
//  - Dealt to 行はヒーローのみ。相手のカードはショウダウンでのみ出す
//  - PKO はヘッダーのバイイン三連("$5+$5+$1 USD")と座席行の "$X bounty" で伝える
//  - 残り人数・賞金構造はHHに載らない(GTO Wizard AI 側で手入力)
import { HandRecord, HandPlayer, Street, Tournament } from './types';
import { evaluate7 } from './handEval';
import { toRoman } from './positions';

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export interface ExportOptions {
  /** BBアンティを1人1行に按分する(推奨) / BBの1行だけで出す */
  bbAnteMode?: 'split' | 'single';
  /** 通貨記号(ヘッダー・バウンティ表記)。既定 '$' */
  currencySymbol?: string;
  /** ISO通貨コード。既定 'USD' */
  currencyCode?: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function money(n: number): string {
  // 整数ならそのまま、小数なら2桁
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function potName(potIndex: number, potCount: number): string {
  if (potCount <= 1) return 'pot';
  if (potIndex === 0) return 'main pot';
  if (potCount === 2) return 'side pot';
  return `side pot-${potIndex}`;
}

function blindTag(hand: HandRecord, seat: number): string {
  if (seat === hand.buttonSeat) return ' (button)';
  if (seat === hand.sbSeat) return ' (small blind)';
  if (seat === hand.bbSeat) return ' (big blind)';
  return '';
}

/** 名前に空白や記号があるとパーサーが誤認しやすいので安全な形に整える */
export function safeName(name: string): string {
  const cleaned = name.trim().replace(/[\s:()\[\]]+/g, '_');
  return cleaned.length > 0 ? cleaned : 'Player';
}

/** バイイン表記: "$10+$1 USD" / PKO: "$5+$5+$1 USD" */
export function buyInString(t: Tournament, sym: string, code: string): string {
  const parts = [money(t.buyIn)];
  if (t.isPko && t.bounty > 0) parts.push(money(t.bounty));
  parts.push(money(t.fee));
  return parts.map((p) => `${sym}${p}`).join('+') + ` ${code}`;
}

/** アンティ行の内訳を決める(座席→額) */
export function anteLines(hand: HandRecord, mode: 'split' | 'single'): Array<[number, number]> {
  const seats = [...hand.players].map((p) => p.seat).sort((a, b) => a - b);
  const total = Object.values(hand.antesPosted).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  if (hand.anteType !== 'bb' || mode === 'single') {
    return seats
      .filter((s) => (hand.antesPosted[s] ?? 0) > 0)
      .map((s) => [s, hand.antesPosted[s]]);
  }
  // BBアンティを人数で按分。端数はBBに寄せる
  const n = seats.length;
  const each = Math.floor(total / n);
  const out: Array<[number, number]> = [];
  let assigned = 0;
  for (const s of seats) {
    if (s === hand.bbSeat) continue;
    if (each > 0) {
      out.push([s, each]);
      assigned += each;
    }
  }
  const bbShare = total - assigned;
  if (bbShare > 0) out.push([hand.bbSeat, bbShare]);
  return out.sort((a, b) => a[0] - b[0]);
}

/** 1ハンドをPokerStars形式テキストに変換 */
export function exportHand(hand: HandRecord, tournament: Tournament, opts: ExportOptions = {}): string {
  const sym = opts.currencySymbol ?? '$';
  const code = opts.currencyCode ?? 'USD';
  const bbAnteMode = opts.bbAnteMode ?? 'split';

  const L: string[] = [];
  const players = [...hand.players].sort((a, b) => a.seat - b.seat);
  const names: Record<number, string> = {};
  const used = new Set<string>();
  for (const p of players) {
    let n = safeName(p.name);
    while (used.has(n)) n = `${n}_${p.seat}`;
    used.add(n);
    names[p.seat] = n;
  }
  const name = (seat: number) => names[seat];
  const maxSeat = Math.max(...players.map((p) => p.seat));
  const tableMax = hand.tableSizeMax && hand.tableSizeMax >= maxSeat
    ? hand.tableSizeMax
    : maxSeat <= 2 ? 2 : maxSeat <= 6 ? 6 : maxSeat <= 8 ? 8 : 9;

  L.push(
    `PokerStars Hand #${hand.id}: Tournament #${tournament.id}, ` +
    `${buyInString(tournament, sym, code)} Hold'em No Limit - Level ${toRoman(hand.level)} ` +
    `(${hand.smallBlind}/${hand.bigBlind}) - ${formatDate(hand.timestamp)} ET`,
  );
  L.push(`Table '${tournament.id} 1' ${tableMax}-max Seat #${hand.buttonSeat} is the button`);
  for (const p of players) {
    const bounty = tournament.isPko && p.bounty != null && p.bounty > 0
      ? `, ${sym}${money(p.bounty)} bounty`
      : '';
    L.push(`Seat ${p.seat}: ${name(p.seat)} (${p.startStack} in chips${bounty})`);
  }

  // アンティ
  for (const [seat, amt] of anteLines(hand, bbAnteMode)) {
    L.push(`${name(seat)}: posts the ante ${amt}`);
  }
  // ブラインド
  if (hand.sbSeat != null && hand.sbPosted > 0) {
    L.push(`${name(hand.sbSeat)}: posts small blind ${hand.sbPosted}`);
  }
  if (hand.bbPosted > 0) {
    L.push(`${name(hand.bbSeat)}: posts big blind ${hand.bbPosted}`);
  }

  // ホールカード
  L.push('*** HOLE CARDS ***');
  const hero = players.find((p) => p.seat === hand.heroSeat);
  if (hero && hero.cards && hero.cards.length === 2) {
    L.push(`Dealt to ${name(hero.seat)} [${hero.cards.join(' ')}]`);
  }

  // 各ストリートのアクション
  const foldedStreet: Record<number, Street> = {};
  for (const street of STREETS) {
    if (street === 'flop' && hand.board.length >= 3) {
      L.push(`*** FLOP *** [${hand.board.slice(0, 3).join(' ')}]`);
    } else if (street === 'turn' && hand.board.length >= 4) {
      L.push(`*** TURN *** [${hand.board.slice(0, 3).join(' ')}] [${hand.board[3]}]`);
    } else if (street === 'river' && hand.board.length >= 5) {
      L.push(`*** RIVER *** [${hand.board.slice(0, 4).join(' ')}] [${hand.board[4]}]`);
    } else if (street !== 'preflop') {
      break; // このストリートには到達していない
    }

    for (const a of hand.actions.filter((x) => x.street === street)) {
      const n = name(a.seat);
      const allin = a.allIn ? ' and is all-in' : '';
      switch (a.type) {
        case 'fold':
          L.push(`${n}: folds`);
          foldedStreet[a.seat] = street;
          break;
        case 'check':
          L.push(`${n}: checks`);
          break;
        case 'call':
          L.push(`${n}: calls ${a.amount ?? 0}${allin}`);
          break;
        case 'bet':
          L.push(`${n}: bets ${a.amount ?? 0}${allin}`);
          break;
        case 'raise':
          L.push(`${n}: raises ${a.amount ?? 0} to ${a.toAmount ?? 0}${allin}`);
          break;
      }
    }
    // このストリートでの返還ベット
    for (const u of hand.uncalledEvents.filter((x) => x.street === street)) {
      L.push(`Uncalled bet (${u.amount}) returned to ${name(u.seat)}`);
    }
  }

  const potCount = Math.max(1, ...hand.results.map((r) => r.potIndex + 1));
  const folded = new Set(Object.keys(foldedStreet).map(Number));
  const showdownPlayers = players.filter((p) => !folded.has(p.seat));

  const descOf = (p: HandPlayer): string => {
    if (p.cards && p.cards.length === 2 && hand.board.length === 5) {
      return evaluate7([...p.cards, ...hand.board]).desc;
    }
    return '';
  };

  if (hand.wentToShowdown) {
    L.push('*** SHOW DOWN ***');
    for (const p of showdownPlayers) {
      if (p.cards && p.cards.length === 2) {
        const d = descOf(p);
        L.push(`${name(p.seat)}: shows [${p.cards.join(' ')}]${d ? ` (${d})` : ''}`);
      } else {
        const isWinner = hand.results.some((r) => r.seat === p.seat);
        if (!isWinner) L.push(`${name(p.seat)}: mucks hand`);
      }
    }
    for (const r of hand.results) {
      L.push(`${name(r.seat)} collected ${r.amount} from ${potName(r.potIndex, potCount)}`);
    }
  } else {
    for (const r of hand.results) {
      L.push(`${name(r.seat)} collected ${r.amount} from ${potName(r.potIndex, potCount)}`);
    }
    for (const r of hand.results) {
      const p = players.find((x) => x.seat === r.seat)!;
      if (!p.cards || p.cards.length !== 2 || !p.isHero) {
        L.push(`${name(p.seat)}: doesn't show hand`);
      }
    }
  }

  // サマリー
  L.push('*** SUMMARY ***');
  const totalPot = hand.results.reduce((a, r) => a + r.amount, 0);
  if (potCount > 1) {
    const potSums: number[] = [];
    for (const r of hand.results) {
      potSums[r.potIndex] = (potSums[r.potIndex] ?? 0) + r.amount;
    }
    let line = `Total pot ${totalPot} Main pot ${potSums[0] ?? 0}.`;
    for (let i = 1; i < potCount; i++) {
      line += ` ${potCount === 2 ? 'Side pot' : `Side pot-${i}`} ${potSums[i] ?? 0}.`;
    }
    L.push(`${line} | Rake 0`);
  } else {
    L.push(`Total pot ${totalPot} | Rake 0`);
  }
  if (hand.board.length > 0) {
    L.push(`Board [${hand.board.join(' ')}]`);
  }

  const streetLabel: Record<Street, string> = {
    preflop: 'before Flop',
    flop: 'on the Flop',
    turn: 'on the Turn',
    river: 'on the River',
  };
  for (const p of players) {
    const tag = blindTag(hand, p.seat);
    const n = name(p.seat);
    const won = hand.results.filter((r) => r.seat === p.seat)
      .reduce((a, r) => a + r.amount, 0);
    if (folded.has(p.seat)) {
      const fs = foldedStreet[p.seat];
      // プリフロップで自発的にチップを入れずにフォールドした場合
      const voluntary = hand.actions.some(
        (a) => a.seat === p.seat && (a.type === 'call' || a.type === 'bet' || a.type === 'raise'),
      );
      const didntBet = fs === 'preflop' && !voluntary ? " (didn't bet)" : '';
      L.push(`Seat ${p.seat}: ${n}${tag} folded ${streetLabel[fs]}${didntBet}`);
    } else if (hand.wentToShowdown) {
      const d = descOf(p);
      if (p.cards && p.cards.length === 2) {
        if (won > 0) {
          L.push(`Seat ${p.seat}: ${n}${tag} showed [${p.cards.join(' ')}] and won (${won})${d ? ` with ${d}` : ''}`);
        } else {
          L.push(`Seat ${p.seat}: ${n}${tag} showed [${p.cards.join(' ')}] and lost${d ? ` with ${d}` : ''}`);
        }
      } else if (won > 0) {
        L.push(`Seat ${p.seat}: ${n}${tag} collected (${won})`);
      } else {
        L.push(`Seat ${p.seat}: ${n}${tag} mucked`);
      }
    } else if (won > 0) {
      L.push(`Seat ${p.seat}: ${n}${tag} collected (${won})`);
    } else {
      L.push(`Seat ${p.seat}: ${n}${tag} folded ${streetLabel.river}`);
    }
  }

  return L.join('\n');
}

/** トーナメント全ハンドをまとめてエクスポート */
export function exportTournament(
  hands: HandRecord[],
  tournament: Tournament,
  opts: ExportOptions = {},
): string {
  return hands
    .slice()
    .sort((a, b) => a.handNo - b.handNo)
    .map((h) => exportHand(h, tournament, opts))
    .join('\n\n\n') + '\n';
}

/**
 * GTO Wizard AI(ICM/PKOソルバー)に手入力する文脈情報をテキスト化。
 * HHには載せられない情報(残り人数・総エントリー・賞金構造・バウンティ)をまとめる。
 */
export function icmContext(hand: HandRecord, tournament: Tournament): string {
  const L: string[] = [];
  const bb = hand.bigBlind || 1;
  L.push(`Tournament: ${tournament.name}`);
  L.push(`Format: ${tournament.isPko ? 'PKO' : 'Freezeout'}  Table: ${hand.tableSizeMax ?? tournament.tableSizeMax}-max`);
  L.push(`Level ${hand.level}: ${hand.smallBlind}/${hand.bigBlind}` +
    (hand.ante > 0 ? ` ante ${hand.ante}${hand.anteType === 'bb' ? ' (BB ante)' : ' (per player)'}` : ''));
  if (tournament.totalEntries) L.push(`Entrants: ${tournament.totalEntries}`);
  if (hand.playersRemaining) {
    const pct = tournament.totalEntries
      ? ` (${Math.round((hand.playersRemaining / tournament.totalEntries) * 100)}% of field left)`
      : '';
    L.push(`Players remaining: ${hand.playersRemaining}${pct}`);
  }
  if (tournament.startingStack) L.push(`Starting stack: ${tournament.startingStack}`);
  L.push('Stacks (bb):');
  for (const p of [...hand.players].sort((a, b) => a.seat - b.seat)) {
    const bounty = tournament.isPko && p.bounty ? `  bounty ${p.bounty}` : '';
    L.push(`  Seat ${p.seat} ${p.name}${p.isHero ? ' (Hero)' : ''}: ${(p.startStack / bb).toFixed(1)}bb${bounty}`);
  }
  if (tournament.payouts.length > 0) {
    L.push('Payouts:');
    for (const p of tournament.payouts) {
      const place = p.toPlace && p.toPlace !== p.place ? `${p.place}-${p.toPlace}` : `${p.place}`;
      L.push(`  ${place}: ${p.amount}`);
    }
  }
  return L.join('\n');
}
