import type { AtlasItemMeta, AtlasJson, SurfaceLine } from '../data/catalog';
import { GRID_SIZE } from '../data/economy';
import {
  CEILING_BOTTOM_Y,
  FLOOR_MAX_FOOT_Y,
  SLAB_TOP_Y,
  WALL_FLOOR_Y,
  type PlacedItem,
} from './roomState';

export interface PlacementCandidate {
  valid: boolean;
  x: number;
  y: number;
  parentId?: string;
  reason?: string;
  highlightedSurface?: {
    x0: number;
    x1: number;
    y: number;
  };
}

export function getItemSurfaces(_itemId: string, meta: AtlasItemMeta): SurfaceLine[] {
  return meta.surfaces ?? [];
}

export function getFootDepth(meta: AtlasItemMeta): number {
  return meta.footDepth ?? Math.max(18, Math.min(36, Math.round(meta.h * 0.24)));
}

export function getMinFloorFootY(meta: AtlasItemMeta): number {
  return WALL_FLOOR_Y + getFootDepth(meta) + 2;
}

/**
 * 2.5D Placement & Hit-Testing:
 * - `prop`: 2px X precision snapped onto any host `surface` line (with +4px depth inset on tabletop).
 * - `floor`: full 2D (X + Y depth) placement across the deep floor, constrained so ALL back legs/edges
 *   remain strictly on the floor (`footY >= WALL_FLOOR_Y + footDepth + 2`) and never climb onto the wall!
 * - `rug`: full 2D placement across the floor (`y >= WALL_FLOOR_Y + 2`).
 * - `wall`: snaps on the wall band (`CEILING_BOTTOM_Y .. WALL_FLOOR_Y`).
 */
export function evaluatePlacement(
  itemId: string,
  worldX: number,
  worldY: number,
  floorWidthPx: number,
  placedOnFloor: PlacedItem[],
  atlas: AtlasJson,
  ignoreUid?: string
): PlacementCandidate {
  const meta = atlas.items[itemId];
  if (!meta) {
    return { valid: false, x: worldX, y: worldY, reason: '未知家具' };
  }

  const margin = 8;

  if (meta.layer === 'prop') {
    let bestCandidate: PlacementCandidate | null = null;
    let bestDist = Infinity;

    for (const host of placedOnFloor) {
      if (host.uid === ignoreUid) continue;
      const hostMeta = atlas.items[host.itemId];
      if (!hostMeta) continue;
      const surfaces = getItemSurfaces(host.itemId, hostMeta);
      if (surfaces.length === 0) continue;

      for (const s of surfaces) {
        const sx0 = host.x + (host.flipped ? hostMeta.w - s.x1 : s.x0);
        const sx1 = host.x + (host.flipped ? hostMeta.w - s.x0 : s.x1);
        const sy = host.y + s.y;

        if (sx1 - sx0 < meta.w - 6) continue;
        const minX = sx0;
        const maxX = Math.max(sx0, sx1 - meta.w);

        const rawLeft = worldX - meta.w / 2;
        const snappedX = Math.round(clamp(rawLeft, minX, maxX) / 2) * 2; // 2px precision!
        const targetY = sy - meta.h + 4;

        const dx = worldX < sx0 ? sx0 - worldX : worldX > sx1 ? worldX - sx1 : 0;
        const dy = Math.abs(worldY - sy);
        const dist = dx * 1.3 + dy;

        if (dx <= 28 && dy <= 58 && dist < bestDist) {
          bestDist = dist;
          bestCandidate = {
            valid: true,
            x: snappedX,
            y: targetY,
            parentId: host.uid,
            highlightedSurface: { x0: sx0, x1: sx1, y: sy },
          };
        }
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }
    return {
      valid: false,
      x: Math.round((worldX - meta.w / 2) / 2) * 2,
      y: Math.round((worldY - meta.h / 2) / 2) * 2,
      reason: '需摆放在桌面、壁架、沙发、床面或地毯承托面上',
    };
  }

  if (meta.layer === 'rug') {
    const snappedX = snap(worldX - meta.w / 2, 10);
    const x = clamp(snappedX, margin, floorWidthPx - meta.w - margin);
    const rawFootY = snap(worldY + meta.h / 2, 6);
    const minRugFootY = WALL_FLOOR_Y + meta.h + 2;
    const footY = clamp(rawFootY, minRugFootY, SLAB_TOP_Y - 4);
    const y = footY - meta.h;

    const overlapsRug = placedOnFloor.some((other) => {
      if (other.uid === ignoreUid) return false;
      const om = atlas.items[other.itemId];
      if (!om || om.layer !== 'rug') return false;
      return (
        x < other.x + om.w - 6 &&
        x + meta.w > other.x + 6 &&
        y < other.y + om.h - 6 &&
        y + meta.h > other.y + 6
      );
    });
    return {
      valid: !overlapsRug,
      x,
      y,
      reason: overlapsRug ? '不能与其他地毯重叠' : undefined,
    };
  }

  if (meta.layer === 'floor') {
    const snappedX = snap(worldX - meta.w / 2, 10);
    const x = clamp(snappedX, margin, floorWidthPx - meta.w - margin);

    const myDepth = getFootDepth(meta);
    const minFootY = WALL_FLOOR_Y + myDepth + 2;

    // Cursor sits near the item's ground feet or center
    let footY = snap(worldY + Math.min(20, meta.h * 0.22), 6);
    if (Math.abs(footY - minFootY) <= 12) {
      footY = minFootY; // Magnetic snap flush so back legs sit right on the wall-floor seam!
    }
    footY = clamp(footY, minFootY, FLOOR_MAX_FOOT_Y);
    const y = footY - meta.h;

    const myTopFoot = footY - myDepth;

    const overlapsFloor = placedOnFloor.some((other) => {
      if (other.uid === ignoreUid) return false;
      const om = atlas.items[other.itemId];
      if (!om || om.layer !== 'floor') return false;
      const otherFootY = other.y + om.h;
      const otherTopFoot = otherFootY - getFootDepth(om);
      return (
        x < other.x + om.w - 8 &&
        x + meta.w > other.x + 8 &&
        myTopFoot < otherFootY - 4 &&
        footY > otherTopFoot + 4
      );
    });

    return {
      valid: !overlapsFloor,
      x,
      y,
      reason: overlapsFloor ? '地面脚底区域与已有家具重叠' : undefined,
    };
  }

  // Wall layer
  const snappedX = snap(worldX - meta.w / 2, 10);
  const x = clamp(snappedX, margin, floorWidthPx - meta.w - margin);
  let y: number;

  if (meta.anchor === 'ceiling') {
    y = CEILING_BOTTOM_Y;
  } else if (meta.anchor === 'floor') {
    y =
      itemId === 'room_divider_pillar' || itemId === 'room_arch_divider'
        ? CEILING_BOTTOM_Y
        : WALL_FLOOR_Y - meta.h;
  } else {
    const rawY = snap(worldY - meta.h / 2, 10);
    y = clamp(rawY, CEILING_BOTTOM_Y + 12, WALL_FLOOR_Y - meta.h - 10);
  }

  const overlapsWall = placedOnFloor.some((other) => {
    if (other.uid === ignoreUid) return false;
    const om = atlas.items[other.itemId];
    if (!om || om.layer !== 'wall') return false;
    return (
      x < other.x + om.w - 4 &&
      x + meta.w > other.x + 4 &&
      y < other.y + om.h - 4 &&
      y + meta.h > other.y + 4
    );
  });

  return {
    valid: !overlapsWall,
    x,
    y,
    reason: overlapsWall ? '墙面该位置已有其他装饰或灯具' : undefined,
  };
}

/**
 * Hit-test topmost placed item in reverse render order (props/frontmost floor -> rugs -> wall).
 */
export function hitTestPlacedItem(
  worldX: number,
  worldY: number,
  placedOnFloor: PlacedItem[],
  atlas: AtlasJson
): PlacedItem | null {
  const layerPriority: Record<string, number> = {
    prop: 4,
    floor: 3,
    rug: 2,
    wall: 1,
  };

  const sorted = [...placedOnFloor].sort((a, b) => {
    const ma = atlas.items[a.itemId];
    const mb = atlas.items[b.itemId];
    const pa = layerPriority[ma?.layer ?? 'wall'] ?? 0;
    const pb = layerPriority[mb?.layer ?? 'wall'] ?? 0;
    if (pa !== pb) return pb - pa;
    const fa = a.y + (ma?.h ?? 0);
    const fb = b.y + (mb?.h ?? 0);
    if (fa !== fb) return fb - fa;
    return b.zOrder - a.zOrder;
  });

  for (const item of sorted) {
    const meta = atlas.items[item.itemId];
    if (!meta) continue;
    if (
      worldX >= item.x &&
      worldX <= item.x + meta.w &&
      worldY >= item.y &&
      worldY <= item.y + meta.h
    ) {
      return item;
    }
  }
  return null;
}

export function getGridColumnFromWorldX(worldX: number, gridCount: number): number {
  return clamp(Math.floor(worldX / GRID_SIZE), 0, gridCount - 1);
}

function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
