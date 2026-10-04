'use client';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';

/** 画面上部のバー。戻るリンクと右側アクション */
export function TopBar({ title, back, right, sub }: { title: string; back?: string; right?: ReactNode; sub?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
        {back ? (
          <Link href={back} className="tap flex w-12 items-center justify-center text-2xl text-muted" aria-label="戻る">
            ‹
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4 ${className}`}>{children}</main>;
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-5">
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {right}
        </div>
      )}
      <div className="rounded-2xl border border-line bg-elev p-3">{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange, size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex w-full rounded-xl bg-elev2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg ${size === 'sm' ? 'py-1.5 text-sm' : 'py-2.5'} font-medium transition ${
            o.value === value ? 'bg-accent text-accent-fg' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 下からせり上がるシート */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="閉じる" />
      <div className="safe-bottom relative max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-elev px-4 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{title}</h3>
            <button className="btn-ghost -mr-3" onClick={onClose}>閉じる</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** 画面下部に固定するアクションバー */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pt-2 backdrop-blur">
      <div className="mx-auto max-w-2xl px-3">{children}</div>
    </div>
  );
}

/** 簡易トースト */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
      <div className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg shadow-lg">{msg}</div>
    </div>
  ) : null;
  return [node, setMsg];
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' | 'danger' | 'info' }) {
  const cls = {
    muted: 'bg-elev2 text-muted',
    accent: 'bg-accent/20 text-accent',
    warn: 'bg-warn/20 text-warn',
    danger: 'bg-danger/20 text-danger',
    info: 'bg-info/20 text-info',
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function confirmDialog(message: string): boolean {
  return typeof window !== 'undefined' && window.confirm(message);
}
