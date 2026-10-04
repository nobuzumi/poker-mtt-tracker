'use client';
// カード選択UI: 13ランク × 4スートのグリッド。使用済みカードは選べない。
import { useState } from 'react';
import { Card } from '@/lib/types';
import { RANKS, SUITS, SUIT_SYMBOL, isRedSuit } from '@/lib/format';
import { Sheet } from './ui';

export function CardBadge({ card, size = 'md' }: { card: Card | null; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-7 w-5 text-xs' : size === 'lg' ? 'h-14 w-10 text-xl' : 'h-10 w-7 text-sm';
  if (!card) return <span className={`card-back ${dim}`}>?</span>;
  const rank = card[0];
  const suit = SUIT_SYMBOL[card[1]] ?? card[1];
  return (
    <span className={`card-face ${dim} ${isRedSuit(card) ? 'red' : ''}`}>
      <span className="flex flex-col items-center leading-none">
        <span>{rank}</span>
        <span className="text-[0.8em]">{suit}</span>
      </span>
    </span>
  );
}

export function CardRow({ cards, count, size = 'md' }: { cards: Card[]; count: number; size?: 'sm' | 'md' | 'lg' }) {
  const arr = Array.from({ length: count }, (_, i) => cards[i] ?? null);
  return (
    <span className="inline-flex gap-1">
      {arr.map((c, i) => (
        <CardBadge key={i} card={c} size={size} />
      ))}
    </span>
  );
}

interface PickerProps {
  open: boolean;
  title: string;
  count: number;            // 選ぶ枚数
  initial?: Card[];
  used: Card[];             // 他で使用中(選択不可)
  allowPartial?: boolean;   // 枚数未満でも確定可(相手の片方のみ判明など)
  onClose: () => void;
  onDone: (cards: Card[]) => void;
}

/** 開くたびに選択をリセットするため、open のときだけ内側をマウントする */
export default function CardPicker(props: PickerProps) {
  if (!props.open) return null;
  return <CardPickerInner {...props} />;
}

function CardPickerInner({ open, title, count, initial = [], used, allowPartial, onClose, onDone }: PickerProps) {
  const [sel, setSel] = useState<Card[]>(initial);
  const usedSet = new Set(used.filter((c) => !initial.includes(c)));

  const toggle = (c: Card) => {
    if (sel.includes(c)) {
      setSel(sel.filter((x) => x !== c));
      return;
    }
    if (usedSet.has(c)) return;
    // 満杯なら最後の1枚を置き換え
    const next = sel.length >= count ? [...sel.slice(0, count - 1), c] : [...sel, c];
    setSel(next);
    // 必要枚数に達したら自動確定(タップ回数を減らす)
    if (next.length === count && count > 0) {
      setTimeout(() => onDone(next), 120);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-3 flex items-center justify-between">
        <CardRow cards={sel} count={count} size="lg" />
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setSel([])}>クリア</button>
          {allowPartial && (
            <button className="btn-secondary" onClick={() => onDone(sel)}>確定</button>
          )}
        </div>
      </div>
      {/* 行=ランク、列=スート。片手でも押しやすい大きさにする */}
      <div className="grid grid-cols-4 gap-1">
        {SUITS.map((s) => (
          <div key={s} className={`flex h-8 items-center justify-center text-xl ${s === 'h' || s === 'd' ? 'suit-red' : 'suit-black'}`}>
            {SUIT_SYMBOL[s]}
          </div>
        ))}
        {RANKS.map((r) => (
          <div key={r} className="contents">
            {SUITS.map((s) => {
              const c = `${r}${s}`;
              const picked = sel.includes(c);
              const disabled = usedSet.has(c);
              return (
                <button
                  key={c}
                  disabled={disabled}
                  onClick={() => toggle(c)}
                  className={`flex h-10 items-center justify-center rounded-md text-base font-bold select-none ${
                    picked
                      ? 'bg-accent text-accent-fg'
                      : disabled
                        ? 'bg-elev text-muted/30 line-through'
                        : `bg-elev2 ${s === 'h' || s === 'd' ? 'suit-red' : 'suit-black'}`
                  }`}
                >
                  {r}
                  <span className="ml-0.5 text-xs opacity-70">{SUIT_SYMBOL[s]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
