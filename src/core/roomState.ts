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
import { createInitialResidents, type ResidentState } from './characters';

// Room proportions aligned 1:1 with 120x338 cartoon wallpaper & 120x202 floor tiles on 960x540 HD canvas
export const CEILING_BOTTOM_Y = 16;
export const WALL_FLOOR_Y = 338;
export const FLOOR_MIN_FOOT_Y = 348;
export const FLOOR_MAX_FOOT_Y = 516;
export const SLAB_TOP_Y = 524;

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
  residents: ResidentState[];
  nextUid: number;
}

const STORAGE_KEY = 'pixel_island_life_save_v5';

function filledSegments(count: number, styleId: string): string[] {
  return Array.from({ length: count }, () => styleId);
}

/**
 * Cozy two-screen 2.5D starter 1F apartment (32 grids = 1920px wide) tailored
 * to our Japanese cozy journal cartoon sprites & seamless surface tiles.
 */
export function createInitialSaveState(): GameSaveState {
  const f1Walls = filledSegments(FLOOR_1_INITIAL_GRIDS, 'warm_stripe');
  const f1Floors = filledSegments(FLOOR_1_INITIAL_GRIDS, 'warm_oak');

  // Living room (cols 9..18): sage-mint wainscot + light birch floor
  for (let i = 9; i < 19; i++) {
    f1Walls[i] = 'sage_botanical';
    f1Floors[i] = 'birch_light';
  }
  // Bedroom (cols 19..25): peach polka wall + warm oak floor
  for (let i = 19; i < 26; i++) {
    f1Walls[i] = 'peach_gingham';
    f1Floors[i] = 'warm_oak';
  }
  // Bathroom (cols 26..31): aqua mosaic + terrazzo bath floor
  for (let i = 26; i < FLOOR_1_INITIAL_GRIDS; i++) {
    f1Walls[i] = 'aqua_bath_tile';
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

  // Kitchen & Dining zone (cols 0..8, 0..540)
  const fridge = makeItem('retro_fridge', 18, 372 - 203, { variant: 0 });
  const stove = makeItem('kitchen_stove_counter', 148, 370 - 125, { variant: 0 });
  const cabinet = makeItem('kitchen_wall_cabinet', 166, 66, { variant: 0 });
  const pan = makeItem('frying_pan_simmer', 228, 245 + 40 - 46 + 4, { parentId: stove.uid });

  const diningTable = makeItem('dining_table', 328, 486 - 118, { variant: 0 });
  const chairL = makeItem('dining_chair', 274, 480 - 112, { variant: 0 });
  const chairR = makeItem('dining_chair', 492, 480 - 112, { variant: 0, flipped: true });
  const omurice = makeItem('plate_omurice', 352, 368 + 28 - 34 + 4, { variant: 0, parentId: diningTable.uid });
  const cake = makeItem('strawberry_cake', 422, 368 + 28 - 61 + 4, { variant: 0, parentId: diningTable.uid });

  // Living zone (cols 9..18, 540..1140) — crisp wood pillar hides dining/living wall seam cleanly
  const divider0 = makeItem('room_divider_pillar', 526, CEILING_BOTTOM_Y, { variant: 0 });
  const window1 = makeItem('sunset_window', 648, 72, { variant: 0, isActive: true });
  const lamp1 = makeItem('pendant_ceiling_lamp', 806, CEILING_BOTTOM_Y, { variant: 0, isActive: true });
  const shelf = makeItem('wall_shelf_wide', 874, 114, { variant: 0 });
  const succ1 = makeItem('potted_succulent', 892, 114 + 11 - 49 + 4, { variant: 0, parentId: shelf.uid });
  const fig1 = makeItem('chibi_figurine_trio', 946, 114 + 11 - 56 + 4, { variant: 0, parentId: shelf.uid });

  const sofa = makeItem('plush_sofa', 628, 390 - 120, { variant: 0 });
  const rug = makeItem('persian_cozy_rug', 612, 398, { variant: 0 });
  const cat = makeItem('sleeping_ginger_cat_prop', 632, 398 + 62 - 53 + 4, { variant: 0, parentId: rug.uid });
  const coffeeTable = makeItem('coffee_table', 706, 492 - 79, { variant: 0 });
  const mug2 = makeItem('coffee_mug_steaming', 756, 413 + 20 - 44 + 4, { variant: 0, parentId: coffeeTable.uid });
  const floorLamp = makeItem('floor_standing_lamp', 896, 394 - 184, { variant: 0, isActive: true });
  const stairs = makeItem('stairwell_door_1f', 974, WALL_FLOOR_Y - 226, { variant: 0 });

  // Bedroom zone (cols 19..25, 1140..1560) — divider centered on x=1140 seam
  const divider1 = makeItem('room_divider_pillar', 1126, CEILING_BOTTOM_Y, { variant: 0 });
  const plant = makeItem('fiddle_leaf_plant', 1166, 386 - 169, { variant: 0 });
  const art = makeItem('framed_landscape_art', 1296, 76, { variant: 0 });
  const bed = makeItem('cozy_patchwork_bed', 1234, 480 - 191, { variant: 0 });
  const nightstand = makeItem('bedside_nightstand', 1480, 384 - 89, { variant: 0 });
  const deskLamp = makeItem('table_lamp_warm', 1494, 295 + 20 - 58 + 4, { variant: 0, isActive: true, parentId: nightstand.uid });

  // Bath zone (cols 26..31, 1560..1920) — divider centered on x=1560 seam
  const divider2 = makeItem('room_divider_pillar', 1546, CEILING_BOTTOM_Y, { variant: 2 });
  const vanity = makeItem('bathroom_vanity', 1592, 378 - 194, { variant: 0 });
  const toilet = makeItem('cozy_toilet', 1732, 376 - 112, { variant: 0 });
  const bathtub = makeItem('clawfoot_bathtub', 1712, 504 - 130, { variant: 0 });
  const bathMat = makeItem('bath_checkered_mat', 1574, 444, { variant: 0 });

  return {
    version: 5,
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
        wallSegments: filledSegments(FLOOR_2_INITIAL_GRIDS, 'peach_gingham'),
        floorSegments: filledSegments(FLOOR_2_INITIAL_GRIDS, 'birch_light'),
      },
    },
    placedItems: [
      fridge,
      stove,
      cabinet,
      pan,
      diningTable,
      chairL,
      chairR,
      omurice,
      cake,
      divider0,
      window1,
      lamp1,
      shelf,
      succ1,
      fig1,
      sofa,
      rug,
      cat,
      coffeeTable,
      mug2,
      floorLamp,
      stairs,
      divider1,
      plant,
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
    residents: createInitialResidents(),
    nextUid: uidCounter,
  };
}

export function loadSaveState(): GameSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSaveState();
    const parsed = JSON.parse(raw) as GameSaveState;
    if (!parsed || parsed.version !== 5 || !parsed.floors?.[1]) {
      return createInitialSaveState();
    }
    if (!Array.isArray(parsed.residents) || parsed.residents.length === 0) {
      parsed.residents = createInitialResidents();
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
