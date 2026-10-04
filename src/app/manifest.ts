import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MTT Hand Tracker',
    short_name: 'MTT Tracker',
    description: 'ライブMTTのハンドを記録し、GTO Wizard 用のハンドヒストリーを書き出す',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e1412',
    theme_color: '#0e1412',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
