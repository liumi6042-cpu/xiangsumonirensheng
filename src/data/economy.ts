/**
 * Global Economy Single Source of Truth (Phase 1 -> Phase 6)
 * Anchored around 档位 B (1 real sec = 1 game min, 24 real min = 1 game day).
 */

export const GRID_SIZE = 60;
export const VIRTUAL_WIDTH = 960;  // 16 grids wide
export const VIRTUAL_HEIGHT = 540; // 9 grids tall (HD 2.5D dollhouse: ~55% wall / ~45% floor)

export const ECONOMY = {
  /** Starting cash after renting starter home */
  starterCoins: 1200,
  /** Everyday baseline price anchors */
  coffeePrice: 18,
  homeMealCost: 12,
  nightMarketSnackPrice: 28,
  gachaPullPrice: 180,
  /** Wallpaper & flooring repaint price per grid column */
  surfacePricePerGrid: 15,
  /** Same-day regret protection vs next-day depreciation */
  sameDayRefundRate: 1.0,
  usedResaleRate: 0.65,
  /** Sunday 20:00 weekly utility & property bill */
  billBaseFee: 80,
  billPerGridFee: 4,
  billAssetRate: 0.015,
  /** Phase 1 sandbox/test stipend so players can test big expansions right away if desired */
  testStipendAmount: 500,
} as const;

export type ItemTier = 'T1' | 'T2' | 'T3' | 'T4';

export interface ExpansionStep {
  floor: 1 | 2;
  targetGrids: number;
  addedGrids: number;
  cost: number;
  label: string;
}

export const FLOOR_1_INITIAL_GRIDS = 32;
export const FLOOR_2_INITIAL_GRIDS = 28;
export const FLOOR_2_UNLOCK_COST = 4500;

export const FLOOR_1_EXPANSIONS: ExpansionStep[] = [
  { floor: 1, targetGrids: 38, addedGrids: 6, cost: 800, label: '1F 首次向右扩建（32格 → 38格，+阳光阳台）' },
  { floor: 1, targetGrids: 44, addedGrids: 6, cost: 1800, label: '1F 二次阔气扩容（38格 → 44格，大客厅）' },
  { floor: 1, targetGrids: 52, addedGrids: 8, cost: 3200, label: '1F 终极通透大平层（44格 → 52格）' },
];

export const FLOOR_2_EXPANSIONS: ExpansionStep[] = [
  { floor: 2, targetGrids: 34, addedGrids: 6, cost: 2600, label: '2F 向右扩建（28格 → 34格）' },
  { floor: 2, targetGrids: 42, addedGrids: 8, cost: 4200, label: '2F 终极全景露台层（34格 → 42格）' },
];

/** Ready for Phase 3–4 integration so wages stay locked to furniture & expansion curves */
export const CAREER_WAGE_TABLE = {
  sideGig: { min: 40, max: 90 },
  entryJob: { min: 160, max: 240, activeTipBonus: [40, 80] },
  midFreelanceAndMarket: {
    min: 380,
    max: 680,
    nightMarketMarginMultiplier: [1.6, 2.4],
    nightMarketMaxSalesPerNight: 10,
  },
  expertCareer: { min: 850, max: 1500 },
  roommateRentEvery3Days: { min: 180, max: 300 },
} as const;

export function getSellRefund(price: number, boughtOnDay: number, currentDay: number): {
  refund: number;
  isSameDay: boolean;
} {
  const isSameDay = boughtOnDay >= currentDay;
  const rate = isSameDay ? ECONOMY.sameDayRefundRate : ECONOMY.usedResaleRate;
  return {
    refund: Math.max(1, Math.round(price * rate)),
    isSameDay,
  };
}

export function calculateWeeklyBill(totalGrids: number, totalAssetValue: number): {
  baseFee: number;
  gridFee: number;
  assetFee: number;
  total: number;
} {
  const baseFee = ECONOMY.billBaseFee;
  const gridFee = totalGrids * ECONOMY.billPerGridFee;
  const assetFee = Math.round(totalAssetValue * ECONOMY.billAssetRate);
  return {
    baseFee,
    gridFee,
    assetFee,
    total: baseFee + gridFee + assetFee,
  };
}
