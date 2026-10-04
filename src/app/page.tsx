'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { handsOf, liveTournaments, useStore } from '@/lib/store';
import { chips, signed } from '@/lib/format';
import { Empty, Page, Pill, TopBar } from '@/components/ui';
import { useAuth } from '@/lib/useAuth';
import { syncNow } from '@/lib/sync';
import { useHydrated } from '@/lib/hydrated';

export default function Home() {
  const s = useStore();
  const auth = useAuth();
  const mounted = useHydrated();

  // ログイン済みなら起動時に静かに同期
  useEffect(() => {
    if (auth.session) syncNow().catch(() => undefined);
  }, [auth.session]);

  const list = liveTournaments(s);

  return (
    <>
      <TopBar
        title="MTT Hand Tracker"
        right={
          <Link href="/account" className="tap flex items-center px-2 text-sm text-muted">
            {auth.session ? <Pill tone="accent">同期ON</Pill> : <Pill>ローカル</Pill>}
          </Link>
        }
      />
      <Page>
        <Link href="/t/new" className="btn-primary mb-5 w-full">＋ 新しいトーナメント</Link>

        {!mounted ? null : list.length === 0 ? (
          <Empty>まだトーナメントがありません。上のボタンから作成してください。</Empty>
        ) : (
          <ul className="space-y-2">
            {list.map((t) => {
              const hands = handsOf(s, t.id);
              const net = hands.reduce((a, h) => a + h.heroNet, 0);
              const stack = t.lastState?.players.find((p) => p.isHero)?.stack;
              return (
                <li key={t.id}>
                  <Link href={`/t/${t.id}`} className="block rounded-2xl border border-line bg-elev p-4 active:bg-elev2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{t.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {t.date}{t.venue ? ` ・ ${t.venue}` : ''} ・ {t.tableSizeMax}-max{t.isPko ? ' ・ PKO' : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{hands.length} hands</p>
                        {hands.length > 0 && (
                          <p className={`text-xs tabular-nums ${net >= 0 ? 'text-accent' : 'text-danger'}`}>{signed(net)}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.lastState && <Pill>Lv{t.lastState.level} {t.lastState.smallBlind}/{t.lastState.bigBlind}</Pill>}
                      {stack != null && <Pill tone="info">Stack {chips(stack)}</Pill>}
                      {t.finishedPlace && <Pill tone="warn">{t.finishedPlace}位</Pill>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </>
  );
}
