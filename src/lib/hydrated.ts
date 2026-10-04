'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** クライアントでハイドレーション完了後に true。SSR中は false(localStorage 依存UIの出し分けに使う) */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** React Compiler の純粋性チェックを避けつつ現在時刻を得る(イベントハンドラ内で使用) */
export function nowMs(): number {
  return Date.now();
}
