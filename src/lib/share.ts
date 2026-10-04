'use client';
// クリップボード / 共有シート / ダウンロードのヘルパー(iPhone Safari を想定)

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 古い環境向けフォールバック
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** テキストファイルとして共有(Web Share API)。使えなければダウンロードにフォールバック */
export async function shareTextFile(filename: string, text: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/plain' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      // ユーザーがキャンセルした場合も含む
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }
  return downloadText(filename, text) ? 'downloaded' : 'failed';
}

export function downloadText(filename: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
