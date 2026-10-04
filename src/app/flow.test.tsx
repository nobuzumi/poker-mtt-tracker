// @vitest-environment jsdom
// 設定画面 → 記録画面 → 保存 までを実際のUI操作で通す結合テスト
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetupPage from './t/[id]/setup/page';
import RecordPage from './t/[id]/record/page';
import { getState, handsOf, upsertTournament } from '@/lib/store';
import { exportHand } from '@/lib/exporter';
import { Tournament } from '@/lib/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'T1' }),
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const tournament: Tournament = {
  id: 'T1',
  name: 'Flow Test',
  date: '2026-10-04',
  currency: 'JPY',
  buyIn: 10000,
  fee: 1000,
  bounty: 0,
  isPko: false,
  tableSizeMax: 6,
  anteType: 'bb',
  startingStack: 20000,
  payouts: [],
  heroName: 'Hero',
  createdAt: 1,
  updatedAt: 1,
  handCount: 0,
  lastState: null,
};

const btn = (pred: (text: string) => boolean) => {
  const b = screen.getAllByRole('button').find((x) => pred(x.textContent ?? ''));
  if (!b) throw new Error('button not found');
  return b;
};
const click = (el: Element) => act(() => { fireEvent.click(el); });
const pickCard = (name: string) => click(btn((t) => t === name));

describe('setup → record → save flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    replace.mockReset();
    upsertTournament(tournament);
  });

  it('records a full hand and produces a valid PokerStars export', async () => {
    // ---- 設定画面: 既定(6人、BTN=1=Hero、100/200、BBアンティ200)のまま開始 ----
    const setup = render(<SetupPage />);
    expect(screen.getByText('有効 6 人', { exact: false })).toBeTruthy();
    click(btn((t) => t === 'アクション記録を開始'));
    expect(replace).toHaveBeenCalledWith('/t/T1/record');
    setup.unmount();

    // ---- 記録画面 ----
    render(<RecordPage />);
    // BTN=1, SB=2, BB=3 → 最初の手番は UTG(seat 4)
    expect(screen.getByText('のアクション', { exact: false }).textContent).toContain('P4');
    // ポット = SB100 + BB200 + BBアンティ200
    expect(screen.getByText('500')).toBeTruthy();

    click(btn((t) => t === 'Fold')); // P4
    click(btn((t) => t === 'Fold')); // P5
    click(btn((t) => t === 'Fold')); // P6
    // Hero(BTN) raises 2.5x = 500
    expect(screen.getByText('のアクション', { exact: false }).textContent).toContain('Hero');
    click(btn((t) => t === 'Raise'));
    click(btn((t) => t.startsWith('2.5x')));
    click(btn((t) => t.startsWith('レイズ') && t.includes('500')));
    click(btn((t) => t === 'Fold')); // SB
    click(btn((t) => t === 'Call')); // BB calls 300

    // フロップ入力
    click(btn((t) => t.startsWith('フロップのカードを入力')));
    pickCard('A♠');
    pickCard('7♦');
    pickCard('2♣');
    await waitFor(() => expect(screen.queryByText('フロップのボード')).toBeNull());

    // フロップ: BB が先。チェック → Hero 50% ベット → BB フォールド
    expect(screen.getByText('のアクション', { exact: false }).textContent).toContain('P3');
    click(btn((t) => t === 'Check'));
    click(btn((t) => t === 'Bet'));
    click(btn((t) => t.startsWith('50%')));
    // ポット 1300(500+500+SB100+アンティ200) の 50% = 650
    click(btn((t) => t.startsWith('ベット') && t.includes('650')));
    click(btn((t) => t === 'Fold'));

    // 終了: ヒーローカード未入力なので保存不可
    const save = btn((t) => t === '保存して次のハンドへ');
    expect((save as HTMLButtonElement).disabled).toBe(true);

    // ヒーローのカード入力(座席一覧の最初の行 = seat 1 = Hero)
    const heroRow = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('Hero'))!;
    click(within(heroRow).getByRole('button'));
    pickCard('A♥');
    pickCard('K♦');
    await waitFor(() => expect((btn((t) => t === '保存して次のハンドへ') as HTMLButtonElement).disabled).toBe(false));

    click(btn((t) => t === 'タグ・メモ' || t === '要検討'));
    click(btn((t) => t === '保存して次のハンドへ'));

    // ---- 保存結果の検証 ----
    const hands = handsOf(getState(), 'T1');
    expect(hands).toHaveLength(1);
    const h = hands[0];
    expect(h.handNo).toBe(1);
    expect(h.heroNet).toBe(1300 - 500); // 1300 回収 - 500 投入
    expect(h.tags).toEqual(['要検討']);

    const t = getState().tournaments['T1'];
    expect(t.handCount).toBe(1);
    const heroNext = t.lastState!.players.find((p) => p.isHero)!;
    expect(heroNext.stack).toBe(20800);
    const bbNext = t.lastState!.players.find((p) => p.seat === 3)!;
    expect(bbNext.stack).toBe(20000 - 200 - 500); // アンティ200 + 500

    const txt = exportHand(h, t);
    expect(txt).toContain("$10000+$1000 USD Hold'em No Limit - Level I (100/200)");
    expect(txt).toContain("Table 'T1 1' 6-max Seat #1 is the button");
    // BBアンティ200 を 6人に按分: 33×5 + 35
    expect(txt).toContain('Hero: posts the ante 33');
    expect(txt).toContain('P3: posts the ante 35');
    expect(txt).toContain('Dealt to Hero [Ah Kd]');
    expect(txt).toContain('Hero: raises 300 to 500');
    expect(txt).toContain('P3: calls 300');
    expect(txt).toContain('*** FLOP *** [As 7d 2c]');
    expect(txt).toContain('Hero: bets 650');
    expect(txt).toContain('Uncalled bet (650) returned to Hero');
    expect(txt).toContain('Hero collected 1300 from pot');
    expect(txt).toContain('Total pot 1300 | Rake 0');
    expect(txt).toContain('Seat 1: Hero (button) collected (1300)');
    expect(txt).toContain('Seat 3: P3 (big blind) folded on the Flop');
  });
});
