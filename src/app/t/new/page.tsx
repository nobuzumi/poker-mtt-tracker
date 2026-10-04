'use client';
import { useRouter } from 'next/navigation';
import TournamentForm from '@/components/TournamentForm';
import { Page, TopBar } from '@/components/ui';
import { upsertTournament, useStore } from '@/lib/store';

export default function NewTournamentPage() {
  const router = useRouter();
  const s = useStore();
  return (
    <>
      <TopBar title="新しいトーナメント" back="/" />
      <Page>
        <TournamentForm
          defaults={{ heroName: s.settings.heroName, currency: s.settings.defaultCurrency, tableSize: s.settings.defaultTableSize }}
          onSave={(t) => {
            upsertTournament(t);
            router.replace(`/t/${t.id}`);
          }}
        />
      </Page>
    </>
  );
}
