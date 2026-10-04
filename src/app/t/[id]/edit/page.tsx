'use client';
import { useParams, useRouter } from 'next/navigation';
import TournamentForm from '@/components/TournamentForm';
import { Empty, Page, TopBar, confirmDialog } from '@/components/ui';
import { deleteTournament, upsertTournament, useStore } from '@/lib/store';

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useStore();
  const t = s.tournaments[id];

  return (
    <>
      <TopBar title="トーナメント設定" back={`/t/${id}`} />
      <Page>
        {!t ? (
          <Empty>読み込み中…</Empty>
        ) : (
          <TournamentForm
            initial={t}
            defaults={{ heroName: s.settings.heroName, currency: s.settings.defaultCurrency, tableSize: s.settings.defaultTableSize }}
            onSave={(next) => {
              upsertTournament(next);
              router.replace(`/t/${id}`);
            }}
            onDelete={() => {
              if (confirmDialog('このトーナメントと全ハンドを削除します。よろしいですか?')) {
                deleteTournament(id);
                router.replace('/');
              }
            }}
          />
        )}
      </Page>
    </>
  );
}
