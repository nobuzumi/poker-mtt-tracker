'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Field, Page, Section, Segmented, TopBar, useToast } from '@/components/ui';
import { exportBackup, importBackup, updateSettings, useStore } from '@/lib/store';
import { getSupabase } from '@/lib/supabase';
import { pullAll, syncNow } from '@/lib/sync';
import { useAuth } from '@/lib/useAuth';
import { downloadText } from '@/lib/share';
import { todayStr } from '@/lib/format';

export default function AccountPage() {
  const s = useStore();
  const auth = useAuth();
  const [toast, show] = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const signIn = async (mode: 'in' | 'up') => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const res = mode === 'in'
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    if (mode === 'up' && !res.data.session) {
      show('確認メールを送信しました。メール内のリンクを開いてからログインしてください');
      return;
    }
    const r = await pullAll();
    show(r.ok ? `同期完了 (送信${r.pushed} / 受信${r.pulled})` : `同期エラー: ${r.error}`);
  };

  const doSync = async (full = false) => {
    setBusy(true);
    const r = full ? await pullAll() : await syncNow();
    setBusy(false);
    show(r.ok ? `同期完了 (送信${r.pushed} / 受信${r.pulled})` : `同期エラー: ${r.error}`);
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importBackup(await f.text());
      show(`${n} 件を取り込みました`);
    } catch {
      show('ファイルを読み込めませんでした');
    }
  };

  return (
    <>
      <TopBar title="アカウントと設定" back="/" />
      <Page>
        {toast}
        <Section title="クラウド同期 (Supabase)">
          {!auth.configured ? (
            <p className="text-sm text-muted">
              Supabase が未設定のためローカル保存のみで動作しています。Vercel の環境変数に
              <code className="mx-1 rounded bg-elev2 px-1">NEXT_PUBLIC_SUPABASE_URL</code>と
              <code className="mx-1 rounded bg-elev2 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              を設定すると有効になります(README参照)。
            </p>
          ) : auth.loading ? (
            <p className="text-sm text-muted">確認中…</p>
          ) : auth.session ? (
            <div>
              <p className="mb-1 text-sm">ログイン中: <span className="font-semibold">{auth.email}</span></p>
              <p className="mb-3 text-xs text-muted">
                最終同期: {s.settings.lastSyncAt ? new Date(s.settings.lastSyncAt).toLocaleString('ja-JP') : 'なし'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => doSync(false)}>今すぐ同期</button>
                <button className="btn-secondary" disabled={busy} onClick={() => doSync(true)}>全件取得し直す</button>
              </div>
              <button
                className="btn-ghost mt-2 w-full"
                onClick={async () => {
                  await getSupabase()?.auth.signOut();
                  show('ログアウトしました(ローカルデータは残ります)');
                }}
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div>
              <Field label="メールアドレス">
                <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="パスワード">
                <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {err && <p className="mb-2 text-sm text-danger">{err}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" disabled={busy || !email || !password} onClick={() => signIn('in')}>ログイン</button>
                <button className="btn-secondary" disabled={busy || !email || !password} onClick={() => signIn('up')}>新規登録</button>
              </div>
              <p className="mt-2 text-[11px] text-muted">初回は「新規登録」。Supabase 側でメール確認を有効にしている場合は届いたメールのリンクを開いてからログインしてください。</p>
            </div>
          )}
        </Section>

        <Section title="既定値">
          <Field label="あなたの表示名(新規トーナメントの初期値)">
            <input className="field" value={s.settings.heroName} onChange={(e) => updateSettings({ heroName: e.target.value })} />
          </Field>
          <Field label="通貨">
            <input className="field" value={s.settings.defaultCurrency} onChange={(e) => updateSettings({ defaultCurrency: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="テーブル人数">
            <Segmented
              value={s.settings.defaultTableSize}
              options={[{ value: 6, label: '6-max' }, { value: 8, label: '8-max' }, { value: 9, label: '9-max' }]}
              onChange={(v) => updateSettings({ defaultTableSize: v })}
            />
          </Field>
        </Section>

        <Section title="バックアップ (JSON)">
          <p className="mb-3 text-xs text-muted">端末内の全データを書き出し/取り込みします。同期を使わない場合の保険として。</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => downloadText(`mtt-tracker-backup-${todayStr()}.json`, exportBackup())}>書き出し</button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>取り込み</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          </div>
        </Section>

        <Section title="iPhone での使い方">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Safari でこのページを開き、共有ボタン → 「ホーム画面に追加」。</li>
            <li>ホーム画面のアイコンから起動すると全画面のアプリとして動きます。</li>
            <li>一度開いておけば、電波の弱い会場でもオフラインで記録できます(同期は復帰後に自動)。</li>
          </ol>
        </Section>

        <Link href="/help" className="btn-secondary w-full">使い方ガイドを開く</Link>
      </Page>
    </>
  );
}
