'use client';
// トーナメントの作成/編集フォーム。
// GTO Wizard 側で必要になる情報(バイイン内訳・PKO・テーブル人数・アンティ方式・
// エントリー数・賞金構造)をここでまとめて持つ。
import { useState } from 'react';
import { AnteType, Payout, Tournament } from '@/lib/types';
import { numericId } from '@/lib/store';
import { todayStr, toInt, toNum } from '@/lib/format';
import { Field, Section, Segmented } from './ui';

interface Props {
  initial?: Tournament;
  defaults: { heroName: string; currency: string; tableSize: number };
  onSave: (t: Tournament) => void;
  onDelete?: () => void;
}

export default function TournamentForm({ initial, defaults, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? defaults.currency);
  const [buyIn, setBuyIn] = useState(String(initial?.buyIn ?? ''));
  const [fee, setFee] = useState(String(initial?.fee ?? ''));
  const [isPko, setIsPko] = useState(initial?.isPko ?? false);
  const [bounty, setBounty] = useState(String(initial?.bounty || ''));
  const [tableSizeMax, setTableSizeMax] = useState(initial?.tableSizeMax ?? defaults.tableSize);
  const [anteType, setAnteType] = useState<AnteType>(initial?.anteType ?? 'bb');
  const [startingStack, setStartingStack] = useState(String(initial?.startingStack ?? '30000'));
  const [totalEntries, setTotalEntries] = useState(String(initial?.totalEntries ?? ''));
  const [heroName, setHeroName] = useState(initial?.heroName ?? defaults.heroName);
  const [payouts, setPayouts] = useState<Payout[]>(initial?.payouts ?? []);
  const [note, setNote] = useState(initial?.note ?? '');
  const [finishedPlace, setFinishedPlace] = useState(String(initial?.finishedPlace ?? ''));
  const [prize, setPrize] = useState(String(initial?.prize ?? ''));

  const canSave = name.trim().length > 0 && toInt(startingStack) > 0 && heroName.trim().length > 0;

  const submit = () => {
    const now = Date.now();
    const t: Tournament = {
      id: initial?.id ?? numericId(),
      name: name.trim(),
      venue: venue.trim() || undefined,
      date,
      currency: currency.trim() || 'JPY',
      buyIn: toNum(buyIn),
      fee: toNum(fee),
      bounty: isPko ? toNum(bounty) : 0,
      isPko,
      tableSizeMax,
      anteType,
      startingStack: toInt(startingStack),
      totalEntries: toInt(totalEntries) || undefined,
      payouts: payouts
        .filter((p) => p.place > 0 && p.amount > 0)
        .sort((a, b) => a.place - b.place),
      heroName: heroName.trim(),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      handCount: initial?.handCount ?? 0,
      lastState: initial?.lastState ?? null,
      finishedPlace: toInt(finishedPlace) || undefined,
      prize: toNum(prize) || undefined,
      note: note.trim() || undefined,
    };
    onSave(t);
  };

  const updPayout = (i: number, patch: Partial<Payout>) =>
    setPayouts(payouts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div>
      <Section title="基本情報">
        <Field label="トーナメント名 *">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: Sunday Main Event" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日付">
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="会場">
            <input className="field" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="任意" />
          </Field>
        </div>
        <Field label="あなたの表示名(HH内の Hero 名) *" hint="英数字推奨。GTO Wizard はこの名前の Dealt to 行でヒーローを判定します">
          <input className="field" value={heroName} onChange={(e) => setHeroName(e.target.value)} />
        </Field>
      </Section>

      <Section title="バイイン">
        <div className="grid grid-cols-3 gap-3">
          <Field label="通貨">
            <input className="field" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="JPY" />
          </Field>
          <Field label="賞金プール分">
            <input className="field" inputMode="decimal" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="10000" />
          </Field>
          <Field label="手数料">
            <input className="field" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="1000" />
          </Field>
        </div>
        <Field label="形式">
          <Segmented
            value={isPko ? 'pko' : 'fo'}
            options={[{ value: 'fo', label: 'フリーズアウト / 通常' }, { value: 'pko', label: 'PKO / バウンティ' }]}
            onChange={(v) => setIsPko(v === 'pko')}
          />
        </Field>
        {isPko && (
          <Field label="初期バウンティ(1人あたり)" hint="HHのヘッダーに「賞金分+バウンティ+手数料」として出力されます">
            <input className="field" inputMode="decimal" value={bounty} onChange={(e) => setBounty(e.target.value)} placeholder="5000" />
          </Field>
        )}
      </Section>

      <Section title="ストラクチャー">
        <Field label="テーブル最大人数" hint="GTO Wizard の MTT ソリューションは 6max / 8max 基準。9max は UTG がフォールドしたハンドのみ解析対象">
          <Segmented value={tableSizeMax} options={[{ value: 6, label: '6-max' }, { value: 8, label: '8-max' }, { value: 9, label: '9-max' }]} onChange={setTableSizeMax} />
        </Field>
        <Field label="アンティ方式" hint="BBアンティはHH出力時に全員へ按分して書き出します(GTO Wizardが確実に読める形式)">
          <Segmented<AnteType>
            value={anteType}
            options={[{ value: 'bb', label: 'BBアンティ' }, { value: 'classic', label: '全員アンティ' }, { value: 'none', label: 'なし' }]}
            onChange={setAnteType}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="初期スタック *">
            <input className="field" inputMode="numeric" value={startingStack} onChange={(e) => setStartingStack(e.target.value)} />
          </Field>
          <Field label="総エントリー数" hint="ICM計算の「残り%」に使用">
            <input className="field" inputMode="numeric" value={totalEntries} onChange={(e) => setTotalEntries(e.target.value)} placeholder="わかり次第" />
          </Field>
        </div>
      </Section>

      <Section
        title="賞金構造(ICM用)"
        right={
          <button
            type="button"
            className="text-xs font-semibold text-accent"
            onClick={() => {
              const last = payouts[payouts.length - 1];
              const nextPlace = last ? (last.toPlace ?? last.place) + 1 : 1;
              setPayouts([...payouts, { place: nextPlace, amount: 0 }]);
            }}
          >
            + 行を追加
          </button>
        }
      >
        {payouts.length === 0 && <p className="text-xs text-muted">わかっている範囲で入力。GTO Wizard AI のICMソルバーに手入力する際の控えになります。</p>}
        {payouts.map((p, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_auto_1fr_2fr_auto] items-center gap-2">
            <input className="field py-2" inputMode="numeric" value={p.place || ''} onChange={(e) => updPayout(i, { place: toInt(e.target.value) })} placeholder="順位" />
            <span className="text-muted">〜</span>
            <input className="field py-2" inputMode="numeric" value={p.toPlace ?? ''} onChange={(e) => updPayout(i, { toPlace: toInt(e.target.value) || undefined })} placeholder="同" />
            <input className="field py-2" inputMode="decimal" value={p.amount || ''} onChange={(e) => updPayout(i, { amount: toNum(e.target.value) })} placeholder="賞金額" />
            <button type="button" className="tap px-2 text-danger" onClick={() => setPayouts(payouts.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </Section>

      {initial && (
        <Section title="結果">
          <div className="grid grid-cols-2 gap-3">
            <Field label="最終順位">
              <input className="field" inputMode="numeric" value={finishedPlace} onChange={(e) => setFinishedPlace(e.target.value)} />
            </Field>
            <Field label="獲得賞金">
              <input className="field" inputMode="decimal" value={prize} onChange={(e) => setPrize(e.target.value)} />
            </Field>
          </div>
        </Section>
      )}

      <Section title="メモ">
        <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="任意" />
      </Section>

      <button className="btn-primary w-full" disabled={!canSave} onClick={submit}>
        {initial ? '保存' : 'トーナメントを作成'}
      </button>
      {onDelete && (
        <button className="btn-ghost mt-3 w-full text-danger" onClick={onDelete}>このトーナメントを削除</button>
      )}
    </div>
  );
}
