import type { AtlasJson, CharacterSpriteRect } from '../data/catalog';
import { GRID_SIZE } from '../data/economy';
import type { FloorData, PlacedItem } from './roomState';

export type ResidentId =
  | 'girl'
  | 'boy'
  | 'grandpa'
  | 'florist_girl'
  | 'chef_barista'
  | 'toddler_kid'
  | 'shiba';

export type ResidentOutfit = 'basic' | 'pajama' | 'summer' | 'coat' | 'sport';
export type ResidentAction = 'idle' | 'walk' | 'sit' | 'sleep' | 'wave';

export interface ResidentState {
  id: ResidentId;
  present: boolean;
  floor: 1 | 2;
  /** World X center in virtual pixels */
  x: number;
  /** World Y bottom/foot baseline in virtual pixels */
  y: number;
  facing: 'left' | 'right';
  outfit: ResidentOutfit;
  action: ResidentAction;
  targetX?: number;
  targetY?: number;
  stateTimer: number;
  walkPhase: number;
  seatedUid?: string;
  seatedSlotIdx?: number;
  sleepBedUid?: string;
  emoteText?: string;
  emoteTimer: number;
  greetCooldown: number;
}

export interface ResidentDef {
  id: ResidentId;
  name: string;
  role: string;
  isPet?: boolean;
  hasPoseSprites: boolean;
  outfits: Array<{ id: ResidentOutfit; label: string }>;
  defaultSprite: string;
  walkSpeed: number;
}

export const RESIDENT_DEFS: ResidentDef[] = [
  {
    id: 'girl',
    name: '小葵',
    role: '主角 · 手账少女',
    hasPoseSprites: true,
    outfits: [
      { id: 'basic', label: '麻花毛衣' },
      { id: 'pajama', label: '格子睡衣' },
      { id: 'summer', label: '草帽夏裙' },
      { id: 'coat', label: '焦糖大衣' },
    ],
    defaultSprite: 'char_girl_basic',
    walkSpeed: 68,
  },
  {
    id: 'boy',
    name: '阿墨',
    role: '主角 · 暖系少年',
    hasPoseSprites: true,
    outfits: [
      { id: 'basic', label: '燕麦衬衫' },
      { id: 'pajama', label: '条纹睡衣' },
      { id: 'summer', label: '度假夏装' },
      { id: 'sport', label: '棒球外套' },
    ],
    defaultSprite: 'char_boy_basic',
    walkSpeed: 72,
  },
  {
    id: 'grandpa',
    name: '福伯',
    role: '茶室爷爷',
    hasPoseSprites: false,
    outfits: [{ id: 'basic', label: '针织开衫' }],
    defaultSprite: 'char_grandpa',
    walkSpeed: 46,
  },
  {
    id: 'florist_girl',
    name: '小夏',
    role: '园艺咖啡师',
    hasPoseSprites: false,
    outfits: [{ id: 'basic', label: '橄榄围裙' }],
    defaultSprite: 'char_florist_girl',
    walkSpeed: 66,
  },
  {
    id: 'chef_barista',
    name: '麦麦',
    role: '烘焙主厨',
    hasPoseSprites: false,
    outfits: [{ id: 'basic', label: '报童帽围裙' }],
    defaultSprite: 'char_chef_barista',
    walkSpeed: 64,
  },
  {
    id: 'toddler_kid',
    name: '芽芽',
    role: '阳光小萌娃',
    hasPoseSprites: false,
    outfits: [{ id: 'basic', label: '水手背带裤' }],
    defaultSprite: 'char_toddler_kid',
    walkSpeed: 58,
  },
  {
    id: 'shiba',
    name: '豆包',
    role: '绿色方巾小柴犬',
    isPet: true,
    hasPoseSprites: false,
    outfits: [{ id: 'basic', label: '抹茶方巾' }],
    defaultSprite: 'shiba_dog_pet',
    walkSpeed: 76,
  },
];

export const RESIDENT_DEF_MAP = new Map<ResidentId, ResidentDef>(
  RESIDENT_DEFS.map((d) => [d.id, d])
);

const EMOTE_POOL = ['✨', '☕', '🎵', '🌸', '💛', '☀️'];
const PET_EMOTE_POOL = ['🐾', '🦴', '❤️', '✨'];

export function createInitialResidents(): ResidentState[] {
  return [
    {
      id: 'girl',
      present: true,
      floor: 1,
      x: 560,
      y: 446,
      facing: 'right',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 2.0,
      walkPhase: 0,
      emoteText: '✨',
      emoteTimer: 2.6,
      greetCooldown: 4,
    },
    {
      id: 'boy',
      present: true,
      floor: 1,
      x: 410,
      y: 468,
      facing: 'right',
      outfit: 'basic',
      action: 'wave',
      stateTimer: 2.8,
      walkPhase: 0,
      emoteText: '👋',
      emoteTimer: 2.8,
      greetCooldown: 4,
    },
    {
      id: 'shiba',
      present: true,
      floor: 1,
      x: 690,
      y: 472,
      facing: 'left',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 3.2,
      walkPhase: 0,
      emoteText: '🐾',
      emoteTimer: 2.5,
      greetCooldown: 5,
    },
    {
      id: 'grandpa',
      present: false,
      floor: 1,
      x: 860,
      y: 454,
      facing: 'left',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 2.5,
      walkPhase: 0,
      emoteTimer: 0,
      greetCooldown: 3,
    },
    {
      id: 'florist_girl',
      present: false,
      floor: 1,
      x: 920,
      y: 462,
      facing: 'left',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 2.5,
      walkPhase: 0,
      emoteTimer: 0,
      greetCooldown: 3,
    },
    {
      id: 'chef_barista',
      present: false,
      floor: 1,
      x: 240,
      y: 458,
      facing: 'right',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 2.5,
      walkPhase: 0,
      emoteTimer: 0,
      greetCooldown: 3,
    },
    {
      id: 'toddler_kid',
      present: false,
      floor: 1,
      x: 780,
      y: 478,
      facing: 'left',
      outfit: 'basic',
      action: 'idle',
      stateTimer: 2.5,
      walkPhase: 0,
      emoteTimer: 0,
      greetCooldown: 3,
    },
  ];
}

export function resolveResidentSprite(res: ResidentState): {
  spriteKey: string;
  bobOffsetY: number;
  squishScaleY: number;
} {
  const def = RESIDENT_DEF_MAP.get(res.id)!;
  if (!def.hasPoseSprites) {
    // Non-protagonists & pet use subtle expressive motion transforms cleanly
    if (res.action === 'walk') {
      return {
        spriteKey: def.defaultSprite,
        bobOffsetY: -Math.abs(Math.sin(res.walkPhase * Math.PI)) * 3.5,
        squishScaleY: 1,
      };
    }
    if (res.action === 'wave') {
      return {
        spriteKey: def.defaultSprite,
        bobOffsetY: -Math.abs(Math.sin(res.walkPhase * 4.2)) * 4.5,
        squishScaleY: 1,
      };
    }
    if (res.action === 'sit') {
      return {
        spriteKey: def.defaultSprite,
        bobOffsetY: 0,
        squishScaleY: 0.94,
      };
    }
    if (res.action === 'sleep') {
      return {
        spriteKey: def.defaultSprite,
        bobOffsetY: Math.sin(res.walkPhase * 1.4) * 1.2,
        squishScaleY: 0.9,
      };
    }
    return { spriteKey: def.defaultSprite, bobOffsetY: 0, squishScaleY: 1 };
  }

  // Girl / Boy protagonists with full pose & outfit sheets
  if (res.outfit === 'basic') {
    if (res.action === 'walk') {
      const frame = Math.floor(res.walkPhase) % 2 === 0 ? `char_${res.id}_walk_1` : `char_${res.id}_walk_2`;
      return { spriteKey: frame, bobOffsetY: -Math.abs(Math.sin(res.walkPhase * Math.PI)) * 1.8, squishScaleY: 1 };
    }
    if (res.action === 'sit') {
      return { spriteKey: `char_${res.id}_sit`, bobOffsetY: 0, squishScaleY: 1 };
    }
    if (res.action === 'wave') {
      return {
        spriteKey: `char_${res.id}_happy_wave`,
        bobOffsetY: -Math.abs(Math.sin(res.walkPhase * 4.0)) * 3.5,
        squishScaleY: 1,
      };
    }
    if (res.action === 'sleep') {
      return { spriteKey: `char_${res.id}_sleep`, bobOffsetY: 0, squishScaleY: 1 };
    }
    return { spriteKey: `char_${res.id}_basic`, bobOffsetY: 0, squishScaleY: 1 };
  }

  // Custom outfits ('pajama' | 'summer' | 'coat' | 'sport')
  const outfitKey = `char_${res.id}_outfit_${res.outfit}`;
  if (res.action === 'walk') {
    return {
      spriteKey: outfitKey,
      bobOffsetY: -Math.abs(Math.sin(res.walkPhase * Math.PI)) * 3.5,
      squishScaleY: 1,
    };
  }
  if (res.action === 'wave') {
    return {
      spriteKey: outfitKey,
      bobOffsetY: -Math.abs(Math.sin(res.walkPhase * 4.0)) * 4.0,
      squishScaleY: 1,
    };
  }
  if (res.action === 'sit') {
    return { spriteKey: outfitKey, bobOffsetY: 0, squishScaleY: 0.94 };
  }
  if (res.action === 'sleep') {
    return { spriteKey: outfitKey, bobOffsetY: Math.sin(res.walkPhase * 1.5) * 1.0, squishScaleY: 0.92 };
  }
  return { spriteKey: outfitKey, bobOffsetY: 0, squishScaleY: 1 };
}

export function getResidentSpriteRect(res: ResidentState, atlas: AtlasJson): CharacterSpriteRect | null {
  const { spriteKey } = resolveResidentSprite(res);
  return atlas.characters?.[spriteKey] ?? null;
}

export function getAvailableSeatsOnFloor(
  placedOnFloor: PlacedItem[],
  residents: ResidentState[],
  atlas: AtlasJson,
  ignoreResId?: ResidentId
): Array<{ host: PlacedItem; slotIdx: number; seatX: number; seatFootY: number; sortFootY: number; facing?: 'left' | 'right' }> {
  const out: Array<{ host: PlacedItem; slotIdx: number; seatX: number; seatFootY: number; sortFootY: number; facing?: 'left' | 'right' }> = [];

  for (const host of placedOnFloor) {
    const meta = atlas.items[host.itemId];
    if (!meta?.seats || meta.seats.length === 0) continue;

    for (let idx = 0; idx < meta.seats.length; idx++) {
      const s = meta.seats[idx];
      const occupied = residents.some(
        (r) => r.present && r.id !== ignoreResId && r.action === 'sit' && r.seatedUid === host.uid && r.seatedSlotIdx === idx
      );
      if (occupied) continue;

      const localDx = host.flipped ? meta.w - s.dx : s.dx;
      const seatX = host.x + localDx;
      const dangle = host.itemId === 'balcony_egg_chair' ? 28 : 38;
      const seatFootY = host.y + s.seatY + dangle;
      const sortFootY = host.y + meta.h + 2;
      const facing =
        host.itemId === 'dining_chair' || host.itemId === 'patio_lounge_chair'
          ? host.flipped
            ? 'left'
            : 'right'
          : undefined;
      out.push({ host, slotIdx: idx, seatX, seatFootY, sortFootY, facing });
    }
  }
  return out;
}

export function getBedSleepTargetsOnFloor(
  placedOnFloor: PlacedItem[],
  residents: ResidentState[],
  atlas: AtlasJson,
  ignoreResId?: ResidentId
): Array<{ bed: PlacedItem; x: number; footY: number; sortFootY: number }> {
  const out: Array<{ bed: PlacedItem; x: number; footY: number; sortFootY: number }> = [];
  for (const bed of placedOnFloor) {
    const meta = atlas.items[bed.itemId];
    if (!meta?.sleepAnchor) continue;
    const occupied = residents.some(
      (r) => r.present && r.id !== ignoreResId && r.action === 'sleep' && r.sleepBedUid === bed.uid
    );
    if (occupied) continue;

    const dx = bed.flipped ? meta.w - meta.sleepAnchor.dx : meta.sleepAnchor.dx;
    out.push({
      bed,
      x: bed.x + dx,
      footY: bed.y + meta.sleepAnchor.dy + 40,
      sortFootY: bed.y + meta.h + 2,
    });
  }
  return out;
}

export function assignResidentWalk(res: ResidentState, floorW: number, tx?: number, ty?: number): void {
  res.seatedUid = undefined;
  res.seatedSlotIdx = undefined;
  res.sleepBedUid = undefined;
  res.action = 'walk';
  res.targetX = Math.max(54, Math.min(floorW - 54, tx ?? 70 + Math.random() * Math.max(80, floorW - 140)));
  res.targetY = Math.max(362, Math.min(508, ty ?? 368 + Math.random() * 134));
  res.facing = res.targetX >= res.x ? 'right' : 'left';
  res.stateTimer = 8;
}

export function assignResidentSit(
  res: ResidentState,
  seat: { host: PlacedItem; slotIdx: number; seatX: number; seatFootY: number; facing?: 'left' | 'right' }
): void {
  res.sleepBedUid = undefined;
  res.action = 'sit';
  res.seatedUid = seat.host.uid;
  res.seatedSlotIdx = seat.slotIdx;
  res.x = seat.seatX;
  res.y = seat.seatFootY;
  if (seat.facing) res.facing = seat.facing;
  res.stateTimer = 6 + Math.random() * 7;
  res.emoteText = RESIDENT_DEF_MAP.get(res.id)?.isPet ? '🐾' : '☕';
  res.emoteTimer = 1.6;
}

export function assignResidentSleep(
  res: ResidentState,
  bedTarget: { bed: PlacedItem; x: number; footY: number }
): void {
  res.seatedUid = undefined;
  res.seatedSlotIdx = undefined;
  res.action = 'sleep';
  res.sleepBedUid = bedTarget.bed.uid;
  res.x = bedTarget.x;
  res.y = bedTarget.footY;
  res.stateTimer = 8 + Math.random() * 8;
  res.emoteText = '💤';
  res.emoteTimer = 2.6;
}

export function triggerResidentWave(res: ResidentState, customEmote?: string): void {
  const def = RESIDENT_DEF_MAP.get(res.id)!;
  if (res.action === 'sit' || res.action === 'sleep') {
    res.seatedUid = undefined;
    res.seatedSlotIdx = undefined;
    res.sleepBedUid = undefined;
    res.y = Math.max(362, Math.min(508, res.y));
  }
  res.action = 'wave';
  res.stateTimer = 2.4;
  res.walkPhase = 0;
  const pool = def.isPet ? PET_EMOTE_POOL : EMOTE_POOL;
  res.emoteText = customEmote ?? pool[Math.floor(Math.random() * pool.length)];
  res.emoteTimer = 2.2;
}

export function updateResidents(
  residents: ResidentState[],
  placedItems: PlacedItem[],
  floors: Record<1 | 2, FloorData>,
  atlas: AtlasJson,
  dt: number,
  speedMult: number,
  hourOfDay: number,
  draggedId: ResidentId | null
): void {
  if (speedMult <= 0) return;
  const stepDt = dt * (speedMult === 1 ? 1 : speedMult === 2 ? 1.8 : 2.8);

  for (const res of residents) {
    if (!res.present || res.id === draggedId) continue;

    const floorData = floors[res.floor];
    const floorW = floorData.gridCount * GRID_SIZE;
    const placedOnFloor = placedItems.filter((p) => p.floor === res.floor);

    res.emoteTimer = Math.max(0, res.emoteTimer - stepDt);
    if (res.emoteTimer <= 0) res.emoteText = undefined;
    res.greetCooldown = Math.max(0, res.greetCooldown - stepDt);

    // Keep seated/sleeping residents locked to host furniture if furniture moved or got sold!
    if (res.action === 'sit' && res.seatedUid) {
      const host = placedOnFloor.find((p) => p.uid === res.seatedUid);
      const hm = host ? atlas.items[host.itemId] : undefined;
      const seat = hm?.seats?.[res.seatedSlotIdx ?? 0];
      if (!host || !hm || !seat) {
        res.action = 'idle';
        res.seatedUid = undefined;
        res.y = Math.max(366, Math.min(504, res.y));
      } else {
        const localDx = host.flipped ? hm.w - seat.dx : seat.dx;
        res.x = host.x + localDx;
        res.y = host.y + seat.seatY + (host.itemId === 'balcony_egg_chair' ? 28 : 38);
      }
    } else if (res.action === 'sleep' && res.sleepBedUid) {
      const bed = placedOnFloor.find((p) => p.uid === res.sleepBedUid);
      const bm = bed ? atlas.items[bed.itemId] : undefined;
      if (!bed || !bm?.sleepAnchor) {
        res.action = 'idle';
        res.sleepBedUid = undefined;
        res.y = Math.max(366, Math.min(504, res.y));
      } else {
        const dx = bed.flipped ? bm.w - bm.sleepAnchor.dx : bm.sleepAnchor.dx;
        res.x = bed.x + dx;
        res.y = bed.y + bm.sleepAnchor.dy + 40;
        if (Math.random() < stepDt * 0.25) {
          res.emoteText = '💤';
          res.emoteTimer = 1.8;
        }
      }
    }

    if (res.action === 'walk') {
      const tx = res.targetX ?? res.x;
      const ty = res.targetY ?? res.y;
      const dx = tx - res.x;
      const dy = ty - res.y;
      const dist = Math.hypot(dx, dy);
      const speed = RESIDENT_DEF_MAP.get(res.id)?.walkSpeed ?? 64;

      if (dist < 4) {
        res.x = tx;
        res.y = ty;
        res.action = 'idle';
        res.stateTimer = 1.6 + Math.random() * 2.8;
      } else {
        res.facing = dx >= 0 ? 'right' : 'left';
        const step = Math.min(dist, speed * stepDt);
        res.x += (dx / dist) * step;
        res.y += (dy / dist) * step;
        res.walkPhase += stepDt * 3.8;
      }
    } else {
      res.walkPhase += stepDt * 2.2;
      res.stateTimer -= stepDt;
    }

    // Clamp to valid floor area when not attached to seat/bed
    if (res.action === 'idle' || res.action === 'walk' || res.action === 'wave') {
      res.x = Math.max(46, Math.min(floorW - 46, res.x));
      res.y = Math.max(360, Math.min(510, res.y));
    }

    // State transitions when timer finishes
    if (res.stateTimer <= 0) {
      if (res.action === 'sit' || res.action === 'sleep' || res.action === 'wave') {
        // Stand back up politely near floor center & walk
        if (res.action === 'sit' || res.action === 'sleep') {
          res.y = Math.max(372, Math.min(498, res.y + 8));
        }
        assignResidentWalk(res, floorW);
      } else {
        // Idle -> decide next cozy autonomous activity
        const roll = Math.random();
        const isNight = hourOfDay >= 21 || hourOfDay < 6;
        if (isNight && roll < 0.35) {
          const beds = getBedSleepTargetsOnFloor(placedOnFloor, residents, atlas, res.id);
          if (beds.length > 0) {
            assignResidentSleep(res, beds[Math.floor(Math.random() * beds.length)]);
            continue;
          }
        }
        if (roll < 0.28) {
          const seats = getAvailableSeatsOnFloor(placedOnFloor, residents, atlas, res.id);
          if (seats.length > 0) {
            assignResidentSit(res, seats[Math.floor(Math.random() * seats.length)]);
            continue;
          }
        }
        if (roll < 0.85) {
          assignResidentWalk(res, floorW);
        } else {
          triggerResidentWave(res);
        }
      }
    }
  }

  // Friendly proximity greeting between strolling characters
  for (let i = 0; i < residents.length; i++) {
    const a = residents[i];
    if (!a.present || a.id === draggedId || a.greetCooldown > 0) continue;
    if (a.action !== 'walk' && a.action !== 'idle') continue;
    for (let j = i + 1; j < residents.length; j++) {
      const b = residents[j];
      if (!b.present || b.id === draggedId || b.floor !== a.floor || b.greetCooldown > 0) continue;
      if (b.action !== 'walk' && b.action !== 'idle') continue;
      if (Math.abs(a.x - b.x) < 58 && Math.abs(a.y - b.y) < 34 && Math.random() < 0.08) {
        a.facing = b.x >= a.x ? 'right' : 'left';
        b.facing = a.x >= b.x ? 'right' : 'left';
        a.greetCooldown = 14;
        b.greetCooldown = 14;
        triggerResidentWave(a, RESIDENT_DEF_MAP.get(a.id)?.isPet ? '🐾' : '👋');
        triggerResidentWave(b, RESIDENT_DEF_MAP.get(b.id)?.isPet ? '❤️' : '✨');
      }
    }
  }
}

export function hitTestResident(
  worldX: number,
  worldY: number,
  floor: 1 | 2,
  residents: ResidentState[],
  atlas: AtlasJson
): ResidentState | null {
  const onFloor = residents
    .filter((r) => r.present && r.floor === floor)
    .sort((a, b) => b.y - a.y);

  for (const r of onFloor) {
    const rect = getResidentSpriteRect(r, atlas);
    const w = rect?.w ?? 72;
    const h = rect?.h ?? 136;
    const left = r.x - w / 2 - 4;
    const right = r.x + w / 2 + 4;
    const top = r.y - h - 2;
    const bottom = r.y + 4;
    if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
      return r;
    }
  }
  return null;
}

export function computeResidentSortY(res: ResidentState, placedOnFloor: PlacedItem[], atlas: AtlasJson): number {
  if (res.action === 'sit' && res.seatedUid) {
    const host = placedOnFloor.find((p) => p.uid === res.seatedUid);
    const hm = host ? atlas.items[host.itemId] : undefined;
    if (host && hm) return host.y + hm.h + 2;
  }
  if (res.action === 'sleep' && res.sleepBedUid) {
    const bed = placedOnFloor.find((p) => p.uid === res.sleepBedUid);
    const bm = bed ? atlas.items[bed.itemId] : undefined;
    if (bed && bm) return bed.y + bm.h + 2;
  }
  return res.y;
}
