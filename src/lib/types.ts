// 共通型定義
// 設計方針: GTO Wizard の Hand History Analyzer が読み取れる情報(PokerStars形式)を
// すべて生成できるだけのデータを保持する。

export type Card = string; // 例: "Ah", "Td", "2c" (ランク大文字 + スート小文字)

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

/** アンティ方式: classic = 全員が払う / bb = ビッグブラインドが全員分をまとめて払う(BBアンティ) / none */
export type AnteType = 'none' | 'classic' | 'bb';

export interface HandAction {
  street: Street;
  seat: number;
  type: ActionType;
  amount?: number;   // call: 追加で支払った額 / bet: ベット額 / raise: 上乗せ額(raise by)
  toAmount?: number; // raise: このストリートでの合計額(raise to)
  allIn?: boolean;
}

export interface HandPlayer {
  seat: number;          // 1..10
  name: string;
  startStack: number;    // ハンド開始時スタック(チップ)
  isHero: boolean;
  cards: Card[] | null;  // 判明しているホールカード(ヒーローは常時 / 相手はショウ時)
  bounty?: number;       // PKO: このプレイヤーの現在のバウンティ(賞金額)
}

export interface PotResult {
  seat: number;
  amount: number;
  potIndex: number; // 0 = メインポット
}

export interface UncalledEvent {
  street: Street;
  seat: number;
  amount: number;
}

export interface HandRecord {
  id: string;            // 数値文字列(PokerStars形式のHand IDに使用)
  tournamentId: string;
  handNo: number;
  timestamp: number;
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;          // classic: 1人あたり / bb: BBが払う合計
  anteType: AnteType;
  buttonSeat: number;
  sbSeat: number | null; // デッドSBなどでnullの可能性
  bbSeat: number;
  sbPosted: number;
  bbPosted: number;
  antesPosted: Record<number, number>;
  players: HandPlayer[];
  actions: HandAction[];
  board: Card[];
  uncalledEvents: UncalledEvent[];
  results: PotResult[];
  wentToShowdown: boolean;
  heroSeat: number;
  heroNet: number;       // ヒーローのこのハンドでの収支(チップ)
  // --- トーナメント状況(ICM/バウンティ分析の文脈。ハンド時点のスナップショット) ---
  playersRemaining?: number; // 残り人数
  tableSizeMax?: number;     // テーブルの最大人数(6/8/9)
  note?: string;
  tags?: string[];
  updatedAt: number;
  deleted?: boolean;
}

export interface CarryPlayer {
  seat: number;
  name: string;
  stack: number;
  isHero: boolean;
  bounty?: number;
}

export interface TableState {
  players: CarryPlayer[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  anteType: AnteType;
  level: number;
  playersRemaining?: number;
}

export interface Payout {
  place: number;   // 順位(1始まり)。範囲の先頭順位
  toPlace?: number; // 範囲の末尾順位(例: 10-18位は place=10, toPlace=18)
  amount: number;
}

export interface Tournament {
  id: string;        // 数値文字列(PokerStars形式のTournament IDに使用)
  name: string;
  venue?: string;
  date: string;      // YYYY-MM-DD
  currency: string;  // 'JPY' | 'USD' | ...
  buyIn: number;     // 賞金プール分
  fee: number;       // 手数料
  bounty: number;    // PKO: 初期バウンティ(0なら通常)
  isPko: boolean;
  tableSizeMax: number;     // 6 / 8 / 9 / 10
  anteType: AnteType;
  startingStack: number;
  totalEntries?: number;    // 総エントリー数
  payouts: Payout[];        // 賞金構造(ICM用)
  heroName: string;
  createdAt: number;
  updatedAt: number;
  handCount: number;
  lastState: TableState | null;
  finishedPlace?: number;
  prize?: number;
  note?: string;
  deleted?: boolean;
}

export interface HandSetup {
  players: HandPlayer[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  anteType: AnteType;
  level: number;
  playersRemaining?: number;
}
