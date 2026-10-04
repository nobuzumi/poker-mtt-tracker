'use client';
// ローカルファースト・ストア
// すべてのデータは localStorage に保存し、ログイン時のみ Supabase と同期する。
// (会場の電波が弱くても記録できることを最優先)
import { useSyncExternalStore } from 'react';
import { HandRecord, Tournament } from './types';

export interface Settings {
  heroName: string;
  defaultCurrency: string;
  defaultTableSize: number;
  lastSyncAt: number;
  lastPushAt: number;
}

export interface StoreState {
  tournaments: Record<string, Tournament>;
  hands: Record<string, HandRecord>;
  settings: Settings;
}

const KEY = 'pmt.v2';

const DEFAULT_SETTINGS: Settings = {
  heroName: 'Hero',
  defaultCurrency: 'JPY',
  defaultTableSize: 9,
  lastSyncAt: 0,
  lastPushAt: 0,
};

const EMPTY: StoreState = { tournaments: {}, hands: {}, settings: DEFAULT_SETTINGS };

let state: StoreState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      state = {
        tournaments: parsed.tournaments ?? {},
        hands: parsed.hands ?? {},
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    }
  } catch {
    // 壊れたデータは無視して空から始める
    state = EMPTY;
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 容量超過など。黙って続行(メモリ上の状態は維持される)
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function setState(next: StoreState): void {
  state = next;
  persist();
  emit();
}

export function getState(): StoreState {
  load();
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React から購読するためのフック。SSR中は空ストアを返す */
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

// ---------- ミューテーション ----------

export function upsertTournament(t: Tournament): void {
  const s = getState();
  setState({ ...s, tournaments: { ...s.tournaments, [t.id]: { ...t, updatedAt: Date.now() } } });
}

export function upsertHand(h: HandRecord): void {
  const s = getState();
  setState({ ...s, hands: { ...s.hands, [h.id]: { ...h, updatedAt: Date.now() } } });
}

export function deleteHand(id: string): void {
  const s = getState();
  const h = s.hands[id];
  if (!h) return;
  setState({ ...s, hands: { ...s.hands, [id]: { ...h, deleted: true, updatedAt: Date.now() } } });
}

export function deleteTournament(id: string): void {
  const s = getState();
  const t = s.tournaments[id];
  if (!t) return;
  const now = Date.now();
  const hands = { ...s.hands };
  for (const h of Object.values(hands)) {
    if (h.tournamentId === id && !h.deleted) hands[h.id] = { ...h, deleted: true, updatedAt: now };
  }
  setState({
    ...s,
    hands,
    tournaments: { ...s.tournaments, [id]: { ...t, deleted: true, updatedAt: now } },
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  const s = getState();
  setState({ ...s, settings: { ...s.settings, ...patch } });
}

/** 同期で受け取ったレコードをマージ(updatedAt が新しい方を採用)。変更件数を返す */
export function mergeRemote(tournaments: Tournament[], hands: HandRecord[]): number {
  const s = getState();
  let changed = 0;
  const nt = { ...s.tournaments };
  for (const t of tournaments) {
    const cur = nt[t.id];
    if (!cur || (t.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
      nt[t.id] = t;
      changed++;
    }
  }
  const nh = { ...s.hands };
  for (const h of hands) {
    const cur = nh[h.id];
    if (!cur || (h.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
      nh[h.id] = h;
      changed++;
    }
  }
  if (changed > 0) setState({ ...s, tournaments: nt, hands: nh });
  return changed;
}

// ---------- セレクタ ----------

export function liveTournaments(s: StoreState): Tournament[] {
  return Object.values(s.tournaments)
    .filter((t) => !t.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function handsOf(s: StoreState, tournamentId: string): HandRecord[] {
  return Object.values(s.hands)
    .filter((h) => h.tournamentId === tournamentId && !h.deleted)
    .sort((a, b) => a.handNo - b.handNo);
}

/** PokerStars形式のIDに使える一意な数値文字列を生成 */
export function numericId(): string {
  const t = Date.now().toString();
  const r = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return t + r;
}

/** ストレージ全体の書き出し/読み込み(バックアップ用) */
export function exportBackup(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importBackup(json: string): number {
  const parsed = JSON.parse(json) as Partial<StoreState>;
  return mergeRemote(Object.values(parsed.tournaments ?? {}), Object.values(parsed.hands ?? {}));
}
