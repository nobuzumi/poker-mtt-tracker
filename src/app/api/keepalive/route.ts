/**
 * Supabase Free プランは「直近1週間の DB 活動が不十分」だとプロジェクトを自動停止する。
 * 公式ドキュメントは「1日に数回のユーザーリクエストが DB に届いていればおおむね十分」としているため、
 * 1回の呼び出しで両テーブルに対して複数のクエリ(SELECT・件数カウント・最新行取得)を投げる。
 *
 * 呼び出し元は2系統(どちらか片方が止まっても停止しないように冗長化している):
 *   - Vercel Cron(vercel.json、毎日 UTC 3:00 ±59分)
 *   - GitHub Actions(.github/workflows/keepalive.yml、1日4回)
 * RLS により匿名キーでは行は返らないが、クエリ自体は Postgres で実行されるので活動として数えられる。
 */

// Vercel 側のキャッシュで実行がスキップされないよう、常に動的に実行する
export const dynamic = 'force-dynamic';

const TABLES = ['tournaments', 'hands'] as const;
const KINDS = ['select', 'count', 'recent'] as const;

type Probe = { table: string; kind: (typeof KINDS)[number]; status: number };

async function probe(base: string, key: string, table: string, kind: Probe['kind']): Promise<Probe> {
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}` };
  let url = `${base}/rest/v1/${table}`;
  let method = 'GET';
  if (kind === 'select') {
    url += '?select=id&limit=1';
  } else if (kind === 'recent') {
    url += '?select=id,updated_at&order=updated_at.desc&limit=1';
  } else {
    // HEAD + count=exact で SELECT count(*) を実行させる
    url += '?select=id';
    method = 'HEAD';
    headers.Prefer = 'count=exact';
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return { table, kind, status: res.status };
  } catch {
    return { table, kind, status: 0 };
  }
}

export async function GET(request: Request) {
  // Vercel は CRON_SECRET を設定すると Authorization ヘッダに付けて呼び出す。設定時のみ検証する
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, reason: 'supabase not configured' }, { status: 500 });
  }

  const results: Probe[] = [];
  for (const table of TABLES) {
    for (const kind of KINDS) {
      results.push(await probe(url, key, table, kind));
    }
  }
  const failed = results.filter((r) => r.status < 200 || r.status >= 300);
  const ok = failed.length === 0;
  return Response.json(
    { ok, requests: results.length, failed, at: new Date().toISOString() },
    { status: ok ? 200 : 502 },
  );
}
