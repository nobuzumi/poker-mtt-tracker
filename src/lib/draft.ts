'use client';
// 記録中のハンド(下書き)を sessionStorage に退避し、リロードや画面遷移で消えないようにする
import { EngineState } from './engine';
import { HandSetup } from './types';

export interface HandDraft {
  tournamentId: string;
  setup: HandSetup;
  /** エンジン状態の履歴(Undo用)。末尾が現在 */
  history: EngineState[];
  startedAt: number;
}

const key = (tid: string) => `pmt.draft.${tid}`;

export function loadDraft(tid: string): HandDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key(tid)) ?? window.localStorage.getItem(key(tid));
    return raw ? (JSON.parse(raw) as HandDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: HandDraft): void {
  try {
    const raw = JSON.stringify(d);
    // sessionStorage はタブごと、localStorage はアプリ再起動後の復元用
    window.sessionStorage.setItem(key(d.tournamentId), raw);
    window.localStorage.setItem(key(d.tournamentId), raw);
  } catch {
    // 容量不足などは無視
  }
}

export function clearDraft(tid: string): void {
  try {
    window.sessionStorage.removeItem(key(tid));
    window.localStorage.removeItem(key(tid));
  } catch {
    // ignore
  }
}
