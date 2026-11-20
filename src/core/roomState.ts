import {
  ECONOMY,
  FLOOR_1_EXPANSIONS,
  FLOOR_1_INITIAL_GRIDS,
  FLOOR_2_EXPANSIONS,
  FLOOR_2_INITIAL_GRIDS,
  FLOOR_2_UNLOCK_COST,
  GRID_SIZE,
  type ExpansionStep,
} from '../data/economy';
import { CATALOG_MAP } from '../data/catalog';

// Room proportions aligned to ~55% wall / ~45% deep 2.5D floor on 960x540 HD canvas
export const CEILING_BOTTOM_Y = 46;
export const WALL_FLOOR_Y = 296;
export const FLOOR_MIN_FOOT_Y = 308;
export const FLOOR_MAX_FOOT_Y = 512;
export const SLAB_TOP_Y = 518;

export interface PlacedItem {
  uid: string;
  itemId: string;
  floor: 1 | 2;
  /** World X (left edge) in virtual pixels */
  x: number;
  /** World Y (top edge) in virtual pixels */
  y: number;
  variant: number;
  flipped: boolean;
  /** For lights or curtains */
  isActive: boolean;
  /** Parent furniture uid if resting on a tabletop/shelf/rug surface */
  parentId?: string;
  /** Day number when purchased (for same-day 100% refund vs 65% depreciation) */
  boughtOnDay: number;
  /** Purchase price snapshot for refund / weekly asset fee */
  purchasePrice: number;
  zOrder: number;
}

export interface InventoryItem {
  uid: string;
  itemId: string;
  variant: number;
  flipped: boolean;
  isActive: boolean;
  boughtOnDay: number;
  purchasePrice: number;
}

export interface FloorData {
  level: 1 | 2;
  unlocked: boolean;
  gridCount: number;
  wallSegments: string[];
  floorSegments: string[];
}

export interface GameSaveState {
  version: number;
  coins: number;
  day: number;
  minuteOfDay: number;
  lastSundayBillDay: number;
  activeFloor: 1 | 2;
  floors: Record<1 | 2, FloorData>;
  placedItems: PlacedItem[];
  inventory: InventoryItem[];
  nextUid: number;
}

const STORAGE_KEY = 'pixel_island_life_save_v4';

function filledSegments(count: number, styleId: string): string[] {
  return Array.from({ length: count }, () => styleId);
}

/**
 * Warm, richly arranged 2.5D starter 1F apartment (22 grids = 1320px wide)
 * utilizing real front-to-back floor depth + wall zones.
 */
export function createInitialSaveState(): GameSaveState {
  const f1Walls = filledSegments(FLOOR_1_INITIAL_GRIDS, 'warm_stripe');
  for (let i = 18; i < FLOOR_1_INITIAL_GRIDS; i++) {
    f1Walls[i] = 'aqua_bath_tile';
  }
  const f1Floors = filledSegments(FLOOR_1_INITIAL_GRIDS, 'warm_oak');
  for (let i = 18; i < FLOOR_1_INITIAL_GRIDS; i++) {
    f1Floors[i] = 'aqua_bath_floor';
  }

  let uidCounter = 1;
  const makeItem = (
    itemId: string,
    x: number,
    y: number,
    opts: Partial<PlacedItem> = {}
  ): PlacedItem => {
    const def = CATALOG_MAP.get(itemId);
    return {
      uid: `item_${uidCounter++}`,
      itemId,
      floor: 1,
      x,
      y,
      variant: 0,
      flipped: false,
      isActive: true,
      boughtOnDay: 0,
      purchasePrice: def?.price ?? 50,
      zOrder: uidCounter,
      ...opts,
    };
  };

  // Kitchen zone (cols 0..6): back wall fridge + stove (back corners strictly >= WALL_FLOOR_Y+2), foreground dining table + chairs
  const fridge = makeItem('retro_fridge', 18, 326 - 144, { variant: 0 });
  const stove = makeItem('kitchen_stove_counter', 114, 324 - 103, { variant: 0 });
  const cabinet = makeItem('kitchen_wall_cabinet', 126, 74, { variant: 0 });
  const pan = makeItem('frying_pan_simmer', 128, 221 + 26 - 27 + 4, { parentId: stove.uid });
  const mug1 = makeItem('coffee_mug_steaming', 228, 221 + 26 - 28 + 4, { variant: 1, parentId: stove.uid });

  const diningTable = makeItem('dining_table', 278, 448 - 85, { variant: 0 });
  const chairL = makeItem('dining_chair', 236, 446 - 78, { variant: 0 });
  const chairR = makeItem('dining_chair', 402, 446 - 78, { variant: 0, flipped: true });
  const omurice = makeItem('plate_omurice', 322, 363 + 16 - 20 + 4, { variant: 0, parentId: diningTable.uid });

  // Living room zone (cols 6..14): window + shelf + sofa near wall + Persian rug + cat + coffee table forward
  const window1 = makeItem('sunset_window', 286, 78, { variant: 0, isActive: true });
  const lamp1 = makeItem('pendant_ceiling_lamp', 298, CEILING_BOTTOM_Y, { variant: 0, isActive: true });
  const shelf = makeItem('wall_shelf_wide', 466, 112, { variant: 0 });
  const succ1 = makeItem('potted_succulent', 478, 112 + 11 - 34 + 4, { variant: 0, parentId: shelf.uid });
  const fig1 = makeItem('chibi_figurine_trio', 526, 112 + 11 - 40 + 4, { variant: 0, parentId: shelf.uid });
  const lamp2 = makeItem('pendant_ceiling_lamp', 408, CEILING_BOTTOM_Y, { variant: 0, isActive: true });

  const sofa = makeItem('plush_sofa', 428, 342 - 90, { variant: 0 });
  const rug = makeItem('persian_cozy_rug', 422, 478 - 58, { variant: 0 });
  const cat = makeItem('sleeping_ginger_cat_prop', 450, 420 + 32 - 33 + 4, { variant: 0, parentId: rug.uid });
  const coffeeTable = makeItem('coffee_table', 508, 434 - 58, { variant: 0 });
  const mug2 = makeItem('coffee_mug_steaming', 546, 376 + 12 - 28 + 4, { variant: 0, parentId: coffeeTable.uid });

  const stairs = makeItem('stairwell_door_1f', 618, WALL_FLOOR_Y - 172, { variant: 0 });
  const plant = makeItem('fiddle_leaf_plant', 724, 358 - 114, { variant: 0 });

  // Bedroom zone (cols 13.5..18)
  const divider1 = makeItem('room_divider_pillar', 794, CEILING_BOTTOM_Y, { variant: 0 });
  const art = makeItem('framed_landscape_art', 876, 92, { variant: 0 });
  const bed = makeItem('cozy_patchwork_bed', 824, 426 - 113, { variant: 0 });
  const nightstand = makeItem('bedside_nightstand', 1012, 354 - 62, { variant: 0 });
  const deskLamp = makeItem('table_lamp_warm', 1025, 292 + 10 - 44 + 4, { variant: 0, isActive: true, parentId: nightstand.uid });

  // Bath zone (cols 18..22)
  const divider2 = makeItem('room_divider_pillar', 1072, CEILING_BOTTOM_Y, { variant: 0 });
  const vanity = makeItem('bathroom_vanity', 1106, 320 - 134, { variant: 0 });
  const toilet = makeItem('cozy_toilet', 1228, 328 - 78, { variant: 0 });
  const bathtub = makeItem('clawfoot_bathtub', 1168, 464 - 135, { variant: 0 });
  const bathMat = makeItem('bath_checkered_mat', 1100, 498 - 42, { variant: 0 });

  return {
    version: 4,
    coins: ECONOMY.starterCoins,
    day: 1,
    minuteOfDay: 17 * 60 + 45,
    lastSundayBillDay: 0,
    activeFloor: 1,
    floors: {
      1: {
        level: 1,
        unlocked: true,
        gridCount: FLOOR_1_INITIAL_GRIDS,
        wallSegments: f1Walls,
        floorSegments: f1Floors,
      },
      2: {
        level: 2,
        unlocked: false,
        gridCount: FLOOR_2_INITIAL_GRIDS,
        wallSegments: filledSegments(FLOOR_2_INITIAL_GRIDS, 'cream_plaster'),
        floorSegments: filledSegments(FLOOR_2_INITIAL_GRIDS, 'birch_light'),
      },
    },
    placedItems: [
      fridge,
      stove,
      cabinet,
      pan,
      mug1,
      diningTable,
      chairL,
      chairR,
      omurice,
      window1,
      lamp1,
      shelf,
      succ1,
      fig1,
      lamp2,
      sofa,
      rug,
      cat,
      coffeeTable,
      mug2,
      stairs,
      plant,
      divider1,
      art,
      bed,
      nightstand,
      deskLamp,
      divider2,
      vanity,
      toilet,
      bathtub,
      bathMat,
    ],
    inventory: [],
    nextUid: uidCounter,
  };
}

export function loadSaveState(): GameSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSaveState();
    const parsed = JSON.parse(raw) as GameSaveState;
    if (!parsed || parsed.version !== 4 || !parsed.floors?.[1]) {
      return createInitialSaveState();
    }
    return parsed;
  } catch {
    return createInitialSaveState();
  }
}

export function persistSaveState(state: GameSaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function clearSaveState(): GameSaveState {
  const fresh = createInitialSaveState();
  persistSaveState(fresh);
  return fresh;
}

export function getNextExpansionForFloor(state: GameSaveState, floor: 1 | 2): ExpansionStep | null {
  const f = state.floors[floor];
  const steps = floor === 1 ? FLOOR_1_EXPANSIONS : FLOOR_2_EXPANSIONS;
  return steps.find((s) => s.targetGrids > f.gridCount) ?? null;
}

export function getFloorWidthPx(state: GameSaveState, floor: 1 | 2): number {
  return state.floors[floor].gridCount * GRID_SIZE;
}

export function getTotalUnlockedGrids(state: GameSaveState): number {
  let total = state.floors[1].gridCount;
  if (state.floors[2].unlocked) {
    total += state.floors[2].gridCount;
  }
  return total;
}

export function getTotalAssetValue(state: GameSaveState): number {
  let total = 0;
  for (const item of state.placedItems) {
    total += item.purchasePrice;
  }
  for (const item of state.inventory) {
    total += item.purchasePrice;
  }
  return total;
}

export function getTotalComfortScore(state: GameSaveState): number {
  let score = 0;
  for (const item of state.placedItems) {
    const def = CATALOG_MAP.get(item.itemId);
    if (def) score += def.comfort;
  }
  return score;
}

export function canUnlockFloor2(state: GameSaveState): { ok: boolean; cost: number; reason?: string } {
  if (state.floors[2].unlocked) return { ok: false, cost: 0, reason: '二楼已解锁' };
  if (state.coins < FLOOR_2_UNLOCK_COST) {
    return { ok: false, cost: FLOOR_2_UNLOCK_COST, reason: `需要 ${FLOOR_2_UNLOCK_COST} G 才能加盖二楼` };
  }
  return { ok: true, cost: FLOOR_2_UNLOCK_COST };
}
