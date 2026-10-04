'use client';
import { useEffect } from 'react';

/** 本番ビルドでのみ Service Worker を登録(オフラインでもアプリ殻を開けるようにする) */
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // 登録に失敗してもアプリは動く
    });
  }, []);
  return null;
}
