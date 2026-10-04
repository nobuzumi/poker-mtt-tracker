// 座席数とボタン位置からポジション名を割り当てる(表示用)
// ボタンから時計回りの順: BTN, SB, BB, UTG, ...
const LABELS_BY_COUNT: Record<number, string[]> = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO'],
};

/** seat番号 → ポジション名のマップを返す */
export function positionMap(seats: number[], buttonSeat: number): Record<number, string> {
  const sorted = [...seats].sort((a, b) => a - b);
  const n = sorted.length;
  const labels = LABELS_BY_COUNT[n] ?? LABELS_BY_COUNT[10];
  // ボタンから時計回り(seat昇順で循環)に並べる
  const order = [
    ...sorted.filter((s) => s >= buttonSeat),
    ...sorted.filter((s) => s < buttonSeat),
  ];
  // orderの先頭がボタン。buttonSeatが空席になることは想定しない
  const map: Record<number, string> = {};
  order.forEach((seat, i) => {
    map[seat] = labels[i] ?? `P${i}`;
  });
  return map;
}

/** ローマ数字変換(トーナメントレベル表示用) */
export function toRoman(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return 'I';
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = Math.floor(num);
  let out = '';
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
