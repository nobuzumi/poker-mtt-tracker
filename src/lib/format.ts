import { Card } from './types';

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function isRedSuit(c: Card): boolean {
  return c[1] === 'h' || c[1] === 'd';
}

/** チップ数を 3桁区切りで */
export function chips(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** BB換算(小数1桁、整数なら小数なし) */
export function bb(n: number, bigBlind: number): string {
  if (!bigBlind) return '-';
  const v = n / bigBlind;
  return (Number.isInteger(v) ? v.toString() : v.toFixed(1)) + 'bb';
}

export function signed(n: number): string {
  return (n > 0 ? '+' : '') + chips(n);
}

export function todayStr(): string {
  const d = new Date();
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 文字列→非負整数(空や不正は fallback) */
export function toInt(s: string | number, fallback = 0): number {
  const n = typeof s === 'number' ? s : parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function toNum(s: string | number, fallback = 0): number {
  const n = typeof s === 'number' ? s : parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
