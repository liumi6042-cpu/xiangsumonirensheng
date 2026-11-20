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

export interface RenderOptions {
  floor: FloorData;
  placedOnFloor: PlacedItem[];
  clock: GameClock;
  cameraX: number;
  buildMode: boolean;
  selectedUid: string | null;
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
    private atlas: AtlasJson
  ) {
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = 960;
    this.bufferCanvas.height = VIRTUAL_HEIGHT;
    this.bufferCtx = this.bufferCanvas.getContext('2d')!;
    this.bufferCtx.imageSmoothingEnabled = false;

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
    ctx.imageSmoothingEnabled = false;

    const camX = Math.round(opts.cameraX);
    const floorW = opts.floor.gridCount * GRID_SIZE;
    const sky = opts.clock.getSkyPalette();

    // 1. Cutaway dark backdrop
    ctx.fillStyle = '#1b110c';
    ctx.fillRect(0, 0, this.viewW, VIRTUAL_HEIGHT);

    ctx.save();
    ctx.translate(-camX, 0);

    // 2. Outer brick end walls
    this.drawOuterBrickSide(ctx, -48, 48);
    this.drawOuterBrickSide(ctx, floorW, 48);

    // 3. Cached HD wall & floor columns
    for (let col = 0; col < opts.floor.gridCount; col++) {
      const x = col * GRID_SIZE;
      if (x + GRID_SIZE < camX || x > camX + this.viewW) continue;

      const wallId = opts.floor.wallSegments[col] ?? 'warm_stripe';
      const wStyle = this.wallMap.get(wallId) ?? WALL_STYLES[0];
      const wTile = this.getWallTile(wStyle);
      ctx.drawImage(wTile, x, CEILING_BOTTOM_Y);

      const floorId = opts.floor.floorSegments[col] ?? 'warm_oak';
      const fStyle = this.floorMap.get(floorId) ?? FLOOR_STYLES[0];
      const fTile = this.getFloorTile(fStyle);
      const srcOffset = (col % 2) * GRID_SIZE;
      ctx.drawImage(
        fTile,
        srcOffset,
        0,
        GRID_SIZE,
        SLAB_TOP_Y - WALL_FLOOR_Y,
        x,
        WALL_FLOOR_Y,
        GRID_SIZE,
        SLAB_TOP_Y - WALL_FLOOR_Y
      );
    }

    // 4. Timber posts, diagonal knee-braces, ceiling beam & subfloor slab
    this.drawArchitectureFraming(ctx, opts.floor.gridCount, floorW, opts.floor.level);

    // 5. Build-mode grid guides & paint highlight
    if (opts.buildMode) {
      this.drawBuildGuides(ctx, opts.floor, floorW, opts.paintMode);
    }

    // 6. Live exterior sky clipped into open windows
    for (const item of opts.placedOnFloor) {
      if (item.itemId === 'sunset_window' && item.isActive) {
        const meta = this.atlas.items[item.itemId];
        const g = meta?.glassRect ?? { x: 14, y: 12, w: 76, h: 66 };
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

    // 7. Painter's Algorithm Y-Sorted Layer Rendering
    this.drawItemsYSorted(ctx, opts.placedOnFloor, opts.floor.level);

    // 8. Surface highlight guides & placement ghost
    if (opts.buildMode && opts.placementPreview) {
      const meta = this.atlas.items[opts.placementPreview.itemId];
      if (meta?.layer === 'prop') {
        this.drawAvailablePropSurfaces(ctx, opts.placedOnFloor, opts.placementPreview.candidate);
      } else if (meta?.layer === 'floor') {
        this.drawFloorDepthBounds(ctx, floorW, opts.placedOnFloor);
      }
      this.drawPlacementGhost(ctx, opts.placementPreview);
    }

    // 9. Selection outline
    if (opts.buildMode && opts.selectedUid) {
      const sel = opts.placedOnFloor.find((i) => i.uid === opts.selectedUid);
      if (sel) {
        const meta = this.atlas.items[sel.itemId];
        if (meta) {
          ctx.strokeStyle = '#ffd54f';
          ctx.lineWidth = 2;
          ctx.strokeRect(sel.x - 1, sel.y - 1, meta.w + 2, meta.h + 2);
        }
      }
    }

    // 10. Ambient night/dusk darkness & cozy warm light pools
    this.drawLighting(ctx, camX, opts.placedOnFloor, sky);

    ctx.restore();

    // Present crisp virtual pixel buffer onto full viewport canvas
    const tCtx = this.targetCanvas.getContext('2d')!;
    tCtx.imageSmoothingEnabled = false;
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

  private drawItemsYSorted(
    ctx: CanvasRenderingContext2D,
    placedOnFloor: PlacedItem[],
    floorLevel: 1 | 2
  ): void {
    const propsByParent = new Map<string, PlacedItem[]>();
    const wallItems: PlacedItem[] = [];
    const rugItems: PlacedItem[] = [];
    const floorDepthQueue: Array<{ item: PlacedItem; sortFootY: number }> = [];

    for (const item of placedOnFloor) {
      const meta = this.atlas.items[item.itemId];
      if (!meta) continue;
      if (meta.layer === 'prop' && item.parentId) {
        const parent = placedOnFloor.find((p) => p.uid === item.parentId);
        const parentLayer = parent ? this.atlas.items[parent.itemId]?.layer : undefined;
        // Props resting on rugs sort directly into the floor depth queue so foreground tables/chairs occlude naturally
        if (parentLayer === 'rug') {
          floorDepthQueue.push({ item, sortFootY: item.y + meta.h });
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
        floorDepthQueue.push({ item, sortFootY: item.y + meta.h });
      }
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

    // Pass 1: Wall items (dividers draw last on wall so they frame clean rooms)
    wallItems.sort((a, b) => {
      const da = a.itemId === 'room_divider_pillar' ? 1 : 0;
      const db = b.itemId === 'room_divider_pillar' ? 1 : 0;
      if (da !== db) return da - db;
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

    // Pass 3: 2.5D Y-sorted floor furniture + rug/tabletop props
    floorDepthQueue.sort((a, b) => a.sortFootY - b.sortFootY || a.item.zOrder - b.item.zOrder);
    for (const entry of floorDepthQueue) {
      const { item } = entry;
      const meta = this.atlas.items[item.itemId];
      if (meta?.layer === 'floor') {
        this.drawFloorContactShadow(ctx, item.x, item.y + meta.h, meta.w);
      }
      this.drawPlacedItem(ctx, item, floorLevel);
      drawHostChildren(item.uid);
    }
  }

  private drawFloorContactShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    footY: number,
    w: number
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 14, 7, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, footY - 2, Math.max(8, w * 0.44), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // Cached HD Pixel-Art Wall & Floor Pattern Tiles
  // ============================================================================

  private getWallTile(style: WallStyleDef): HTMLCanvasElement {
    const cached = this.wallTileCache.get(style.id);
    if (cached) return cached;

    const wallH = WALL_FLOOR_Y - CEILING_BOTTOM_Y; // 250px
    const c = document.createElement('canvas');
    c.width = GRID_SIZE;
    c.height = wallH;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = style.baseColor;
    ctx.fillRect(0, 0, GRID_SIZE, wallH);

    if (style.tileGrid) {
      // Crisp 15x15 glossy bathroom ceramic tiles
      for (let ty = 0; ty < wallH; ty += 15) {
        for (let tx = 0; tx < GRID_SIZE; tx += 15) {
          const alt = ((tx / 15 + ty / 15) % 2) === 0;
          ctx.fillStyle = alt ? style.baseColor : style.stripeColor;
          ctx.fillRect(tx, ty, 15, 15);
          ctx.fillStyle = style.wainscotTrim;
          ctx.fillRect(tx, ty, 15, 1);
          ctx.fillRect(tx, ty, 1, 15);
          ctx.fillStyle = 'rgba(65, 118, 132, 0.22)';
          ctx.fillRect(tx, ty + 14, 15, 1);
          ctx.fillRect(tx + 14, ty, 1, 15);
        }
      }
      // Subtle lower tile dado
      ctx.fillStyle = 'rgba(92, 166, 184, 0.24)';
      ctx.fillRect(0, wallH - 68, GRID_SIZE, 68);
      ctx.fillStyle = style.wainscotTrim;
      ctx.fillRect(0, wallH - 70, GRID_SIZE, 3);
    } else if (style.brickPattern) {
      for (let by = 0; by < wallH; by += 14) {
        const off = ((by / 14) % 2) * 15;
        ctx.fillStyle = '#5c3124';
        ctx.fillRect(0, by + 13, GRID_SIZE, 1);
        for (let bx = -15 + off; bx < GRID_SIZE; bx += 30) {
          ctx.fillStyle = style.stripeColor;
          ctx.fillRect(bx, by, 28, 13);
          ctx.fillStyle = '#cf856b';
          ctx.fillRect(bx + 1, by + 1, 25, 2);
          ctx.fillStyle = '#6f3b2c';
          ctx.fillRect(bx + 27, by, 2, 13);
        }
      }
      this.paintWainscoting(ctx, wallH, style.wainscotColor, style.wainscotTrim, 56);
    } else {
      // Textured vertical wallpaper with 1px light edge & subtle pixel grain
      for (let sx = 0; sx < GRID_SIZE; sx += 15) {
        ctx.fillStyle = style.stripeColor;
        ctx.fillRect(sx, 0, 7, wallH);
        ctx.fillStyle = 'rgba(255, 248, 232, 0.14)';
        ctx.fillRect(sx + 7, 0, 1, wallH);
      }
      // Recessed wood-paneled wainscoting (bottom 68px of wall)
      this.paintWainscoting(ctx, wallH, style.wainscotColor, style.wainscotTrim, 68);
    }

    // Top ceiling shadow + bottom wall-floor AO crease
    ctx.fillStyle = 'rgba(34, 18, 10, 0.24)';
    ctx.fillRect(0, 0, GRID_SIZE, 7);
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, wallH - 4, GRID_SIZE, 4);

    this.wallTileCache.set(style.id, c);
    return c;
  }

  private paintWainscoting(
    ctx: CanvasRenderingContext2D,
    wallH: number,
    base: string,
    trim: string,
    panelH: number
  ): void {
    const top = wallH - panelH;
    // Chair rail molding
    ctx.fillStyle = '#3b2113';
    ctx.fillRect(0, top - 4, GRID_SIZE, 4);
    ctx.fillStyle = trim;
    ctx.fillRect(0, top - 3, GRID_SIZE, 2);

    ctx.fillStyle = base;
    ctx.fillRect(0, top, GRID_SIZE, panelH);

    // 2 recessed decorative wainscot panels per 60px column
    for (let px = 4; px < GRID_SIZE; px += 30) {
      const pw = 22;
      const py = top + 8;
      const ph = panelH - 18;
      ctx.fillStyle = 'rgba(38, 20, 10, 0.42)';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = base;
      ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);
      ctx.fillStyle = 'rgba(255, 224, 178, 0.18)';
      ctx.fillRect(px + 2, py + ph - 2, pw - 2, 2);
      ctx.fillRect(px + pw - 2, py + 2, 2, ph - 2);
    }
  }

  private getFloorTile(style: FloorStyleDef): HTMLCanvasElement {
    const cached = this.floorTileCache.get(style.id);
    if (cached) return cached;

    const floorH = SLAB_TOP_Y - WALL_FLOOR_Y; // 222px deep 2.5D floor!
    const tileW = GRID_SIZE * 2; // 120px wide repeating pattern
    const c = document.createElement('canvas');
    c.width = tileW;
    c.height = floorH;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = style.plankA;
    ctx.fillRect(0, 0, tileW, floorH);

    if (style.tileMode) {
      let y = 0;
      let row = 0;
      while (y < floorH) {
        const rh = Math.round(14 + (y / floorH) * 8);
        const colW = 20;
        for (let tx = 0; tx < tileW; tx += colW) {
          const alt = (row + Math.floor(tx / colW)) % 2 === 0;
          ctx.fillStyle = alt ? style.plankA : style.plankB;
          ctx.fillRect(tx, y, colW, rh);
          // Top specular edge & dark bottom grout
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.fillRect(tx + 1, y + 1, colW - 2, 1);
          ctx.fillStyle = style.groutColor;
          ctx.fillRect(tx, y + rh - 1, colW, 1);
          ctx.fillRect(tx + colW - 1, y, 1, rh);
        }
        y += rh;
        row++;
      }
    } else {
      // Staggered perspective-widening hardwood floorboards with rich wood grain & knots
      let y = 0;
      let row = 0;
      while (y < floorH) {
        const rh = Math.round(14 + (y / floorH) * 9);
        const shift = (row % 3) * 38;
        const plankLen = 60;
        for (let px = -plankLen + shift; px < tileW; px += plankLen) {
          const alt = ((row + Math.floor((px + 120) / plankLen)) % 2) === 0;
          ctx.fillStyle = alt ? style.plankA : style.plankB;
          ctx.fillRect(px, y, plankLen, rh);
          // Bevel highlight along top of plank
          ctx.fillStyle = 'rgba(255, 224, 178, 0.16)';
          ctx.fillRect(px + 1, y + 1, plankLen - 2, 1);
          // Wood grain streaks
          ctx.fillStyle = 'rgba(64, 34, 16, 0.22)';
          ctx.fillRect(px + 10, y + Math.floor(rh * 0.4), 18, 1);
          ctx.fillRect(px + 34, y + Math.floor(rh * 0.7), 14, 1);
          // End seam & bottom seam
          ctx.fillStyle = style.groutColor;
          ctx.fillRect(px, y + rh - 1, plankLen, 1);
          ctx.fillRect(px + plankLen - 1, y, 1, rh);
        }
        y += rh;
        row++;
      }
    }

    // Soft wall-floor ambient occlusion shadow at top 18px of floor
    const ao = ctx.createLinearGradient(0, 0, 0, 20);
    ao.addColorStop(0, 'rgba(28, 15, 8, 0.36)');
    ao.addColorStop(1, 'rgba(28, 15, 8, 0)');
    ctx.fillStyle = ao;
    ctx.fillRect(0, 0, tileW, 20);

    this.floorTileCache.set(style.id, c);
    return c;
  }

  private drawOuterBrickSide(ctx: CanvasRenderingContext2D, startX: number, width: number): void {
    ctx.fillStyle = '#4a2920';
    ctx.fillRect(startX, 0, width, VIRTUAL_HEIGHT);
    for (let y = 14; y < VIRTUAL_HEIGHT - 16; y += 14) {
      const offset = (y / 14) % 2 === 0 ? 0 : 12;
      for (let x = startX + offset; x < startX + width; x += 24) {
        ctx.fillStyle = '#6c3c2d';
        ctx.fillRect(x + 1, y + 1, 21, 11);
        ctx.fillStyle = '#8b513e';
        ctx.fillRect(x + 2, y + 2, 18, 2);
      }
    }
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(startX, 0, 3, VIRTUAL_HEIGHT);
    ctx.fillRect(startX + width - 3, 0, 3, VIRTUAL_HEIGHT);
  }

  private drawArchitectureFraming(
    ctx: CanvasRenderingContext2D,
    gridCount: number,
    floorW: number,
    level: 1 | 2
  ): void {
    // Structural vertical posts + diagonal timber knee-braces every 5 grids (like concept art!)
    for (let col = 5; col < gridCount; col += 5) {
      const x = col * GRID_SIZE;
      // Vertical post across wall
      ctx.fillStyle = '#2b1810';
      ctx.fillRect(x - 6, CEILING_BOTTOM_Y, 12, WALL_FLOOR_Y - CEILING_BOTTOM_Y);
      ctx.fillStyle = '#6f4226';
      ctx.fillRect(x - 4, CEILING_BOTTOM_Y, 8, WALL_FLOOR_Y - CEILING_BOTTOM_Y);
      ctx.fillStyle = '#9b623c';
      ctx.fillRect(x - 3, CEILING_BOTTOM_Y, 2, WALL_FLOOR_Y - CEILING_BOTTOM_Y);

      // Stepped pixel diagonal braces (/ and \) under ceiling
      for (let i = 0; i < 18; i += 2) {
        ctx.fillStyle = '#2b1810';
        ctx.fillRect(x - 24 + i, CEILING_BOTTOM_Y + i, 8, 4);
        ctx.fillRect(x + 16 - i, CEILING_BOTTOM_Y + i, 8, 4);
        ctx.fillStyle = '#804c2c';
        ctx.fillRect(x - 22 + i, CEILING_BOTTOM_Y + i + 1, 5, 2);
        ctx.fillRect(x + 17 - i, CEILING_BOTTOM_Y + i + 1, 5, 2);
      }
    }

    // Top ceiling timber beam (0..46)
    ctx.fillStyle = '#361f12';
    ctx.fillRect(0, 0, floorW, CEILING_BOTTOM_Y);
    ctx.fillStyle = '#734427';
    ctx.fillRect(0, 32, floorW, 11);
    ctx.fillStyle = '#a46942';
    ctx.fillRect(0, 33, floorW, 3);
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, CEILING_BOTTOM_Y - 3, floorW, 3);

    // Bottom cutaway floor edge (518..540)
    ctx.fillStyle = '#734427';
    ctx.fillRect(0, SLAB_TOP_Y, floorW, 9);
    ctx.fillStyle = '#a46942';
    ctx.fillRect(0, SLAB_TOP_Y, floorW, 3);
    ctx.fillStyle = '#24140c';
    ctx.fillRect(0, SLAB_TOP_Y + 9, floorW, VIRTUAL_HEIGHT - (SLAB_TOP_Y + 9));

    ctx.fillStyle = '#9c6844';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${level}F 室内剖面`, 12, SLAB_TOP_Y + 19);
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
        [10, 12],
        [26, 20],
        [48, 10],
        [62, 24],
        [18, 36],
        [42, 32],
      ];
      for (let i = 0; i < stars.length; i++) {
        if (Math.sin(elapsedSec * 2.4 + i * 1.7) > -0.3) {
          ctx.fillRect(wx + (stars[i][0] % Math.max(8, ww - 4)), wy + (stars[i][1] % Math.max(8, wh - 12)), 2, 2);
        }
      }
    }

    const drift = Math.floor(elapsedSec * 4) % (ww + 28);
    ctx.fillStyle = sky.cloudColor;
    const cx1 = wx + ((drift + 12) % (ww + 18)) - 14;
    ctx.fillRect(cx1, wy + Math.round(wh * 0.28), 22, 6);
    ctx.fillRect(cx1 + 5, wy + Math.round(wh * 0.28) - 4, 12, 4);
    const cx2 = wx + ((drift + 46) % (ww + 18)) - 14;
    ctx.fillRect(cx2, wy + Math.round(wh * 0.56), 16, 5);
    ctx.fillRect(cx2 + 4, wy + Math.round(wh * 0.56) - 3, 9, 3);

    // Distant lush greenery silhouette at bottom of window
    ctx.fillStyle = sky.ambientDarkness > 0.3 ? '#223f2e' : '#539454';
    ctx.fillRect(wx, wy + wh - 12, ww, 12);
    ctx.fillRect(wx + 6, wy + wh - 18, 18, 8);
    ctx.fillRect(wx + ww - 26, wy + wh - 19, 20, 9);

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
    // Main 60px architectural / wallpaper-paint column dividers
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= floorW; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, CEILING_BOTTOM_Y);
      ctx.lineTo(x + 0.5, SLAB_TOP_Y);
      ctx.stroke();
    }

    // Subtle 30x18 floor placement guides inside the 2.5D floor plane (multiples of 10x6 snap)
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

    // Crisp wall-floor back boundary guide (back legs cannot cross above y = WALL_FLOOR_Y + 2)
    ctx.strokeStyle = 'rgba(130, 238, 150, 0.34)';
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
    // Show valid floor back-edge & outer perimeter
    ctx.strokeStyle = 'rgba(130, 238, 150, 0.52)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(8, WALL_FLOOR_Y + 2, floorW - 16, FLOOR_MAX_FOOT_Y - (WALL_FLOOR_Y + 2));
    ctx.setLineDash([]);

    // Show existing floor furniture 2D footprint boxes so collision boundaries are intuitive
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

    const glowStrength = 0.1 + sky.ambientDarkness * 0.42;
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
