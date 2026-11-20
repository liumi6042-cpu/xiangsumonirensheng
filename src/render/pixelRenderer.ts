import {
  computeResidentSortY,
  getAvailableSeatsOnFloor,
  getBedSleepTargetsOnFloor,
  getResidentSpriteRect,
  resolveResidentSprite,
  type ResidentId,
  type ResidentState,
} from '../core/characters';
import type { GameClock, SkyPalette } from '../core/clock';
import { getFootDepth, getItemSurfaces, type PlacementCandidate } from '../core/placement';
import {
  CEILING_BOTTOM_Y,
  FLOOR_MAX_FOOT_Y,
  SLAB_TOP_Y,
  WALL_FLOOR_Y,
  type FloorData,
  type PlacedItem,
} from '../core/roomState';
import {
  FLOOR_STYLES,
  WALL_STYLES,
  type AtlasJson,
  type FloorStyleDef,
  type WallStyleDef,
} from '../data/catalog';
import { GRID_SIZE, VIRTUAL_HEIGHT } from '../data/economy';

export interface DraggingResidentRender {
  resident: ResidentState;
  worldX: number;
  worldY: number;
  snapSeat?: { x: number; y: number } | null;
  snapBed?: { x: number; y: number } | null;
}

export interface RenderOptions {
  floor: FloorData;
  placedOnFloor: PlacedItem[];
  residentsOnFloor: ResidentState[];
  clock: GameClock;
  cameraX: number;
  buildMode: boolean;
  selectedUid: string | null;
  selectedResidentId: ResidentId | null;
  draggingResident: DraggingResidentRender | null;
  paintMode: { type: 'wall' | 'floor'; styleId: string; hoverGridCol: number | null } | null;
  placementPreview: {
    itemId: string;
    variant: number;
    flipped: boolean;
    candidate: PlacementCandidate;
  } | null;
  elapsedSec: number;
}

export class PixelRenderer {
  private bufferCanvas: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private viewW = 960;

  private wallMap = new Map<string, WallStyleDef>(WALL_STYLES.map((w) => [w.id, w]));
  private floorMap = new Map<string, FloorStyleDef>(FLOOR_STYLES.map((f) => [f.id, f]));

  private wallTileCache = new Map<string, HTMLCanvasElement>();
  private floorTileCache = new Map<string, HTMLCanvasElement>();

  constructor(
    private targetCanvas: HTMLCanvasElement,
    private atlasImg: HTMLImageElement,
    private atlas: AtlasJson,
    private surfaceImages: Map<string, HTMLImageElement> = new Map()
  ) {
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = 960;
    this.bufferCanvas.height = VIRTUAL_HEIGHT;
    this.bufferCtx = this.bufferCanvas.getContext('2d')!;
    this.bufferCtx.imageSmoothingEnabled = true;
    this.bufferCtx.imageSmoothingQuality = 'high';

    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = 960;
    this.lightCanvas.height = VIRTUAL_HEIGHT;
    this.lightCtx = this.lightCanvas.getContext('2d')!;
  }

  public getViewDimensions(): { viewW: number; viewH: number } {
    return { viewW: this.viewW, viewH: VIRTUAL_HEIGHT };
  }

  public resizeToDisplay(): void {
    const rect = this.targetCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pxW = Math.max(320, Math.round(rect.width * dpr));
    const pxH = Math.max(240, Math.round(rect.height * dpr));
    if (this.targetCanvas.width !== pxW || this.targetCanvas.height !== pxH) {
      this.targetCanvas.width = pxW;
      this.targetCanvas.height = pxH;
    }

    const aspect = rect.width / Math.max(1, rect.height);
    const nextViewW = Math.max(680, Math.min(1800, Math.round(VIRTUAL_HEIGHT * aspect)));
    if (this.viewW !== nextViewW) {
      this.viewW = nextViewW;
      this.bufferCanvas.width = nextViewW;
      this.lightCanvas.width = nextViewW;
    }
  }

  public screenToWorld(clientX: number, clientY: number, cameraX: number): { x: number; y: number } {
    const rect = this.targetCanvas.getBoundingClientRect();
    const u = (clientX - rect.left) / Math.max(1, rect.width);
    const v = (clientY - rect.top) / Math.max(1, rect.height);
    return {
      x: u * this.viewW + cameraX,
      y: v * VIRTUAL_HEIGHT,
    };
  }

  public render(opts: RenderOptions): void {
    this.resizeToDisplay();
    const ctx = this.bufferCtx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const camX = Math.round(opts.cameraX);
    const floorW = opts.floor.gridCount * GRID_SIZE;
    const sky = opts.clock.getSkyPalette();

    // 1. Cutaway dark backdrop
    ctx.fillStyle = '#1f1510';
    ctx.fillRect(0, 0, this.viewW, VIRTUAL_HEIGHT);

    ctx.save();
    ctx.translate(-camX, 0);

    // 2. Outer cartoon brick end walls
    this.drawOuterBrickSide(ctx, -48, 48);
    this.drawOuterBrickSide(ctx, floorW, 48);

    // 3. Cached seamless cartoon wall & floor columns (120px = 2 * GRID_SIZE period)
    const wallH = WALL_FLOOR_Y - CEILING_BOTTOM_Y;
    const floorH = SLAB_TOP_Y - WALL_FLOOR_Y;
    for (let col = 0; col < opts.floor.gridCount; col++) {
      const x = col * GRID_SIZE;
      if (x + GRID_SIZE < camX || x > camX + this.viewW) continue;

      const srcOffset = (col % 2) * GRID_SIZE;
      const wallId = opts.floor.wallSegments[col] ?? 'warm_stripe';
      const wStyle = this.wallMap.get(wallId) ?? WALL_STYLES[0];
      const wTile = this.getWallTile(wStyle);
      ctx.drawImage(wTile, srcOffset, 0, GRID_SIZE, wallH, x, CEILING_BOTTOM_Y, GRID_SIZE, wallH);

      const floorId = opts.floor.floorSegments[col] ?? 'warm_oak';
      const fStyle = this.floorMap.get(floorId) ?? FLOOR_STYLES[0];
      const fTile = this.getFloorTile(fStyle);
      ctx.drawImage(fTile, srcOffset, 0, GRID_SIZE, floorH, x, WALL_FLOOR_Y, GRID_SIZE, floorH);
    }

    // 4. Clean #2b1810-outlined cartoon timber beams & bottom cutaway floor slab
    this.drawArchitectureFraming(ctx, opts.floor.gridCount, floorW, opts.floor.level);

    // 5. Build-mode grid guides & paint highlight
    if (opts.buildMode) {
      this.drawBuildGuides(ctx, opts.floor, floorW, opts.paintMode);
    }

    // 6. Live exterior sky clipped behind open cartoon window panes
    for (const item of opts.placedOnFloor) {
      if (item.itemId === 'sunset_window' && item.isActive) {
        const meta = this.atlas.items[item.itemId];
        const g = meta?.glassRect ?? { x: 34, y: 14, w: 76, h: 110 };
        this.drawWindowSky(
          ctx,
          item.x + g.x,
          item.y + g.y,
          g.w,
          g.h,
          sky,
          opts.elapsedSec
        );
      }
    }

    // 7. Painter's Algorithm Y-Sorted Layer Rendering (furniture + props + Phase 2 live characters!)
    this.drawItemsAndResidentsYSorted(
      ctx,
      opts.placedOnFloor,
      opts.residentsOnFloor,
      opts.floor.level,
      opts.selectedResidentId,
      opts.draggingResident?.resident.id ?? null,
      opts.elapsedSec
    );

    // 8. Surface highlight guides & placement ghost in Build Mode
    if (opts.buildMode && opts.placementPreview) {
      const meta = this.atlas.items[opts.placementPreview.itemId];
      if (meta?.layer === 'prop') {
        this.drawAvailablePropSurfaces(ctx, opts.placedOnFloor, opts.placementPreview.candidate);
      } else if (meta?.layer === 'floor') {
        this.drawFloorDepthBounds(ctx, floorW, opts.placedOnFloor);
      }
      this.drawPlacementGhost(ctx, opts.placementPreview);
    }

    // 9. Play-mode drag-and-drop seat/bed target rings + lifted dragged character
    if (opts.draggingResident) {
      this.drawResidentDragOverlay(ctx, opts.placedOnFloor, opts.residentsOnFloor, opts.draggingResident);
    }

    // 10. Build-mode item selection outline
    if (opts.buildMode && opts.selectedUid) {
      const sel = opts.placedOnFloor.find((i) => i.uid === opts.selectedUid);
      if (sel) {
        const meta = this.atlas.items[sel.itemId];
        if (meta) {
          ctx.strokeStyle = '#ffd54f';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(sel.x - 1, sel.y - 1, meta.w + 2, meta.h + 2);
        }
      }
    }

    // 11. Ambient night/dusk darkness & cozy warm light pools
    this.drawLighting(ctx, camX, opts.placedOnFloor, sky);

    ctx.restore();

    // Present smooth cartoon buffer onto full viewport canvas
    const tCtx = this.targetCanvas.getContext('2d')!;
    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';
    tCtx.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
    tCtx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.viewW,
      VIRTUAL_HEIGHT,
      0,
      0,
      this.targetCanvas.width,
      this.targetCanvas.height
    );
  }

  private drawItemsAndResidentsYSorted(
    ctx: CanvasRenderingContext2D,
    placedOnFloor: PlacedItem[],
    residentsOnFloor: ResidentState[],
    floorLevel: 1 | 2,
    selectedResidentId: ResidentId | null,
    draggedId: ResidentId | null,
    elapsedSec: number
  ): void {
    const propsByParent = new Map<string, PlacedItem[]>();
    const wallItems: PlacedItem[] = [];
    const rugItems: PlacedItem[] = [];
    const depthQueue: Array<
      | { kind: 'item'; item: PlacedItem; sortFootY: number }
      | { kind: 'resident'; res: ResidentState; sortFootY: number }
    > = [];

    for (const item of placedOnFloor) {
      const meta = this.atlas.items[item.itemId];
      if (!meta) continue;
      if (meta.layer === 'prop' && item.parentId) {
        const parent = placedOnFloor.find((p) => p.uid === item.parentId);
        const parentLayer = parent ? this.atlas.items[parent.itemId]?.layer : undefined;
        if (parentLayer === 'rug') {
          depthQueue.push({ kind: 'item', item, sortFootY: item.y + meta.h });
        } else {
          const list = propsByParent.get(item.parentId) ?? [];
          list.push(item);
          propsByParent.set(item.parentId, list);
        }
      } else if (meta.layer === 'wall') {
        wallItems.push(item);
      } else if (meta.layer === 'rug') {
        rugItems.push(item);
      } else {
        depthQueue.push({ kind: 'item', item, sortFootY: item.y + meta.h });
      }
    }

    for (const res of residentsOnFloor) {
      if (!res.present || res.id === draggedId) continue;
      const sortFootY = computeResidentSortY(res, placedOnFloor, this.atlas);
      depthQueue.push({ kind: 'resident', res, sortFootY });
    }

    const drawHostChildren = (hostUid: string): void => {
      const children = propsByParent.get(hostUid);
      if (!children) return;
      children.sort((a, b) => {
        const ha = this.atlas.items[a.itemId]?.h ?? 0;
        const hb = this.atlas.items[b.itemId]?.h ?? 0;
        return a.y + ha - (b.y + hb) || a.zOrder - b.zOrder;
      });
      for (const child of children) {
        this.drawPlacedItem(ctx, child, floorLevel);
      }
    };

    // Pass 1: Wall items (ceiling lamps, dividers & arches draw after windows for clean framing)
    wallItems.sort((a, b) => {
      const rank = (id: string) =>
        id === 'room_divider_pillar' || id === 'room_arch_divider'
          ? 2
          : id === 'pendant_ceiling_lamp'
            ? 1
            : 0;
      const ra = rank(a.itemId);
      const rb = rank(b.itemId);
      if (ra !== rb) return ra - rb;
      return a.y - b.y || a.zOrder - b.zOrder;
    });
    for (const w of wallItems) {
      this.drawPlacedItem(ctx, w, floorLevel);
      drawHostChildren(w.uid);
    }

    // Pass 2: Rugs on the floor plane
    rugItems.sort((a, b) => a.y - b.y || a.zOrder - b.zOrder);
    for (const r of rugItems) {
      this.drawPlacedItem(ctx, r, floorLevel);
    }

    // Pass 3: 2.5D Y-sorted floor furniture + rug/tabletop props + live residents & pet!
    depthQueue.sort((a, b) => {
      if (a.sortFootY !== b.sortFootY) return a.sortFootY - b.sortFootY;
      // Residents sit/sleep on top of furniture with equal sortFootY
      if (a.kind !== b.kind) return a.kind === 'item' ? -1 : 1;
      if (a.kind === 'item' && b.kind === 'item') return a.item.zOrder - b.item.zOrder;
      return 0;
    });

    for (const entry of depthQueue) {
      if (entry.kind === 'item') {
        const { item } = entry;
        const meta = this.atlas.items[item.itemId];
        if (meta?.layer === 'floor') {
          this.drawFloorContactShadow(ctx, item.x, item.y + meta.h, meta.w);
        }
        this.drawPlacedItem(ctx, item, floorLevel);
        drawHostChildren(item.uid);
      } else {
        this.drawResident(ctx, entry.res, entry.res.id === selectedResidentId, elapsedSec);
      }
    }
  }

  private drawResident(
    ctx: CanvasRenderingContext2D,
    res: ResidentState,
    isSelected: boolean,
    elapsedSec: number,
    overridePos?: { x: number; y: number }
  ): void {
    const { spriteKey, bobOffsetY, squishScaleY } = resolveResidentSprite(res);
    const rect = this.atlas.characters?.[spriteKey] ?? getResidentSpriteRect(res, this.atlas);
    if (!rect) return;

    const rx = Math.round(overridePos?.x ?? res.x);
    const ry = Math.round((overridePos?.y ?? res.y) + bobOffsetY);
    const drawH = Math.round(rect.h * squishScaleY);
    const drawX = Math.round(rx - rect.w / 2);
    const drawY = Math.round(ry - drawH);

    // Subtle soft ground shadow under standing/walking characters
    if (res.action !== 'sit' && res.action !== 'sleep' && !overridePos) {
      this.drawFloorContactShadow(ctx, drawX + 4, Math.round(res.y), rect.w - 8);
    }

    ctx.save();
    if (res.facing === 'left') {
      ctx.translate(drawX + rect.w, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, drawH);
    } else {
      ctx.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, drawX, drawY, rect.w, drawH);
    }
    ctx.restore();

    // Soft gold ring marker under/above selected resident
    if (isSelected) {
      ctx.save();
      const pulse = 1 + Math.sin(elapsedSec * 5) * 0.06;
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(rx, Math.round(overridePos?.y ?? res.y) - 2, (rect.w * 0.42) * pulse, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Small arrow pointer above head
      const ay = drawY - 12 + Math.sin(elapsedSec * 4) * 2.5;
      ctx.fillStyle = '#ffd54f';
      ctx.strokeStyle = '#2b1810';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ay + 7);
      ctx.lineTo(rx - 6, ay - 2);
      ctx.lineTo(rx + 6, ay - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Floating cozy speech/emote bubble
    if (res.emoteText && res.emoteTimer > 0) {
      ctx.save();
      const alpha = Math.min(1, res.emoteTimer * 1.4);
      ctx.globalAlpha = alpha;
      const bx = rx;
      const by = drawY - (isSelected ? 28 : 16) - Math.sin(elapsedSec * 3.5) * 2;
      ctx.fillStyle = 'rgba(255, 250, 240, 0.96)';
      ctx.strokeStyle = '#2b1810';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx - 14, by - 14, 28, 22, 9);
      ctx.fill();
      ctx.stroke();

      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2b1810';
      ctx.fillText(res.emoteText, bx, by - 2);
      ctx.restore();
    }
  }

  private drawResidentDragOverlay(
    ctx: CanvasRenderingContext2D,
    placedOnFloor: PlacedItem[],
    residentsOnFloor: ResidentState[],
    drag: DraggingResidentRender
  ): void {
    const seats = getAvailableSeatsOnFloor(placedOnFloor, residentsOnFloor, this.atlas, drag.resident.id);
    const beds = getBedSleepTargetsOnFloor(placedOnFloor, residentsOnFloor, this.atlas, drag.resident.id);

    ctx.save();
    for (const s of seats) {
      const active =
        drag.snapSeat &&
        Math.abs(drag.snapSeat.x - s.seatX) < 4 &&
        Math.abs(drag.snapSeat.y - s.seatFootY) < 4;
      ctx.fillStyle = active ? 'rgba(103, 232, 121, 0.42)' : 'rgba(93, 242, 255, 0.24)';
      ctx.strokeStyle = active ? '#67e879' : '#5df2ff';
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(s.seatX, s.seatFootY - 26, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const b of beds) {
      const active =
        drag.snapBed &&
        Math.abs(drag.snapBed.x - b.x) < 4 &&
        Math.abs(drag.snapBed.y - b.footY) < 4;
      ctx.fillStyle = active ? 'rgba(103, 232, 121, 0.4)' : 'rgba(255, 213, 79, 0.25)';
      ctx.strokeStyle = active ? '#67e879' : '#ffd54f';
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(b.x, b.footY - 30, 34, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Shadow on floor under lifted resident
    const rx = Math.round(drag.snapSeat?.x ?? drag.snapBed?.x ?? drag.worldX);
    const ry = Math.round(drag.snapSeat?.y ?? drag.snapBed?.y ?? drag.worldY);
    this.drawFloorContactShadow(ctx, rx - 24, ry, 48);
    this.drawResident(ctx, drag.resident, true, 0, { x: rx, y: ry - 10 });
    ctx.restore();
  }

  private drawFloorContactShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    footY: number,
    w: number
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(34, 18, 10, 0.20)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, footY - 2, Math.max(10, w * 0.44), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // Seamless Cartoon Wall & Floor Pattern Tiles (120px = 2 grids repeating period)
  // ============================================================================

  private getWallTile(style: WallStyleDef): HTMLCanvasElement {
    const cached = this.wallTileCache.get(style.id);
    if (cached) return cached;

    const tileW = GRID_SIZE * 2; // 120px seamless repeat
    const wallH = WALL_FLOOR_Y - CEILING_BOTTOM_Y; // 322px
    const c = document.createElement('canvas');
    c.width = tileW;
    c.height = wallH;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const texImg = this.surfaceImages.get(style.textureUrl);
    if (texImg && texImg.complete && texImg.naturalWidth > 0) {
      // Wall tile is 120x338 (top 16px ceiling trim, bottom 322px patterned wall + baseboard)
      ctx.drawImage(texImg, 0, 16, 120, wallH, 0, 0, tileW, wallH);
    } else {
      ctx.fillStyle = style.baseColor;
      ctx.fillRect(0, 0, tileW, wallH);
      ctx.fillStyle = style.stripeColor;
      for (let x = 0; x < tileW; x += 40) {
        ctx.fillRect(x, 0, 19, wallH);
      }
      ctx.fillStyle = style.wainscotColor;
      ctx.fillRect(0, wallH - 18, tileW, 18);
      ctx.fillStyle = '#2b1810';
      ctx.fillRect(0, wallH - 2, tileW, 2);
    }

    this.wallTileCache.set(style.id, c);
    return c;
  }

  private getFloorTile(style: FloorStyleDef): HTMLCanvasElement {
    const cached = this.floorTileCache.get(style.id);
    if (cached) return cached;

    const tileW = GRID_SIZE * 2; // 120px seamless repeat
    const floorH = SLAB_TOP_Y - WALL_FLOOR_Y; // 186px
    const c = document.createElement('canvas');
    c.width = tileW;
    c.height = floorH;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const texImg = this.surfaceImages.get(style.textureUrl);
    if (texImg && texImg.complete && texImg.naturalWidth > 0) {
      ctx.drawImage(texImg, 0, 0, 120, floorH, 0, 0, tileW, floorH);
    } else {
      ctx.fillStyle = style.plankA;
      ctx.fillRect(0, 0, tileW, floorH);
    }

    this.floorTileCache.set(style.id, c);
    return c;
  }

  private drawOuterBrickSide(ctx: CanvasRenderingContext2D, startX: number, width: number): void {
    ctx.fillStyle = '#5a3326';
    ctx.fillRect(startX, 0, width, VIRTUAL_HEIGHT);
    for (let y = 14; y < VIRTUAL_HEIGHT - 16; y += 16) {
      const offset = ((y / 16) % 2) === 0 ? 0 : 12;
      for (let x = startX + offset; x < startX + width; x += 24) {
        ctx.fillStyle = '#784636';
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, 21, 13, 3);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(startX, 0, 3, VIRTUAL_HEIGHT);
    ctx.fillRect(startX + width - 3, 0, 3, VIRTUAL_HEIGHT);
  }

  private drawArchitectureFraming(
    ctx: CanvasRenderingContext2D,
    _gridCount: number,
    floorW: number,
    _level: 1 | 2
  ): void {
    // Smooth dark-brown outlined cartoon top ceiling timber beam (0..16)
    ctx.fillStyle = '#6e4429';
    ctx.fillRect(0, 0, floorW, CEILING_BOTTOM_Y);
    ctx.fillStyle = '#925d3a';
    ctx.fillRect(0, 3, floorW, 4);
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, CEILING_BOTTOM_Y - 2, floorW, 2);

    // Bottom cutaway floor edge (524..540)
    ctx.fillStyle = '#8b5736';
    ctx.fillRect(0, SLAB_TOP_Y, floorW, 7);
    ctx.fillStyle = '#b4784d';
    ctx.fillRect(0, SLAB_TOP_Y, floorW, 3);
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, SLAB_TOP_Y - 2, floorW, 2);
    ctx.fillStyle = '#24150e';
    ctx.fillRect(0, SLAB_TOP_Y + 7, floorW, VIRTUAL_HEIGHT - (SLAB_TOP_Y + 7));
  }

  private drawWindowSky(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    ww: number,
    wh: number,
    sky: SkyPalette,
    elapsedSec: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.clip();

    const grad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    grad.addColorStop(0, sky.skyTop);
    grad.addColorStop(1, sky.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(wx, wy, ww, wh);

    if (sky.starAlpha > 0.05) {
      ctx.fillStyle = `rgba(255, 252, 224, ${sky.starAlpha.toFixed(2)})`;
      const stars = [
        [14, 16],
        [34, 24],
        [56, 14],
        [68, 30],
        [22, 42],
        [50, 38],
      ];
      for (let i = 0; i < stars.length; i++) {
        if (Math.sin(elapsedSec * 2.4 + i * 1.7) > -0.3) {
          ctx.beginPath();
          ctx.arc(wx + (stars[i][0] % Math.max(10, ww - 6)), wy + (stars[i][1] % Math.max(12, wh - 16)), 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Soft rounded vector clouds drifting lazily
    const drift = (elapsedSec * 5) % (ww + 44);
    ctx.fillStyle = sky.cloudColor;
    const drawCloud = (cx: number, cy: number, cw: number) => {
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, 11, 5.5);
      ctx.arc(cx + cw * 0.35, cy, cw * 0.24, 0, Math.PI * 2);
      ctx.arc(cx + cw * 0.65, cy + 1, cw * 0.19, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(wx + ((drift + 10) % (ww + 36)) - 26, wy + Math.round(wh * 0.24), 28);
    drawCloud(wx + ((drift + 52) % (ww + 36)) - 24, wy + Math.round(wh * 0.56), 22);

    // Distant rounded hillside treeline at bottom of window
    ctx.fillStyle = sky.ambientDarkness > 0.3 ? '#2c4c3a' : '#73b36b';
    ctx.beginPath();
    ctx.ellipse(wx + ww * 0.25, wy + wh + 2, ww * 0.4, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(wx + ww * 0.78, wy + wh + 2, ww * 0.45, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private getResolvedVariantIndex(item: PlacedItem, floorLevel: 1 | 2): number {
    const meta = this.atlas.items[item.itemId];
    if (!meta) return 0;
    if (item.itemId === 'stairwell_door_1f') {
      return floorLevel === 2 ? 1 : 0;
    }
    if (item.itemId === 'table_lamp_warm') {
      const colorGroup = Math.floor(item.variant / 2) * 2;
      return Math.min(meta.variants.length - 1, colorGroup + (item.isActive ? 0 : 1));
    }
    if (meta.light || meta.toggleState) {
      return Math.min(meta.variants.length - 1, item.isActive ? 0 : 1);
    }
    return Math.min(meta.variants.length - 1, item.variant);
  }

  private drawPlacedItem(ctx: CanvasRenderingContext2D, item: PlacedItem, floorLevel: 1 | 2): void {
    const meta = this.atlas.items[item.itemId];
    if (!meta) return;
    const vIdx = this.getResolvedVariantIndex(item, floorLevel);
    const v = meta.variants[vIdx] ?? meta.variants[0];
    if (!v) return;

    const dx = Math.round(item.x);
    const dy = Math.round(item.y);

    if (item.flipped) {
      ctx.save();
      ctx.translate(dx + v.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.atlasImg, v.x, v.y, v.w, v.h, 0, 0, v.w, v.h);
      ctx.restore();
    } else {
      ctx.drawImage(this.atlasImg, v.x, v.y, v.w, v.h, dx, dy, v.w, v.h);
    }
  }

  private drawBuildGuides(
    ctx: CanvasRenderingContext2D,
    floor: FloorData,
    floorW: number,
    paintMode: RenderOptions['paintMode']
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= floorW; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, CEILING_BOTTOM_Y);
      ctx.lineTo(x + 0.5, SLAB_TOP_Y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 240, 200, 0.08)';
    for (let x = GRID_SIZE / 2; x < floorW; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, WALL_FLOOR_Y + 2);
      ctx.lineTo(x + 0.5, FLOOR_MAX_FOOT_Y);
      ctx.stroke();
    }
    for (let y = WALL_FLOOR_Y + 2; y <= FLOOR_MAX_FOOT_Y; y += 18) {
      ctx.beginPath();
      ctx.moveTo(8, y + 0.5);
      ctx.lineTo(floorW - 8, y + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(130, 238, 150, 0.36)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(8, WALL_FLOOR_Y + 2.5);
    ctx.lineTo(floorW - 8, WALL_FLOOR_Y + 2.5);
    ctx.stroke();
    ctx.setLineDash([]);

    if (paintMode && paintMode.hoverGridCol !== null && paintMode.hoverGridCol >= 0 && paintMode.hoverGridCol < floor.gridCount) {
      const gx = paintMode.hoverGridCol * GRID_SIZE;
      ctx.fillStyle = 'rgba(255, 216, 102, 0.24)';
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      if (paintMode.type === 'wall') {
        ctx.fillRect(gx, CEILING_BOTTOM_Y, GRID_SIZE, WALL_FLOOR_Y - CEILING_BOTTOM_Y);
        ctx.strokeRect(gx + 1, CEILING_BOTTOM_Y + 1, GRID_SIZE - 2, WALL_FLOOR_Y - CEILING_BOTTOM_Y - 2);
      } else {
        ctx.fillRect(gx, WALL_FLOOR_Y, GRID_SIZE, SLAB_TOP_Y - WALL_FLOOR_Y);
        ctx.strokeRect(gx + 1, WALL_FLOOR_Y + 1, GRID_SIZE - 2, SLAB_TOP_Y - WALL_FLOOR_Y - 2);
      }
    }
    ctx.restore();
  }

  private drawFloorDepthBounds(
    ctx: CanvasRenderingContext2D,
    floorW: number,
    placedOnFloor: PlacedItem[]
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(130, 238, 150, 0.52)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(8, WALL_FLOOR_Y + 2, floorW - 16, FLOOR_MAX_FOOT_Y - (WALL_FLOOR_Y + 2));
    ctx.setLineDash([]);

    for (const item of placedOnFloor) {
      const meta = this.atlas.items[item.itemId];
      if (!meta || meta.layer !== 'floor') continue;
      const depth = getFootDepth(meta);
      const footY = item.y + meta.h;
      ctx.fillStyle = 'rgba(255, 165, 70, 0.14)';
      ctx.strokeStyle = 'rgba(255, 165, 70, 0.55)';
      ctx.lineWidth = 1;
      ctx.fillRect(item.x + 8, footY - depth, meta.w - 16, depth);
      ctx.strokeRect(item.x + 8, footY - depth, meta.w - 16, depth);
    }
    ctx.restore();
  }

  private drawAvailablePropSurfaces(
    ctx: CanvasRenderingContext2D,
    placed: PlacedItem[],
    candidate: PlacementCandidate
  ): void {
    ctx.save();
    for (const host of placed) {
      const hostMeta = this.atlas.items[host.itemId];
      if (!hostMeta) continue;
      const surfaces = getItemSurfaces(host.itemId, hostMeta);
      for (const s of surfaces) {
        const sx0 = host.x + (host.flipped ? hostMeta.w - s.x1 : s.x0);
        const sx1 = host.x + (host.flipped ? hostMeta.w - s.x0 : s.x1);
        const sy = host.y + s.y;
        const isActive =
          candidate.highlightedSurface &&
          candidate.highlightedSurface.x0 === sx0 &&
          candidate.highlightedSurface.y === sy;
        ctx.strokeStyle = isActive ? '#5df2ff' : 'rgba(93, 242, 255, 0.5)';
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(sx0, sy);
        ctx.lineTo(sx1, sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPlacementGhost(
    ctx: CanvasRenderingContext2D,
    preview: NonNullable<RenderOptions['placementPreview']>
  ): void {
    const meta = this.atlas.items[preview.itemId];
    if (!meta) return;
    const v = meta.variants[Math.min(meta.variants.length - 1, preview.variant)] ?? meta.variants[0];
    if (!v) return;

    const { x, y, valid } = preview.candidate;
    ctx.save();
    ctx.globalAlpha = 0.82;
    if (preview.flipped) {
      ctx.translate(Math.round(x) + v.w, Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(this.atlasImg, v.x, v.y, v.w, v.h, 0, 0, v.w, v.h);
    } else {
      ctx.drawImage(this.atlasImg, v.x, v.y, v.w, v.h, Math.round(x), Math.round(y), v.w, v.h);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = valid ? '#67e879' : '#ff5e57';
    ctx.fillStyle = valid ? 'rgba(103, 232, 121, 0.14)' : 'rgba(255, 94, 87, 0.24)';
    ctx.lineWidth = 2;
    ctx.fillRect(Math.round(x), Math.round(y), v.w, v.h);
    ctx.strokeRect(Math.round(x), Math.round(y), v.w, v.h);
    if (meta.layer === 'floor') {
      const depth = getFootDepth(meta);
      const footY = Math.round(y) + v.h;
      ctx.fillStyle = valid ? 'rgba(103, 232, 121, 0.28)' : 'rgba(255, 94, 87, 0.38)';
      ctx.fillRect(Math.round(x) + 8, footY - depth, v.w - 16, depth);
      ctx.strokeRect(Math.round(x) + 8, footY - depth, v.w - 16, depth);
    }
    ctx.restore();
  }

  private drawLighting(
    ctx: CanvasRenderingContext2D,
    camX: number,
    placedOnFloor: PlacedItem[],
    sky: SkyPalette
  ): void {
    const lamps: Array<{ x: number; y: number; r: number }> = [];
    for (const item of placedOnFloor) {
      const meta = this.atlas.items[item.itemId];
      if (meta?.light && item.isActive) {
        const lx = item.x + (item.flipped ? meta.w - meta.light.dx : meta.light.dx);
        const ly = item.y + meta.light.dy;
        lamps.push({ x: lx, y: ly, r: meta.light.radius });
      }
    }

    if (sky.ambientDarkness > 0.03) {
      const lCtx = this.lightCtx;
      lCtx.globalCompositeOperation = 'source-over';
      lCtx.clearRect(0, 0, this.viewW, VIRTUAL_HEIGHT);
      lCtx.fillStyle = `rgba(18, 22, 50, ${sky.ambientDarkness.toFixed(3)})`;
      lCtx.fillRect(0, 0, this.viewW, VIRTUAL_HEIGHT);

      lCtx.globalCompositeOperation = 'destination-out';
      for (const lamp of lamps) {
        const sx = lamp.x - camX;
        const sy = lamp.y;
        const g = lCtx.createRadialGradient(sx, sy, 10, sx, sy, lamp.r);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.96)');
        g.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = g;
        lCtx.beginPath();
        lCtx.arc(sx, sy, lamp.r, 0, Math.PI * 2);
        lCtx.fill();
      }

      ctx.save();
      ctx.drawImage(this.lightCanvas, camX, 0);
      ctx.restore();
    }

    const glowStrength = 0.08 + sky.ambientDarkness * 0.42;
    if (lamps.length > 0 && glowStrength > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const lamp of lamps) {
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, lamp.r * 0.92);
        g.addColorStop(0, `rgba(255, 220, 128, ${glowStrength.toFixed(2)})`);
        g.addColorStop(0.5, `rgba(255, 178, 84, ${(glowStrength * 0.45).toFixed(2)})`);
        g.addColorStop(1, 'rgba(255, 178, 84, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, lamp.r * 0.92, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
