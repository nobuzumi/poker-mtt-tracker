/**
 * Supabase Free プランは約1週間 API リクエストが無いとプロジェクトが自動停止する。
 * Vercel Cron(vercel.json)から毎日このエンドポイントを叩き、軽い SELECT を1回投げて停止を防ぐ。
 * RLS により匿名キーでは行は返らないが、API 経由の DB アクセスとしては「活動」に数えられる。
 */
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

  try {
    const res = await fetch(`${url}/rest/v1/tournaments?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    return Response.json(
      { ok: res.ok, status: res.status, at: new Date().toISOString() },
      { status: res.ok ? 200 : 502 },
    );
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 502 });
  }
}
