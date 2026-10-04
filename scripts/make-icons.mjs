// PWA用アイコン(PNG)を外部ライブラリなしで生成する: 緑の角丸背景 + 白いスペード
// 実行: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (width * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// スペード形状: 2つの円 + 下向き三角(逆さハート) + 脚
function inSpade(px, py) {
  // 正規化座標: 中心(0,0)、半径1がアイコン半分
  const x = px, y = py;
  // 上の尖り〜ふくらみ(ハートの上下反転)
  const hx = x, hy = y; // ハートを上下反転してスペードにする
  const heart = (() => {
    const X = hx * 1.25, Y = hy * 1.25 + 0.1;
    const a = X * X + Y * Y - 1;
    return a * a * a - X * X * Y * Y * Y < 0;
  })();
  // 脚: 中央下に台形
  const stem = Math.abs(x) < 0.08 + Math.max(0, y - 0.6) * 0.9 && y > 0.3 && y < 0.98;
  return heart || stem;
}

function render(size, { rounded, pad }) {
  const r = size * 0.22;
  return png(size, size, (x, y) => {
    // 角丸判定
    if (rounded) {
      const cx = Math.min(Math.max(x, r), size - r);
      const cy = Math.min(Math.max(y, r), size - r);
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return [0, 0, 0, 0];
    }
    // 背景グラデーション(上が明るい緑)
    const t = y / size;
    const bg = [Math.round(27 + (14 - 27) * t), Math.round(110 + (70 - 110) * t), Math.round(66 + (42 - 66) * t)];
    const nx = ((x + 0.5) / size - 0.5) * 2 / pad;
    const ny = ((y + 0.5) / size - 0.5) * 2 / pad - 0.02;
    if (inSpade(nx, ny)) return [250, 252, 250, 255];
    return [bg[0], bg[1], bg[2], 255];
  });
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', render(192, { rounded: false, pad: 0.72 }));
writeFileSync('public/icon-512.png', render(512, { rounded: false, pad: 0.72 }));
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false, pad: 0.72 }));
console.log('icons written');
