import './style.css';
import {
  RESIDENT_DEF_MAP,
  assignResidentSit,
  assignResidentSleep,
  assignResidentWalk,
  getAvailableSeatsOnFloor,
  getBedSleepTargetsOnFloor,
  hitTestResident,
  triggerResidentWave,
  updateResidents,
  type ResidentAction,
  type ResidentId,
  type ResidentState,
} from './core/characters';
import { GameClock } from './core/clock';
import {
  evaluatePlacement,
  getGridColumnFromWorldX,
  hitTestPlacedItem,
  type PlacementCandidate,
} from './core/placement';
import {
  CEILING_BOTTOM_Y,
  FLOOR_MAX_FOOT_Y,
  WALL_FLOOR_Y,
  canUnlockFloor2,
  clearSaveState,
  getFloorWidthPx,
  getNextExpansionForFloor,
  getTotalAssetValue,
  getTotalUnlockedGrids,
  loadSaveState,
  persistSaveState,
  type GameSaveState,
  type PlacedItem,
} from './core/roomState';
import { CATALOG_MAP, FLOOR_STYLES, WALL_STYLES, type AtlasJson } from './data/catalog';
import { ECONOMY, GRID_SIZE, calculateWeeklyBill, getSellRefund } from './data/economy';
import { PixelRenderer } from './render/pixelRenderer';
import { GameHud } from './ui/hud';

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

async function loadSurfaceTextures(): Promise<Map<string, HTMLImageElement>> {
  const urls = new Set<string>();
  for (const w of WALL_STYLES) urls.add(w.textureUrl);
  for (const f of FLOOR_STYLES) urls.add(f.textureUrl);

  const entries = await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const im = await loadImage(url);
        return [url, im] as const;
      } catch {
        return null;
      }
    })
  );

  const map = new Map<string, HTMLImageElement>();
  for (const e of entries) {
    if (e) map.set(e[0], e[1]);
  }
  return map;
}

async function bootstrap(): Promise<void> {
  const stageWrap = document.getElementById('stage-wrap') as HTMLElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const hudOverlay = document.getElementById('hud-overlay') as HTMLElement;
  const drawerSlot = document.getElementById('drawer-slot') as HTMLElement;
  const modalSlot = document.getElementById('modal-slot') as HTMLElement;
  const toastSlot = document.getElementById('toast-slot') as HTMLElement;

  const [atlasResp, atlasImg, surfaceImages] = await Promise.all([
    fetch('./assets/furniture_atlas.json'),
    loadImage('./assets/furniture_atlas.png'),
    loadSurfaceTextures(),
  ]);
  const atlas = (await atlasResp.json()) as AtlasJson;

  let state: GameSaveState = loadSaveState();
  const clock = new GameClock(state.day, state.minuteOfDay, state.lastSundayBillDay);
  const renderer = new PixelRenderer(canvas, atlasImg, atlas, surfaceImages);
  renderer.resizeToDisplay();

  let buildMode = false;
  let cameraX = 0;
  let selectedUid: string | null = null;
  let selectedResidentId: ResidentId | null = null;

  let placingMode:
    | { kind: 'new'; itemId: string; variant: number; flipped: boolean }
    | {
        kind: 'inventory';
        invUid: string;
        itemId: string;
        variant: number;
        flipped: boolean;
        boughtOnDay: number;
        purchasePrice: number;
      }
    | {
        kind: 'move';
        movingUid: string;
        itemId: string;
        variant: number;
        flipped: boolean;
        origX: number;
        origY: number;
        origParentId?: string;
      }
    | null = null;

  let paintMode: { type: 'wall' | 'floor'; styleId: string; hoverGridCol: number | null } | null = null;
  let pointerWorld = { x: 240, y: 200 };
  let lastCandidate: PlacementCandidate | null = null;

  // Camera pan state & Play Mode character drag state
  let isPanning = false;
  let panMoved = false;
  let panStartClientX = 0;
  let panStartCamX = 0;
  const pressedKeys = new Set<string>();

  let draggingRes: {
    res: ResidentState;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    worldX: number;
    worldY: number;
    snapSeat: ReturnType<typeof getAvailableSeatsOnFloor>[number] | null;
    snapBed: ReturnType<typeof getBedSleepTargetsOnFloor>[number] | null;
  } | null = null;

  const clampCamera = (): void => {
    const { viewW } = renderer.getViewDimensions();
    const floorW = getFloorWidthPx(state, state.activeFloor);
    const maxCam = Math.max(0, floorW - viewW);
    cameraX = Math.max(0, Math.min(maxCam, cameraX));
  };

  const getFloorItems = (): PlacedItem[] =>
    state.placedItems.filter((i) => i.floor === state.activeFloor);

  const getFloorResidents = (): ResidentState[] =>
    state.residents.filter((r) => r.present && r.floor === state.activeFloor);

  const save = (): void => {
    state.day = clock.day;
    state.minuteOfDay = clock.minuteOfDay;
    state.lastSundayBillDay = clock.getLastSundayBillDay();
    persistSaveState(state);
  };

  const shiftChildren = (parentUid: string, dx: number, dy: number): void => {
    for (const child of state.placedItems) {
      if (child.parentId === parentUid) {
        child.x += dx;
        child.y += dy;
      }
    }
  };

  const cancelActiveTool = (): void => {
    if (placingMode?.kind === 'move') {
      const moving = placingMode;
      const target = state.placedItems.find((i) => i.uid === moving.movingUid);
      if (target) {
        const dx = moving.origX - target.x;
        const dy = moving.origY - target.y;
        target.x = moving.origX;
        target.y = moving.origY;
        target.parentId = moving.origParentId;
        shiftChildren(target.uid, dx, dy);
      }
    }
    placingMode = null;
    paintMode = null;
    lastCandidate = null;
    canvas.classList.remove('placing');
  };

  const hud = new GameHud(hudOverlay, drawerSlot, modalSlot, toastSlot, atlasImg, atlas, {
    onSetSpeed: (s) => {
      clock.speed = s;
      syncHud();
    },
    onToggleBuildMode: () => {
      buildMode = !buildMode;
      if (!buildMode) {
        cancelActiveTool();
        selectedUid = null;
      } else {
        selectedResidentId = null;
        draggingRes = null;
      }
      syncHud();
      requestAnimationFrame(() => {
        renderer.resizeToDisplay();
        clampCamera();
        hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
      });
    },
    onSelectFloor: (floor) => {
      if (!state.floors[floor].unlocked) return;
      cancelActiveTool();
      selectedUid = null;
      selectedResidentId = null;
      state.activeFloor = floor;
      cameraX = 0;
      clampCamera();
      save();
      syncHud();
    },
    onScrollBy: (dx) => {
      cameraX += dx;
      clampCamera();
      syncHud();
    },
    onStartPlaceNew: (itemId) => {
      const def = CATALOG_MAP.get(itemId);
      if (!def) return;
      if (state.coins < def.price) {
        hud.pushToast(`金币不足！需要 ${def.price} G，可在「经济测试」领取装修津贴`, 'warn');
        return;
      }
      cancelActiveTool();
      selectedUid = null;
      placingMode = { kind: 'new', itemId, variant: 0, flipped: false };
      canvas.classList.add('placing');
      syncHud();
    },
    onStartPlaceFromInventory: (invUid) => {
      const idx = state.inventory.findIndex((i) => i.uid === invUid);
      if (idx === -1) return;
      const inv = state.inventory[idx];
      cancelActiveTool();
      selectedUid = null;
      placingMode = {
        kind: 'inventory',
        invUid: inv.uid,
        itemId: inv.itemId,
        variant: inv.variant,
        flipped: inv.flipped,
        boughtOnDay: inv.boughtOnDay,
        purchasePrice: inv.purchasePrice,
      };
      canvas.classList.add('placing');
      syncHud();
    },
    onStartPaint: (type, styleId) => {
      cancelActiveTool();
      selectedUid = null;
      paintMode = { type, styleId, hoverGridCol: null };
      canvas.classList.add('placing');
      syncHud();
    },
    onCancelTool: () => {
      cancelActiveTool();
      syncHud();
    },
    onMoveSelected: () => {
      if (!selectedUid) return;
      const item = state.placedItems.find((i) => i.uid === selectedUid);
      if (!item) return;
      cancelActiveTool();
      placingMode = {
        kind: 'move',
        movingUid: item.uid,
        itemId: item.itemId,
        variant: item.variant,
        flipped: item.flipped,
        origX: item.x,
        origY: item.y,
        origParentId: item.parentId,
      };
      canvas.classList.add('placing');
      syncHud();
    },
    onCycleVariantSelected: () => {
      if (!selectedUid) return;
      const item = state.placedItems.find((i) => i.uid === selectedUid);
      const meta = item ? atlas.items[item.itemId] : undefined;
      if (!item || !meta) return;
      if (item.itemId === 'table_lamp_warm') {
        const group = Math.floor(item.variant / 2);
        const nextGroup = (group + 1) % Math.max(1, Math.floor(meta.variants.length / 2));
        item.variant = nextGroup * 2;
      } else {
        item.variant = (item.variant + 1) % meta.variants.length;
      }
      save();
      syncHud();
    },
    onFlipSelected: () => {
      if (!selectedUid) return;
      const item = state.placedItems.find((i) => i.uid === selectedUid);
      if (!item) return;
      item.flipped = !item.flipped;
      save();
      syncHud();
    },
    onPackSelected: () => {
      if (!selectedUid) return;
      const item = state.placedItems.find((i) => i.uid === selectedUid);
      if (!item) return;
      const children = state.placedItems.filter((c) => c.parentId === item.uid);
      const toPack = [item, ...children];
      const packIds = new Set(toPack.map((p) => p.uid));
      state.placedItems = state.placedItems.filter((p) => !packIds.has(p.uid));
      for (const p of toPack) {
        state.inventory.push({
          uid: p.uid,
          itemId: p.itemId,
          variant: p.variant,
          flipped: p.flipped,
          isActive: p.isActive,
          boughtOnDay: p.boughtOnDay,
          purchasePrice: p.purchasePrice,
        });
      }
      selectedUid = null;
      save();
      hud.pushToast(
        children.length > 0 ? `已连同台上 ${children.length} 件小摆件一起收进仓库` : '已收进仓库备用',
        'good'
      );
      syncHud();
    },
    onSellSelected: () => {
      if (!selectedUid) return;
      const item = state.placedItems.find((i) => i.uid === selectedUid);
      if (!item) return;
      const children = state.placedItems.filter((c) => c.parentId === item.uid);
      const toSell = [item, ...children];
      let totalRefund = 0;
      for (const p of toSell) {
        totalRefund += getSellRefund(p.purchasePrice, p.boughtOnDay, clock.day).refund;
      }
      const sellIds = new Set(toSell.map((p) => p.uid));
      state.placedItems = state.placedItems.filter((p) => !sellIds.has(p.uid));
      state.coins += totalRefund;
      selectedUid = null;
      save();
      hud.pushToast(`已出售并回款 +${totalRefund} G`, 'good');
      syncHud();
    },
    onExpandFloor: (floor) => {
      const step = getNextExpansionForFloor(state, floor);
      if (!step) return;
      if (state.coins < step.cost) {
        hud.pushToast(`扩建需要 ${step.cost} G！`, 'warn');
        return;
      }
      state.coins -= step.cost;
      const f = state.floors[floor];
      const added = step.targetGrids - f.gridCount;
      const lastWall = f.wallSegments[f.wallSegments.length - 1] ?? 'warm_stripe';
      const lastFloor = f.floorSegments[f.floorSegments.length - 1] ?? 'warm_oak';
      f.gridCount = step.targetGrids;
      for (let i = 0; i < added; i++) {
        f.wallSegments.push(lastWall);
        f.floorSegments.push(lastFloor);
      }
      state.activeFloor = floor;
      cameraX = Math.max(0, getFloorWidthPx(state, floor) - renderer.getViewDimensions().viewW);
      save();
      hud.pushToast(`扩建成功！${floor}F 空间已扩展到 ${f.gridCount} 格`, 'good');
      syncHud();
    },
    onUnlockFloor2: () => {
      const check = canUnlockFloor2(state);
      if (!check.ok) {
        hud.pushToast(check.reason ?? '金币不足', 'warn');
        return;
      }
      state.coins -= check.cost;
      state.floors[2].unlocked = true;
      state.activeFloor = 2;
      state.placedItems.push(
        {
          uid: `item_${state.nextUid++}`,
          itemId: 'stairwell_door_1f',
          floor: 2,
          x: 618,
          y: WALL_FLOOR_Y - (atlas.items['stairwell_door_1f']?.h ?? 226),
          variant: 1,
          flipped: false,
          isActive: true,
          boughtOnDay: clock.day,
          purchasePrice: 320,
          zOrder: state.nextUid,
        },
        {
          uid: `item_${state.nextUid++}`,
          itemId: 'pendant_ceiling_lamp',
          floor: 2,
          x: 240,
          y: CEILING_BOTTOM_Y,
          variant: 0,
          flipped: false,
          isActive: true,
          boughtOnDay: clock.day,
          purchasePrice: 95,
          zOrder: state.nextUid,
        }
      );
      cameraX = 0;
      hud.setExpansionModalOpen(false);
      save();
      hud.pushToast('二楼加盖完成！已自动连通木楼梯，快去布置新房间吧', 'good');
      syncHud();
    },
    onGrantTestCoins: () => {
      state.coins += ECONOMY.testStipendAmount;
      save();
      hud.pushToast(`已发放装修测试津贴 +${ECONOMY.testStipendAmount} G`, 'good');
      syncHud();
    },
    onJumpTime: (hour) => {
      const dayChanged = clock.skipToNextEveningOrMorning(hour);
      save();
      hud.pushToast(
        dayChanged
          ? `进入第 ${clock.day} 天 ${clock.formattedTime}（昨日购买家具已折旧为 65%）`
          : `时间切换至 ${clock.formattedTime}`,
        'normal'
      );
      syncHud();
    },
    onResetSave: () => {
      state = clearSaveState();
      clock.day = state.day;
      clock.minuteOfDay = state.minuteOfDay;
      selectedUid = null;
      selectedResidentId = null;
      cancelActiveTool();
      cameraX = 0;
      hud.pushToast('已恢复初始温馨小屋、原创角色与 1,200 G 启动资金', 'good');
      syncHud();
    },
    onShowIslandPreview: () => {
      hud.pushToast(
        '🗺️ 小镇室外咖啡街景、公园等 8 大地点地图将在 Phase 3-4 逐步连通！',
        'normal'
      );
    },
    // Phase 2 resident controls
    onSetResidentOutfit: (id, outfit) => {
      const res = state.residents.find((r) => r.id === id);
      if (!res) return;
      res.outfit = outfit;
      triggerResidentWave(res, '✨');
      save();
      syncHud();
    },
    onTriggerResidentAction: (id, action: ResidentAction) => {
      const res = state.residents.find((r) => r.id === id);
      if (!res || !res.present) return;
      const floorW = getFloorWidthPx(state, res.floor);
      const placed = state.placedItems.filter((p) => p.floor === res.floor);
      if (action === 'wave') {
        triggerResidentWave(res);
      } else if (action === 'walk') {
        assignResidentWalk(res, floorW);
      } else if (action === 'sit') {
        const seats = getAvailableSeatsOnFloor(placed, state.residents, atlas, res.id);
        if (seats.length === 0) {
          hud.pushToast(`${RESIDENT_DEF_MAP.get(id)?.name ?? ''} 找不到空着的沙发或椅子啦`, 'warn');
          return;
        }
        assignResidentSit(res, seats[Math.floor(Math.random() * seats.length)]);
      } else if (action === 'sleep') {
        const beds = getBedSleepTargetsOnFloor(placed, state.residents, atlas, res.id);
        if (beds.length === 0) {
          hud.pushToast('当前楼层没有空床铺，先摆放一张百衲软床吧', 'warn');
          return;
        }
        assignResidentSleep(res, beds[0]);
      }
      save();
      syncHud();
    },
    onToggleResidentPresence: (id) => {
      const res = state.residents.find((r) => r.id === id);
      if (!res) return;
      res.present = !res.present;
      if (res.present) {
        res.floor = state.activeFloor;
        const viewCenterX = cameraX + renderer.getViewDimensions().viewW * 0.5;
        const floorW = getFloorWidthPx(state, state.activeFloor);
        res.x = Math.max(70, Math.min(floorW - 70, viewCenterX + (Math.random() - 0.5) * 140));
        res.y = 466;
        triggerResidentWave(res, '👋');
        selectedResidentId = res.id;
        hud.pushToast(`${RESIDENT_DEF_MAP.get(id)?.name ?? ''} 进屋来做客啦！`, 'good');
      } else {
        res.seatedUid = undefined;
        res.sleepBedUid = undefined;
        if (selectedResidentId === id) selectedResidentId = null;
      }
      save();
      syncHud();
    },
    onMoveResidentFloor: (id, floor) => {
      if (!state.floors[floor].unlocked) return;
      const res = state.residents.find((r) => r.id === id);
      if (!res) return;
      res.present = true;
      res.floor = floor;
      res.seatedUid = undefined;
      res.sleepBedUid = undefined;
      res.x = 640;
      res.y = 462;
      state.activeFloor = floor;
      cameraX = Math.max(0, 640 - renderer.getViewDimensions().viewW * 0.5);
      clampCamera();
      triggerResidentWave(res, '🪜');
      save();
      syncHud();
    },
    onFocusResident: (id) => {
      const res = state.residents.find((r) => r.id === id);
      if (!res || !res.present) return;
      state.activeFloor = res.floor;
      cameraX = res.x - renderer.getViewDimensions().viewW * 0.5;
      clampCamera();
      selectedResidentId = res.id;
      triggerResidentWave(res);
      save();
      syncHud();
    },
    onClearSelectedResident: () => {
      selectedResidentId = null;
      syncHud();
    },
    onSummonAllResidents: () => {
      const viewCenter = cameraX + renderer.getViewDimensions().viewW * 0.5;
      const floorW = getFloorWidthPx(state, state.activeFloor);
      state.residents.forEach((r, idx) => {
        r.present = true;
        r.floor = state.activeFloor;
        r.seatedUid = undefined;
        r.sleepBedUid = undefined;
        const spread = (idx - 3) * 86;
        r.x = Math.max(60, Math.min(floorW - 60, viewCenter + spread));
        r.y = 448 + (idx % 2) * 32;
        triggerResidentWave(r);
      });
      hud.pushToast(`全部 7 位小镇成员与柴犬已在 ${state.activeFloor}F 集合！`, 'good');
      save();
      syncHud();
    },
    onWaveAllResidents: () => {
      for (const r of state.residents) {
        if (r.present) triggerResidentWave(r);
      }
      save();
      syncHud();
    },
  });

  const getActiveToolLabel = (): string | null => {
    if (placingMode) {
      const def = CATALOG_MAP.get(placingMode.itemId);
      const meta = atlas.items[placingMode.itemId];
      const modeWord =
        meta?.layer === 'prop'
          ? '2px 微距叠放'
          : meta?.layer === 'floor' || meta?.layer === 'rug'
            ? '地面前后自由摆放'
            : '墙面摆放';
      return `${def?.name ?? placingMode.itemId}（${modeWord}）`;
    }
    if (paintMode) {
      const label =
        paintMode.type === 'wall'
          ? WALL_STYLES.find((w) => w.id === paintMode!.styleId)?.name
          : FLOOR_STYLES.find((f) => f.id === paintMode!.styleId)?.name;
      return `涂刷${paintMode.type === 'wall' ? '墙纸' : '地板'}：${label ?? ''}（${ECONOMY.surfacePricePerGrid}G/格）`;
    }
    return null;
  };

  const syncHud = (): void => {
    const selectedItem = selectedUid
      ? state.placedItems.find((i) => i.uid === selectedUid && i.floor === state.activeFloor) ?? null
      : null;
    const selectedResident =
      !buildMode && selectedResidentId
        ? state.residents.find((r) => r.id === selectedResidentId && r.present && r.floor === state.activeFloor) ?? null
        : null;
    hud.update({
      state,
      clock,
      buildMode,
      selectedItem,
      selectedResident,
      activeToolLabel: getActiveToolLabel(),
      placingItemId: placingMode?.itemId ?? null,
      paintStyleId: paintMode?.styleId ?? null,
      cameraX,
      viewW: renderer.getViewDimensions().viewW,
    });
  };

  const updatePlacementPreview = (): void => {
    if (!placingMode) {
      lastCandidate = null;
      return;
    }
    const floorW = getFloorWidthPx(state, state.activeFloor);
    lastCandidate = evaluatePlacement(
      placingMode.itemId,
      pointerWorld.x,
      pointerWorld.y,
      floorW,
      getFloorItems(),
      atlas,
      placingMode.kind === 'move' ? placingMode.movingUid : undefined
    );
  };

  const computeDragSnap = (worldX: number, worldY: number, resId: ResidentId) => {
    const placed = getFloorItems();
    const seats = getAvailableSeatsOnFloor(placed, state.residents, atlas, resId);
    let snapSeat: (typeof seats)[number] | null = null;
    let bestSeatDist = 52;
    for (const s of seats) {
      const d = Math.hypot(worldX - s.seatX, worldY - (s.seatFootY - 36));
      if (d < bestSeatDist) {
        bestSeatDist = d;
        snapSeat = s;
      }
    }

    const beds = getBedSleepTargetsOnFloor(placed, state.residents, atlas, resId);
    let snapBed: (typeof beds)[number] | null = null;
    let bestBedDist = 66;
    for (const b of beds) {
      const d = Math.hypot(worldX - b.x, worldY - (b.footY - 40));
      if (d < bestBedDist) {
        bestBedDist = d;
        snapBed = b;
      }
    }
    return { snapSeat, snapBed };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      cancelActiveTool();
      syncHud();
      return;
    }
    if (e.button !== 0) return;

    pointerWorld = renderer.screenToWorld(e.clientX, e.clientY, cameraX);

    if (buildMode && paintMode) {
      const f = state.floors[state.activeFloor];
      const col = getGridColumnFromWorldX(pointerWorld.x, f.gridCount);
      const arr = paintMode.type === 'wall' ? f.wallSegments : f.floorSegments;
      if (arr[col] === paintMode.styleId) {
        hud.pushToast('该列已经是这个款式啦', 'normal');
        return;
      }
      if (state.coins < ECONOMY.surfacePricePerGrid) {
        hud.pushToast(`涂刷 1 格需要 ${ECONOMY.surfacePricePerGrid} G`, 'warn');
        return;
      }
      state.coins -= ECONOMY.surfacePricePerGrid;
      arr[col] = paintMode.styleId;
      save();
      syncHud();
      return;
    }

    if (buildMode && placingMode) {
      updatePlacementPreview();
      if (!lastCandidate || !lastCandidate.valid) {
        hud.pushToast(lastCandidate?.reason ?? '此处无法摆放', 'warn');
        return;
      }

      if (placingMode.kind === 'new') {
        const def = CATALOG_MAP.get(placingMode.itemId);
        if (!def) return;
        if (state.coins < def.price) {
          hud.pushToast(`金币不足，需要 ${def.price} G`, 'warn');
          return;
        }
        state.coins -= def.price;
        const newItem: PlacedItem = {
          uid: `item_${state.nextUid++}`,
          itemId: placingMode.itemId,
          floor: state.activeFloor,
          x: lastCandidate.x,
          y: lastCandidate.y,
          variant: placingMode.variant,
          flipped: placingMode.flipped,
          isActive: true,
          parentId: lastCandidate.parentId,
          boughtOnDay: clock.day,
          purchasePrice: def.price,
          zOrder: state.nextUid,
        };
        state.placedItems.push(newItem);
        selectedUid = newItem.uid;
        if (def.tier !== 'T1' || state.coins < def.price) {
          placingMode = null;
          canvas.classList.remove('placing');
        }
        save();
        syncHud();
        return;
      }

      if (placingMode.kind === 'inventory') {
        const invPlacing = placingMode;
        const idx = state.inventory.findIndex((i) => i.uid === invPlacing.invUid);
        if (idx !== -1) state.inventory.splice(idx, 1);
        const restored: PlacedItem = {
          uid: invPlacing.invUid,
          itemId: invPlacing.itemId,
          floor: state.activeFloor,
          x: lastCandidate.x,
          y: lastCandidate.y,
          variant: invPlacing.variant,
          flipped: invPlacing.flipped,
          isActive: true,
          parentId: lastCandidate.parentId,
          boughtOnDay: invPlacing.boughtOnDay,
          purchasePrice: invPlacing.purchasePrice,
          zOrder: state.nextUid++,
        };
        state.placedItems.push(restored);
        selectedUid = restored.uid;
        placingMode = null;
        canvas.classList.remove('placing');
        save();
        syncHud();
        return;
      }

      if (placingMode.kind === 'move') {
        const moving = placingMode;
        const item = state.placedItems.find((i) => i.uid === moving.movingUid);
        if (item) {
          const dx = lastCandidate.x - item.x;
          const dy = lastCandidate.y - item.y;
          item.x = lastCandidate.x;
          item.y = lastCandidate.y;
          item.parentId = lastCandidate.parentId;
          shiftChildren(item.uid, dx, dy);
          selectedUid = item.uid;
        }
        placingMode = null;
        canvas.classList.remove('placing');
        save();
        syncHud();
        return;
      }
    }

    // Play mode: hit-test residents/pets first for direct click or Miga-style drag & drop
    if (!buildMode) {
      const hitRes = hitTestResident(pointerWorld.x, pointerWorld.y, state.activeFloor, state.residents, atlas);
      if (hitRes) {
        draggingRes = {
          res: hitRes,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false,
          worldX: hitRes.x,
          worldY: hitRes.y,
          snapSeat: null,
          snapBed: null,
        };
        canvas.classList.add('dragging');
        return;
      }
    }

    isPanning = true;
    panMoved = false;
    panStartClientX = e.clientX;
    panStartCamX = cameraX;
    canvas.classList.add('dragging');
  });

  window.addEventListener('pointermove', (e) => {
    pointerWorld = renderer.screenToWorld(e.clientX, e.clientY, cameraX);

    if (buildMode && paintMode) {
      const f = state.floors[state.activeFloor];
      paintMode.hoverGridCol =
        pointerWorld.x >= 0 && pointerWorld.x <= f.gridCount * GRID_SIZE
          ? getGridColumnFromWorldX(pointerWorld.x, f.gridCount)
          : null;
    }

    if (buildMode && placingMode) {
      updatePlacementPreview();
    }

    if (draggingRes) {
      const distMoved = Math.hypot(e.clientX - draggingRes.startClientX, e.clientY - draggingRes.startClientY);
      if (distMoved > 6) {
        draggingRes.moved = true;
      }
      const floorW = getFloorWidthPx(state, state.activeFloor);
      const clampedX = Math.max(46, Math.min(floorW - 46, pointerWorld.x));
      const clampedY = Math.max(362, Math.min(FLOOR_MAX_FOOT_Y - 4, pointerWorld.y + 32));
      draggingRes.worldX = clampedX;
      draggingRes.worldY = clampedY;
      const { snapSeat, snapBed } = computeDragSnap(pointerWorld.x, pointerWorld.y, draggingRes.res.id);
      draggingRes.snapSeat = snapSeat;
      draggingRes.snapBed = snapBed;
      return;
    }

    if (isPanning) {
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.getViewDimensions().viewW / Math.max(1, rect.width);
      const deltaClient = e.clientX - panStartClientX;
      if (Math.abs(deltaClient) > 5) {
        panMoved = true;
      }
      cameraX = panStartCamX - deltaClient * scale;
      clampCamera();
      hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (draggingRes) {
      const dr = draggingRes;
      draggingRes = null;
      canvas.classList.remove('dragging');
      selectedResidentId = dr.res.id;

      if (!dr.moved) {
        triggerResidentWave(dr.res);
      } else if (dr.snapSeat) {
        assignResidentSit(dr.res, dr.snapSeat);
      } else if (dr.snapBed) {
        assignResidentSleep(dr.res, dr.snapBed);
      } else {
        dr.res.seatedUid = undefined;
        dr.res.seatedSlotIdx = undefined;
        dr.res.sleepBedUid = undefined;
        dr.res.action = 'idle';
        dr.res.x = dr.worldX;
        dr.res.y = dr.worldY;
        dr.res.stateTimer = 2.4;
      }
      save();
      syncHud();
      return;
    }

    if (!isPanning) return;
    isPanning = false;
    canvas.classList.remove('dragging');

    if (!panMoved && e.button === 0) {
      const world = renderer.screenToWorld(e.clientX, e.clientY, cameraX);
      const hit = hitTestPlacedItem(world.x, world.y, getFloorItems(), atlas);

      if (buildMode) {
        selectedUid = hit ? hit.uid : null;
        syncHud();
      } else {
        if (!hit && selectedResidentId) {
          selectedResidentId = null;
          syncHud();
          return;
        }
        if (hit) {
          const meta = atlas.items[hit.itemId];
          if (meta?.light || meta?.toggleState) {
            hit.isActive = !hit.isActive;
            save();
            syncHud();
          } else if (meta?.isStairs) {
            if (state.floors[2].unlocked) {
              state.activeFloor = state.activeFloor === 1 ? 2 : 1;
              cameraX = 0;
              clampCamera();
              save();
              syncHud();
            } else {
              hud.pushToast(`二楼尚未加盖，点击右上角「🧱 扩建」即可解锁 (4,500 G)`, 'normal');
            }
          }
        }
      }
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (placingMode || paintMode) {
      cancelActiveTool();
      syncHud();
    }
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      cameraX += delta * 0.65;
      clampCamera();
      syncHud();
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    pressedKeys.add(e.key.toLowerCase());
    if (e.key === 'Escape') {
      if (placingMode || paintMode) {
        cancelActiveTool();
      } else if (selectedUid) {
        selectedUid = null;
      } else if (selectedResidentId) {
        selectedResidentId = null;
      } else if (buildMode) {
        buildMode = false;
      }
      syncHud();
    }
  });
  window.addEventListener('keyup', (e) => {
    pressedKeys.delete(e.key.toLowerCase());
  });

  const resizeObs = new ResizeObserver(() => {
    renderer.resizeToDisplay();
    clampCamera();
    hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
  });
  resizeObs.observe(stageWrap);

  window.addEventListener('resize', () => {
    renderer.resizeToDisplay();
    clampCamera();
    syncHud();
  });

  syncHud();

  // --- Main Loop ---
  let lastTime = performance.now();
  let hudClockTick = 0;
  let elapsedSec = 0;
  let lastSelectedAction = '';

  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    elapsedSec += dt;

    const panSpeed = 360 * dt;
    let panKeyMoved = false;
    if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) {
      cameraX -= panSpeed;
      panKeyMoved = true;
    }
    if (pressedKeys.has('d') || pressedKeys.has('arrowright')) {
      cameraX += panSpeed;
      panKeyMoved = true;
    }
    if (panKeyMoved) {
      clampCamera();
      hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
    }

    const { dayChanged, triggerSundayBill } = clock.advance(dt);
    if (triggerSundayBill) {
      const bill = calculateWeeklyBill(getTotalUnlockedGrids(state), getTotalAssetValue(state));
      state.coins = Math.max(0, state.coins - bill.total);
      save();
      hud.pushToast(`📬 周日物业水电账单结算：-${bill.total} G`, 'warn');
      syncHud();
    } else if (dayChanged) {
      save();
      syncHud();
    }

    // Advance Phase 2 resident AI cleanly
    updateResidents(
      state.residents,
      state.placedItems,
      state.floors,
      atlas,
      dt,
      clock.speed,
      clock.hour,
      draggingRes?.res.id ?? null
    );

    // Sync floating action bar smoothly if selected resident changed state autonomously
    if (selectedResidentId && !buildMode) {
      const selR = state.residents.find((r) => r.id === selectedResidentId);
      const sig = selR ? `${selR.action}:${selR.outfit}` : '';
      if (sig !== lastSelectedAction) {
        lastSelectedAction = sig;
        syncHud();
      }
    }

    hudClockTick += dt;
    if (hudClockTick >= 0.45) {
      hudClockTick = 0;
      hud.tickClockDisplay(clock);
    }

    renderer.render({
      floor: state.floors[state.activeFloor],
      placedOnFloor: getFloorItems(),
      residentsOnFloor: getFloorResidents(),
      clock,
      cameraX,
      buildMode,
      selectedUid,
      selectedResidentId: buildMode ? null : selectedResidentId,
      draggingResident:
        draggingRes && draggingRes.moved
          ? {
              resident: draggingRes.res,
              worldX: draggingRes.worldX,
              worldY: draggingRes.worldY,
              snapSeat: draggingRes.snapSeat
                ? { x: draggingRes.snapSeat.seatX, y: draggingRes.snapSeat.seatFootY }
                : null,
              snapBed: draggingRes.snapBed
                ? { x: draggingRes.snapBed.x, y: draggingRes.snapBed.footY }
                : null,
            }
          : null,
      paintMode,
      placementPreview:
        buildMode && placingMode && lastCandidate
          ? {
              itemId: placingMode.itemId,
              variant: placingMode.variant,
              flipped: placingMode.flipped,
              candidate: lastCandidate,
            }
          : null,
      elapsedSec,
    });

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

bootstrap().catch((err) => {
  console.error('Failed to start game:', err);
});
