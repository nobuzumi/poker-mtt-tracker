'use client';
// ベット/レイズ額の入力シート。
// GTO Wizard はベットサイズを最寄りの解析済みサイズに丸めるので、
// プリフロップは「x BB」、ポストフロップは「ポットの%」のクイックボタンを用意し、
// 数字キーパッドで正確なチップ額も入れられるようにする。
import { useMemo, useState } from 'react';
import { Sheet } from './ui';
import { bb as fmtBb, chips } from '@/lib/format';

interface Props {
  open: boolean;
  mode: 'bet' | 'raise';
  street: 'preflop' | 'flop' | 'turn' | 'river';
  bigBlind: number;
  pot: number;         // 現在のポット(自分のコール分を含めない総額)
  currentBet: number;  // このストリートの現在のベット額(raise to の基準)
  toCall: number;      // 自分がコールするのに必要な額
  committed: number;   // 自分がこのストリートに既に入れた額
  stackLeft: number;   // 自分の残りスタック
  minTotal: number;    // 最低ベット/レイズ到達額(ストリート合計)
  onClose: () => void;
  onConfirm: (total: number) => void; // ストリート合計額(bet額 / raise to 額)
}

/** 開くたびに入力をリセットするため、open のときだけ内側をマウントする */
export default function AmountSheet(p: Props) {
  if (!p.open) return null;
  return <AmountSheetInner {...p} />;
}

function AmountSheetInner(p: Props) {
  const [text, setText] = useState('');

  const maxTotal = p.committed + p.stackLeft;
  const value = text ? parseInt(text, 10) : 0;

  const quick = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    if (p.street === 'preflop') {
      if (p.currentBet <= p.bigBlind) {
        // オープンレイズ: BBの倍数
        for (const m of [2, 2.2, 2.5, 3, 3.5, 4]) out.push({ label: `${m}x`, total: Math.round(p.bigBlind * m) });
      } else {
        // 3bet以降: 直前レイズ額の倍数
        for (const m of [2.2, 2.5, 3, 3.5, 4]) out.push({ label: `${m}x`, total: Math.round(p.currentBet * m) });
      }
    } else {
      // ポストフロップ: ポットの割合。レイズ時は「コール後のポット」を基準にする
      const base = p.pot + p.toCall;
      for (const f of [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5]) {
        const extra = Math.round(base * f);
        out.push({ label: `${Math.round(f * 100)}%`, total: p.currentBet + extra + (p.mode === 'raise' ? 0 : 0) });
      }
    }
    return out
      .map((q) => ({ ...q, total: Math.min(maxTotal, Math.max(p.minTotal, q.total)) }))
      .filter((q, i, arr) => arr.findIndex((x) => x.total === q.total) === i);
  }, [p.street, p.currentBet, p.bigBlind, p.pot, p.toCall, p.minTotal, p.mode, maxTotal]);

  const press = (k: string) => {
    if (k === '⌫') setText(text.slice(0, -1));
    else if (k === 'C') setText('');
    else if (text.length < 9) setText(text === '0' ? k : text + k);
  };

  const valid = value >= p.minTotal && value <= maxTotal;
  const isAllIn = value === maxTotal;

  return (
    <Sheet open={p.open} onClose={p.onClose} title={p.mode === 'bet' ? 'ベット額' : 'レイズ額 (raise to)'}>
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted">
        <span>ポット {chips(p.pot)} / 残り {chips(p.stackLeft)}</span>
        <span>最低 {chips(p.minTotal)} ・ 最大 {chips(maxTotal)}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q.label}
            className={`tap rounded-xl px-3 text-sm font-semibold ${
              value === q.total ? 'bg-accent text-accent-fg' : 'bg-elev2 text-fg'
            }`}
            onClick={() => setText(String(q.total))}
          >
            {q.label}
            <span className="ml-1 text-xs opacity-70">{chips(q.total)}</span>
          </button>
        ))}
        <button
          className={`tap rounded-xl px-3 text-sm font-semibold ${isAllIn ? 'bg-danger text-white' : 'bg-elev2 text-danger'}`}
          onClick={() => setText(String(maxTotal))}
        >
          ALL-IN <span className="ml-1 text-xs opacity-70">{chips(maxTotal)}</span>
        </button>
      </div>

      <div className="mb-3 flex items-baseline justify-between rounded-xl bg-elev2 px-4 py-3">
        <span className="text-3xl font-bold tabular-nums">{text ? chips(value) : <span className="text-muted">0</span>}</span>
        <span className="text-sm text-muted">{fmtBb(value, p.bigBlind)}{isAllIn && value > 0 ? ' ・ ALL-IN' : ''}</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'].map((k) => (
          <button key={k} className="tap rounded-xl bg-elev2 py-3 text-xl font-semibold" onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button className="tap rounded-xl bg-elev2 py-2 text-sm font-semibold" onClick={() => setText(text + '00')}>00</button>
        <button className="tap rounded-xl bg-elev2 py-2 text-sm font-semibold" onClick={() => setText(text + '000')}>000</button>
        <button className="tap rounded-xl bg-elev2 py-2 text-sm font-semibold" onClick={() => setText(String(Math.round(value / 100) * 100))}>百の位丸め</button>
      </div>

      <button className="btn-primary w-full" disabled={!valid} onClick={() => p.onConfirm(value)}>
        {p.mode === 'bet' ? 'ベット' : 'レイズ'} {valid ? chips(value) : ''}
      </button>
    </Sheet>
  );
}
