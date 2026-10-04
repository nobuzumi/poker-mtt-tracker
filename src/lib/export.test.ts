import { describe, expect, it } from 'vitest';
import {
  EngineState, addBoardCards, applyAction, distribute, initEngine, potTotal,
} from './engine';
import { anteLines, exportHand, icmContext } from './exporter';
import { HandPlayer, HandRecord, Tournament } from './types';

const tournament: Tournament = {
  id: '9876543210',
  name: 'Test MTT',
  date: '2026-10-04',
  currency: 'USD',
  buyIn: 10,
  fee: 1,
  bounty: 0,
  isPko: false,
  tableSizeMax: 9,
  anteType: 'classic',
  startingStack: 20000,
  totalEntries: 300,
  payouts: [{ place: 1, amount: 1000 }, { place: 2, amount: 600 }, { place: 3, toPlace: 4, amount: 300 }],
  heroName: 'Hero',
  createdAt: 0,
  updatedAt: 0,
  handCount: 0,
  lastState: null,
};

function record(
  e: EngineState, winners: number[], showdown: boolean, extra: Partial<HandRecord> = {},
): HandRecord {
  const results = distribute(e, winners);
  const heroSeat = e.players.find((p) => p.isHero)!.seat;
  const collected = results.filter((r) => r.seat === heroSeat).reduce((a, r) => a + r.amount, 0);
  return {
    id: '2467001122334455',
    tournamentId: tournament.id,
    handNo: 1,
    timestamp: Date.UTC(2026, 9, 4, 12, 0, 0),
    level: 5,
    smallBlind: e.smallBlind,
    bigBlind: e.bigBlind,
    ante: e.ante,
    anteType: e.anteType,
    buttonSeat: e.buttonSeat,
    sbSeat: e.sbSeat,
    bbSeat: e.bbSeat,
    sbPosted: e.sbPosted,
    bbPosted: e.bbPosted,
    antesPosted: e.antesPosted,
    players: e.players,
    actions: e.actions,
    board: e.board,
    uncalledEvents: e.uncalledEvents,
    results,
    wentToShowdown: showdown,
    heroSeat,
    heroNet: collected - (e.totalCommitted[heroSeat] ?? 0),
    tableSizeMax: 9,
    updatedAt: 0,
    ...extra,
  };
}

const sixMax = (): HandPlayer[] => [
  { seat: 1, name: 'Villain1', startStack: 12000, isHero: false, cards: null },
  { seat: 2, name: 'Hero', startStack: 15000, isHero: true, cards: ['Ah', 'Kd'] },
  { seat: 3, name: 'Villain3', startStack: 8000, isHero: false, cards: null },
  { seat: 4, name: 'Villain4', startStack: 30000, isHero: false, cards: null },
  { seat: 5, name: 'Villain5', startStack: 5000, isHero: false, cards: null },
  { seat: 6, name: 'Villain6', startStack: 22000, isHero: false, cards: null },
];

describe('engine + exporter', () => {
  it('fold win: uncalled bet returned, pot math consistent', () => {
    // BTN=seat6, SB=1, BB=2(Hero). UTG=3
    let e = initEngine(sixMax(), 6, 100, 200, 25, 'classic');
    expect(e.toAct[0]).toBe(3);
    e = applyAction(e, { type: 'fold' });            // 3
    e = applyAction(e, { type: 'fold' });            // 4
    e = applyAction(e, { type: 'fold' });            // 5
    e = applyAction(e, { type: 'raise', toAmount: 500 }); // 6 BTN
    e = applyAction(e, { type: 'fold' });            // 1 SB
    e = applyAction(e, { type: 'call' });            // 2 Hero
    expect(e.phase).toBe('need-board');
    e = addBoardCards(e, ['Ac', '7d', '2s']);
    e = applyAction(e, { type: 'bet', amount: 700 }); // Hero first to act postflop
    e = applyAction(e, { type: 'fold' });             // BTN
    expect(e.phase).toBe('finished');
    const h = record(e, [], false);
    const txt = exportHand(h, tournament);
    expect(txt).toContain("PokerStars Hand #2467001122334455: Tournament #9876543210, $10+$1 USD Hold'em No Limit - Level V (100/200)");
    expect(txt).toContain("Table '9876543210 1' 9-max Seat #6 is the button");
    expect(txt).toContain('Villain1: posts the ante 25');
    expect(txt).toContain('Dealt to Hero [Ah Kd]');
    expect(txt).toContain('Villain6: raises 300 to 500');
    expect(txt).toContain('Uncalled bet (700) returned to Hero');
    // pot = 6*25 ante + 100 SB + 500 + 500 = 1250
    expect(txt).toContain('Hero collected 1250 from pot');
    expect(txt).toContain('Total pot 1250 | Rake 0');
    expect(txt).toContain("Seat 3: Villain3 folded before Flop (didn't bet)");
    expect(txt).toContain('Seat 6: Villain6 (button) folded on the Flop');
    expect(h.heroNet).toBe(1250 - 25 - 500);
  });

  it('BB ante is split per player on export, remainder to BB', () => {
    const e = initEngine(sixMax(), 6, 100, 200, 200, 'bb');
    // BB(seat 2) posts 200 ante + 200 blind
    expect(e.antesPosted).toEqual({ 2: 200 });
    expect(e.totalCommitted[2]).toBe(400);
    const h = record(e, [], false);
    const lines = anteLines(h, 'split');
    // 6 players: 33 each for 5 non-BB players (165) + 35 for BB
    expect(lines).toEqual([[1, 33], [2, 35], [3, 33], [4, 33], [5, 33], [6, 33]]);
    expect(lines.reduce((a, [, v]) => a + v, 0)).toBe(200);
    expect(anteLines(h, 'single')).toEqual([[2, 200]]);
  });

  it('showdown with side pot and auto winner', () => {
    const players: HandPlayer[] = [
      { seat: 1, name: 'Short', startStack: 3000, isHero: false, cards: ['Qs', 'Qd'] },
      { seat: 2, name: 'Hero', startStack: 10000, isHero: true, cards: ['As', 'Kc'] },
      { seat: 3, name: 'Big', startStack: 20000, isHero: false, cards: ['7h', '7c'] },
    ];
    // BTN=1, SB=2, BB=3. Preflop first to act = BTN(1)
    let e = initEngine(players, 1, 100, 200, 0, 'none');
    e = applyAction(e, { type: 'allin' });        // Short 3000
    e = applyAction(e, { type: 'allin' });        // Hero 10000
    e = applyAction(e, { type: 'call' });         // Big calls 10000
    expect(e.phase).toBe('need-board');
    e = addBoardCards(e, ['Ad', '8c', '2h']);
    e = addBoardCards(e, ['3s']);
    e = addBoardCards(e, ['9d']);
    expect(e.phase).toBe('finished');
    expect(potTotal(e)).toBe(23000);
    const h = record(e, [], true);
    // main pot 9000 (3 x 3000) -> Hero (pair of aces beats queens), side pot 14000 -> Hero
    expect(h.results).toEqual([
      { seat: 2, amount: 9000, potIndex: 0 },
      { seat: 2, amount: 14000, potIndex: 1 },
    ]);
    const txt = exportHand(h, tournament);
    expect(txt).toContain('*** SHOW DOWN ***');
    expect(txt).toContain('Short: shows [Qs Qd] (a pair of Queens)');
    expect(txt).toContain('Hero: shows [As Kc] (a pair of Aces)');
    expect(txt).toContain('Hero collected 9000 from main pot');
    expect(txt).toContain('Hero collected 14000 from side pot');
    expect(txt).toContain('Total pot 23000 Main pot 9000. Side pot 14000. | Rake 0');
    expect(txt).toContain('Seat 1: Short (button) showed [Qs Qd] and lost with a pair of Queens');
  });

  it('PKO header and bounty on seat lines; ICM context text', () => {
    const pko: Tournament = { ...tournament, isPko: true, bounty: 5, buyIn: 5, fee: 1 };
    const players = sixMax().map((p) => ({ ...p, bounty: 5 }));
    const e = initEngine(players, 6, 100, 200, 0, 'none');
    const h = record(e, [], false, { playersRemaining: 120 });
    const txt = exportHand(h, pko);
    expect(txt).toContain('$5+$5+$1 USD');
    expect(txt).toContain('Seat 2: Hero (15000 in chips, $5 bounty)');
    const ctx = icmContext(h, pko);
    expect(ctx).toContain('Players remaining: 120 (40% of field left)');
    expect(ctx).toContain('3-4: 300');
  });

  it('player names are sanitized and deduplicated', () => {
    const players: HandPlayer[] = [
      { seat: 1, name: 'Player 1', startStack: 3000, isHero: false, cards: null },
      { seat: 2, name: 'Hero', startStack: 10000, isHero: true, cards: ['As', 'Kc'] },
      { seat: 3, name: 'Player 1', startStack: 20000, isHero: false, cards: null },
    ];
    let e = initEngine(players, 1, 100, 200, 0, 'none');
    e = applyAction(e, { type: 'fold' });
    e = applyAction(e, { type: 'fold' });
    const h = record(e, [], false);
    const txt = exportHand(h, tournament);
    expect(txt).toContain('Seat 1: Player_1 (3000 in chips)');
    expect(txt).toContain('Seat 3: Player_1_3 (20000 in chips)');
  });
});
