'use client';
// Supabase との双方向同期(last-write-wins)
// tournaments / hands テーブルは (user_id, id) を主キーとし、本文は jsonb の data に丸ごと保存する。
import { getSupabase } from './supabase';
import { getState, mergeRemote, updateSettings } from './store';
import { HandRecord, Tournament } from './types';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

let running: Promise<SyncResult> | null = null;

export function syncNow(): Promise<SyncResult> {
  if (running) return running;
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<SyncResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, pushed: 0, pulled: 0, error: 'Supabase未設定' };
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, pushed: 0, pulled: 0, error: '未ログイン' };

  const s = getState();
  const since = s.settings.lastPushAt;
  const pushT = Object.values(s.tournaments).filter((t) => (t.updatedAt ?? 0) > since);
  const pushH = Object.values(s.hands).filter((h) => (h.updatedAt ?? 0) > since);
  const now = Date.now();

  if (pushT.length > 0) {
    const { error } = await sb.from('tournaments').upsert(
      pushT.map((t) => ({
        id: t.id,
        user_id: user.id,
        data: t,
        updated_at: new Date(t.updatedAt ?? now).toISOString(),
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) return { ok: false, pushed: 0, pulled: 0, error: error.message };
  }
  if (pushH.length > 0) {
    const { error } = await sb.from('hands').upsert(
      pushH.map((h) => ({
        id: h.id,
        user_id: user.id,
        tournament_id: h.tournamentId,
        data: h,
        updated_at: new Date(h.updatedAt ?? now).toISOString(),
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) return { ok: false, pushed: 0, pulled: 0, error: error.message };
  }

  // pull: 前回同期以降に更新されたもの(時計のずれを考慮して少し余裕を持たせる)
  const sinceIso = new Date(Math.max(0, s.settings.lastSyncAt - 60_000)).toISOString();
  const [rt, rh] = await Promise.all([
    sb.from('tournaments').select('data').gt('updated_at', sinceIso),
    sb.from('hands').select('data').gt('updated_at', sinceIso),
  ]);
  if (rt.error) return { ok: false, pushed: 0, pulled: 0, error: rt.error.message };
  if (rh.error) return { ok: false, pushed: 0, pulled: 0, error: rh.error.message };
  const pulled = mergeRemote(
    (rt.data ?? []).map((r) => r.data as Tournament),
    (rh.data ?? []).map((r) => r.data as HandRecord),
  );
  updateSettings({ lastPushAt: now, lastSyncAt: now });
  return { ok: true, pushed: pushT.length + pushH.length, pulled };
}

/** 初回ログイン時などに全件取得し直す */
export async function pullAll(): Promise<SyncResult> {
  updateSettings({ lastSyncAt: 0 });
  return syncNow();
}
