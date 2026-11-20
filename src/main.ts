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
  getTotalComfortScore,
  getTotalUnlockedGrids,
  loadSaveState,
  persistSaveState,
  type GameSaveState,
  type PlacedItem,
} from './core/roomState';
import {
  MARKET_WARES,
  STREET_HOTSPOTS,
  WORLD_MAP_LANDMARKS,
  clampVital,
  computeEntryJobPay,
  computeFreelanceOrderPay,
  computeHomeRecoveryBonus,
  computeNightMarketSale,
  createMarketActors,
  createStreetActors,
  getCareerTier,
  getHomeApplianceActionMeta,
  pullGachaItem,
  updateOutdoorActors,
  type MarketWareId,
  type OutdoorActor,
  type SceneMode,
  type StreetSpotId,
  type WorldMapLandmark,
  type WorldMapLandmarkId,
} from './core/townLife';
import { CATALOG_MAP, FLOOR_STYLES, WALL_STYLES, type AtlasJson } from './data/catalog';
import { CAREER_WAGE_TABLE, ECONOMY, GRID_SIZE, VIRTUAL_HEIGHT, calculateWeeklyBill, getSellRefund } from './data/economy';
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
  urls.add('./assets/backdrops/backdrop_street_town_day.png');
  urls.add('./assets/backdrops/backdrop_sunset_balcony.png');
  urls.add('./assets/backdrops/backdrop_night_starry_town.png');
  urls.add('./assets/backdrops/island_world_map.png');

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
  let cameraX = 40;
  let cameraY = 125;
  let selectedUid: string | null = null;
  let selectedResidentId: ResidentId | null = null;

  // Phase 3-4 overworld-first world map, outdoor towns & daily life loop
  let sceneMode: SceneMode = 'map';
  let lastMapCam = { x: 40, y: 125 };
  let mapPetBubbleTimer = 0;
  let activeStreetSpot: Exclude<StreetSpotId, 'home' | 'market'> = 'cafe';
  let activeMarketWare: MarketWareId = 'coffee';
  let pendingHomeItem: PlacedItem | null = null;
  let hoveredHotspotId: string | null = null;
  let streetActors: OutdoorActor[] = createStreetActors();
  let marketActors: OutdoorActor[] = createMarketActors();

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
  let panStartClientY = 0;
  let panStartCamX = 0;
  let panStartCamY = 0;
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
    if (sceneMode === 'map') {
      const { mapW, mapH } = renderer.getWorldMapDimensions();
      cameraX = Math.max(0, Math.min(Math.max(0, mapW - viewW), cameraX));
      cameraY = Math.max(0, Math.min(Math.max(0, mapH - VIRTUAL_HEIGHT), cameraY));
      return;
    }
    cameraY = 0;
    if (sceneMode !== 'home') {
      const maxCam = Math.max(0, 960 - viewW);
      cameraX = Math.max(0, Math.min(maxCam, cameraX));
      return;
    }
    const floorW = getFloorWidthPx(state, state.activeFloor);
    const maxCam = Math.max(0, floorW - viewW);
    cameraX = Math.max(0, Math.min(maxCam, cameraX));
  };

  const hitTestMapLandmark = (mapX: number, mapY: number): WorldMapLandmark | null => {
    const { mapW, mapH } = renderer.getWorldMapDimensions();
    // Check pin pills first for pinpoint accuracy, then building boxes
    for (const lm of WORLD_MAP_LANDMARKS) {
      const px = lm.pinX * mapW;
      const py = lm.pinY * mapH;
      if (Math.abs(mapX - px) <= 64 && Math.abs(mapY - py) <= 16) {
        return lm;
      }
    }
    for (const lm of WORLD_MAP_LANDMARKS) {
      const bx = lm.nx * mapW;
      const by = lm.ny * mapH;
      const bw = lm.nw * mapW;
      const bh = lm.nh * mapH;
      if (mapX >= bx && mapX <= bx + bw && mapY >= by && mapY <= by + bh) {
        return lm;
      }
    }
    return null;
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

  const handleClockEvents = (dayChanged: boolean, triggerSundayBill: boolean): boolean => {
    let dirty = dayChanged;
    if (clock.day !== state.nightMarketDay) {
      state.nightMarketDay = clock.day;
      state.nightMarketSalesToday = 0;
      dirty = true;
    }
    if (triggerSundayBill) {
      const bill = calculateWeeklyBill(getTotalUnlockedGrids(state), getTotalAssetValue(state));
      state.coins = Math.max(0, state.coins - bill.total);
      hud.pushToast(`📬 周日物业水电账单结算：-${bill.total} G`, 'warn');
      dirty = true;
    }
    return dirty;
  };

  const advanceClockAndBills = (minutes: number): void => {
    const { dayChanged, triggerSundayBill } = clock.advanceMinutes(minutes);
    handleClockEvents(dayChanged, triggerSundayBill);
  };

  const maybeNotifyPromotion = (prevLevel: number, nextXp: number): void => {
    const tier = getCareerTier(nextXp);
    if (tier.level > prevLevel) {
      hud.pushToast(`🎉 职业晋升为「Lv.${tier.level} ${tier.title}」！收益倍率 ${tier.multiplier}x`, 'good');
    }
  };

  const focusStreetActorOnSpot = (spot: Exclude<StreetSpotId, 'home' | 'market'>): void => {
    const hero = streetActors[0];
    const hs = STREET_HOTSPOTS.find((h) => h.id === spot);
    const targetX = hs ? hs.standX : 510;
    if (hero) {
      hero.x = targetX;
      hero.pauseTimer = 3.2;
      hero.emoteText = spot === 'cafe' ? '☕' : spot === 'salon' ? '✨' : spot === 'bakery' ? '🥐' : '🌿';
      hero.emoteTimer = 2.6;
    }
    const { viewW } = renderer.getViewDimensions();
    cameraX = targetX - viewW * 0.5;
    clampCamera();
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
      pendingHomeItem = null;
      if (buildMode && sceneMode !== 'home') {
        sceneMode = 'home';
        cameraX = 0;
      }
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
      sceneMode = 'home';
      selectedUid = null;
      selectedResidentId = null;
      pendingHomeItem = null;
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
      if (clock.day !== state.nightMarketDay) {
        state.nightMarketDay = clock.day;
        state.nightMarketSalesToday = 0;
      }
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
      sceneMode = 'map';
      lastMapCam = { x: 40, y: 125 };
      activeStreetSpot = 'cafe';
      activeMarketWare = 'coffee';
      pendingHomeItem = null;
      hoveredHotspotId = null;
      streetActors = createStreetActors();
      marketActors = createMarketActors();
      selectedUid = null;
      selectedResidentId = null;
      cancelActiveTool();
      cameraX = 40;
      cameraY = 125;
      clampCamera();
      hud.pushToast('已恢复初始小镇、原创角色与 1,200 G 启动资金', 'good');
      syncHud();
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
    // Phase 3-4 outdoor scenes & life loop
    onSwitchScene: (scene, spot) => {
      switchScene(scene, spot);
    },
    onSelectStreetSpot: (spot) => {
      activeStreetSpot = spot;
      focusStreetActorOnSpot(spot);
      syncHud();
    },
    onDoStreetJob: (spot) => {
      const energyCost = 24;
      if (state.energy < energyCost) {
        hud.pushToast(`⚡ 精力不足（需 ${energyCost} 点），先歇息或吃点甜品再打工吧`, 'warn');
        return;
      }
      const prevLevel = getCareerTier(state.careerXp).level;
      const { base, tip, total } = computeEntryJobPay(state.careerXp, state.mood);
      state.coins += total;
      state.energy = clampVital(state.energy - energyCost);
      state.mood = clampVital(state.mood - 6);
      state.careerXp += 18;
      advanceClockAndBills(120);

      const hero = streetActors[0];
      if (hero) {
        hero.emoteText = '💰';
        hero.emoteTimer = 2.6;
      }
      const shopName = STREET_HOTSPOTS.find((h) => h.id === spot)?.name ?? '街区店铺';
      hud.pushToast(`${shopName} 兼职完成：底薪 +${base}G + 小费 +${tip}G = +${total} G`, 'good');
      maybeNotifyPromotion(prevLevel, state.careerXp);
      save();
      syncHud();
    },
    onDoStreetTreatOrGacha: (spot) => {
      if (spot === 'cafe') {
        if (state.coins < ECONOMY.coffeePrice) {
          hud.pushToast(`金币不足！海风拿铁需要 ${ECONOMY.coffeePrice} G`, 'warn');
          return;
        }
        state.coins -= ECONOMY.coffeePrice;
        state.energy = clampVital(state.energy + 18);
        state.mood = clampVital(state.mood + 22);
        advanceClockAndBills(25);
        hud.pushToast(`☕ 享用现磨海风拿铁 (-${ECONOMY.coffeePrice}G)：精力 +18 · 心情 +22`, 'good');
      } else if (spot === 'bakery') {
        const cost = 12;
        if (state.coins < cost) {
          hud.pushToast(`金币不足！黄油可颂需要 ${cost} G`, 'warn');
          return;
        }
        state.coins -= cost;
        state.energy = clampVital(state.energy + 26);
        state.mood = clampVital(state.mood + 16);
        advanceClockAndBills(25);
        hud.pushToast(`🥐 享用黄油可颂 (-${cost}G)：精力 +26 · 心情 +16`, 'good');
      } else if (spot === 'park') {
        state.energy = clampVital(state.energy + 14);
        state.mood = clampVital(state.mood + 20);
        advanceClockAndBills(30);
        hud.pushToast('🌿 在街心长椅晒太阳撸柴犬：精力 +14 · 心情 +20', 'good');
      } else {
        if (state.coins < ECONOMY.gachaPullPrice) {
          hud.pushToast(`金币不足！惊喜扭蛋需要 ${ECONOMY.gachaPullPrice} G`, 'warn');
          return;
        }
        const pulled = pullGachaItem(state, atlas, clock.day);
        if (!pulled) {
          hud.pushToast('扭蛋机补货中，稍后再来', 'warn');
          return;
        }
        state.coins -= ECONOMY.gachaPullPrice;
        state.mood = clampVital(state.mood + 18);
        advanceClockAndBills(15);
        const hero = streetActors[0];
        if (hero) {
          hero.emoteText = '🎁';
          hero.emoteTimer = 3.0;
        }
        hud.pushToast(`🎁 扭蛋开出 [${pulled.tier}]「${pulled.itemName}」！已放进装修仓库`, 'good');
      }
      save();
      syncHud();
    },
    onSelectMarketWare: (ware) => {
      activeMarketWare = ware;
      syncHud();
    },
    onSellNightMarketStall: () => {
      if (clock.day !== state.nightMarketDay) {
        state.nightMarketDay = clock.day;
        state.nightMarketSalesToday = 0;
      }
      if (!clock.isNightMarketOpen) {
        hud.pushToast('🌙 星光夜市 18:00–02:00 营业，请先将时间切换至傍晚', 'warn');
        return;
      }
      const maxSales = CAREER_WAGE_TABLE.midFreelanceAndMarket.nightMarketMaxSalesPerNight;
      if (state.nightMarketSalesToday >= maxSales) {
        hud.pushToast(`今日夜市已售罄（${maxSales}/${maxSales} 单），明晚 18:00 再来吧！`, 'warn');
        return;
      }
      const energyCost = 6;
      if (state.energy < energyCost) {
        hud.pushToast(`⚡ 精力不足（需 ${energyCost} 点），先休息回复体力再来摆摊`, 'warn');
        return;
      }
      const ware = MARKET_WARES.find((w) => w.id === activeMarketWare) ?? MARKET_WARES[0];
      const prevLevel = getCareerTier(state.careerXp).level;
      const { revenue, mult } = computeNightMarketSale(ware, state.careerXp, state.mood);
      state.coins += revenue;
      state.energy = clampVital(state.energy - energyCost);
      state.mood = clampVital(state.mood + 3);
      state.careerXp += 10;
      state.nightMarketSalesToday += 1;
      advanceClockAndBills(25);

      const hero = marketActors[0];
      if (hero) {
        hero.emoteText = '🏮';
        hero.emoteTimer = 2.6;
      }
      hud.pushToast(
        `🏮 夜市第 ${state.nightMarketSalesToday}/${maxSales} 单成交！「${ware.name}」(${mult}x) +${revenue} G`,
        'good'
      );
      maybeNotifyPromotion(prevLevel, state.careerXp);
      save();
      syncHud();
    },
    onExecuteHomeActivity: (item) => {
      const hasComputer = state.placedItems.some(
        (p) => p.floor === item.floor && p.itemId === 'desktop_pc_set'
      );
      const act = getHomeApplianceActionMeta(item.itemId, hasComputer);
      if (!act) {
        pendingHomeItem = null;
        syncHud();
        return;
      }
      if (act.energyDelta < 0 && state.energy < Math.abs(act.energyDelta)) {
        hud.pushToast(`⚡ 精力不足（需 ${Math.abs(act.energyDelta)} 点），先吃饭或上床补觉吧`, 'warn');
        return;
      }
      if (act.costCoins > 0 && state.coins < act.costCoins) {
        hud.pushToast(`金币不足！需要 ${act.costCoins} G`, 'warn');
        return;
      }

      const comfort = getTotalComfortScore(state);
      if (act.kind === 'freelance') {
        const useComputer = hasComputer || item.itemId === 'desktop_pc_set';
        const prevLevel = getCareerTier(state.careerXp).level;
        const earn = computeFreelanceOrderPay(useComputer, state.careerXp, comfort);
        state.coins += earn;
        state.energy = clampVital(state.energy + act.energyDelta);
        state.mood = clampVital(state.mood + act.moodDelta);
        state.careerXp += useComputer ? 24 : 12;
        advanceClockAndBills(act.minutes);
        hud.pushToast(
          useComputer
            ? `💻 居家外包交付完成：+${earn} G（含舒适度与职级加成）`
            : `📝 手账整理零工完成：+${earn} G`,
          'good'
        );
        maybeNotifyPromotion(prevLevel, state.careerXp);
      } else {
        const comfortBonus = computeHomeRecoveryBonus(comfort);
        const eGain = act.energyDelta + comfortBonus;
        const mGain = act.moodDelta + Math.round(comfortBonus * 0.6);
        state.coins -= act.costCoins;
        state.energy = clampVital(state.energy + eGain);
        state.mood = clampVital(state.mood + mGain);
        advanceClockAndBills(act.minutes);
        const girl = state.residents.find((r) => r.id === 'girl' && r.present && r.floor === item.floor);
        if (girl) {
          triggerResidentWave(girl, act.kind === 'sleep' ? '💤' : act.kind === 'bath' ? '🛁' : act.kind === 'meal' ? '🍳' : '✨');
        }
        hud.pushToast(
          `${act.title.split('·')[0].trim()}完成：精力 +${eGain} · 心情 +${mGain}${comfortBonus > 0 ? `（小屋舒适度 +${comfortBonus}）` : ''}`,
          'good'
        );
      }
      pendingHomeItem = null;
      save();
      syncHud();
    },
    onDismissHomeActivity: () => {
      pendingHomeItem = null;
      syncHud();
    },
    onPetCareVisit: () => {
      triggerPetCareVisit();
    },
    onEnterMapLandmark: (landmarkId) => {
      enterMapLandmark(landmarkId);
    },
    onHoverMapLandmark: (landmarkId) => {
      if (sceneMode !== 'map') return;
      hoveredHotspotId = landmarkId;
      if (landmarkId) {
        const lm = WORLD_MAP_LANDMARKS.find((m) => m.id === landmarkId);
        if (lm) {
          focusMapOnLandmark(lm);
          hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
        }
      }
    },
  });

  const switchScene = (scene: SceneMode, spot?: StreetSpotId): void => {
    if (sceneMode === 'map' && scene !== 'map') {
      lastMapCam = { x: cameraX, y: cameraY };
    }
    cancelActiveTool();
    buildMode = false;
    selectedUid = null;
    selectedResidentId = null;
    pendingHomeItem = null;
    hoveredHotspotId = null;
    sceneMode = scene;
    if (spot && spot !== 'home' && spot !== 'market') {
      activeStreetSpot = spot;
    }
    if (scene === 'map') {
      cameraX = lastMapCam.x;
      cameraY = lastMapCam.y;
      clampCamera();
    } else if (scene === 'street') {
      cameraY = 0;
      focusStreetActorOnSpot(activeStreetSpot);
      const spotName = STREET_HOTSPOTS.find((h) => h.id === activeStreetSpot)?.name ?? '中央樱花公园长椅';
      hud.pushToast(`🏙️ 来到海风商业街 · ${spotName}`, 'good');
    } else if (scene === 'market') {
      if (clock.day !== state.nightMarketDay) {
        state.nightMarketDay = clock.day;
        state.nightMarketSalesToday = 0;
      }
      cameraX = 0;
      cameraY = 0;
      clampCamera();
      hud.pushToast(
        clock.isNightMarketOpen
          ? '🏮 星光海滨夜市火热开摊中！精选手作好物即可出摊'
          : '🌙 星光海滨夜市 18:00–02:00 营业，可点下方直接跳时开市',
        'normal'
      );
    } else {
      cameraX = 0;
      cameraY = 0;
      clampCamera();
      hud.pushToast('🏠 回到温馨小屋', 'normal');
    }
    save();
    syncHud();
  };

  const triggerPetCareVisit = (): void => {
    const shiba = state.residents.find((r) => r.id === 'shiba' && r.present);
    if (state.coins >= 20) {
      state.coins -= 20;
      state.energy = clampVital(state.energy + 8);
      state.mood = clampVital(state.mood + 24);
      advanceClockAndBills(30);
      if (shiba) triggerResidentWave(shiba, '🐶');
      hud.pushToast('🐾 萌宠护理小屋顺毛spa完成：-20 G · 心情 +24', 'good');
    } else {
      state.mood = clampVital(state.mood + 12);
      advanceClockAndBills(20);
      if (shiba) triggerResidentWave(shiba, '🐶');
      hud.pushToast('🐶 和豆包开心互动玩耍：心情 +12', 'good');
    }
    mapPetBubbleTimer = 2.8;
    save();
    syncHud();
  };

  const focusMapOnLandmark = (lm: WorldMapLandmark): void => {
    const { viewW } = renderer.getViewDimensions();
    const { mapW, mapH } = renderer.getWorldMapDimensions();
    const lx = (lm.nx + lm.nw * 0.5) * mapW;
    const ly = (lm.ny + lm.nh * 0.5) * mapH;
    const padX = 90;
    const padY = 60;
    if (lx < cameraX + padX || lx > cameraX + viewW - padX) {
      cameraX = lx - viewW * 0.5;
    }
    if (ly < cameraY + padY || ly > cameraY + VIRTUAL_HEIGHT - padY) {
      cameraY = ly - VIRTUAL_HEIGHT * 0.5;
    }
    clampCamera();
  };

  const enterMapLandmark = (landmarkId: WorldMapLandmarkId): void => {
    const lm = WORLD_MAP_LANDMARKS.find((m) => m.id === landmarkId);
    if (!lm) return;
    if (lm.targetScene === 'pet') {
      focusMapOnLandmark(lm);
      triggerPetCareVisit();
      return;
    }
    if (lm.targetScene === 'home') {
      switchScene('home');
    } else if (lm.targetScene === 'market') {
      switchScene('market');
    } else {
      switchScene('street', lm.targetSpot);
    }
  };

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
      !buildMode && sceneMode === 'home' && selectedResidentId
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
      sceneMode,
      activeStreetSpot,
      activeMarketWare,
      pendingHomeItem,
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
      pendingHomeItem = null;
      syncHud();
      return;
    }
    if (e.button !== 0) return;

    if (sceneMode !== 'home') {
      isPanning = true;
      panMoved = false;
      panStartClientX = e.clientX;
      panStartClientY = e.clientY;
      panStartCamX = cameraX;
      panStartCamY = cameraY;
      canvas.classList.add('dragging');
      return;
    }

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
    if (!buildMode && sceneMode === 'home') {
      const hitRes = hitTestResident(pointerWorld.x, pointerWorld.y, state.activeFloor, state.residents, atlas);
      if (hitRes) {
        pendingHomeItem = null;
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
    if (sceneMode === 'map') {
      const mapPt = renderer.screenToWorldMap(e.clientX, e.clientY, cameraX, cameraY);
      const hitLm = hitTestMapLandmark(mapPt.x, mapPt.y);
      hoveredHotspotId = hitLm?.id ?? null;
      canvas.style.cursor = !isPanning && hitLm ? 'pointer' : '';
    } else if (sceneMode === 'street') {
      const outPt = renderer.screenToOutdoor(e.clientX, e.clientY, cameraX);
      const hitSpot = STREET_HOTSPOTS.find(
        (h) => outPt.x >= h.x && outPt.x <= h.x + h.w && outPt.y >= h.y && outPt.y <= h.y + h.h
      );
      hoveredHotspotId = hitSpot?.id ?? null;
      canvas.style.cursor = !isPanning && hitSpot ? 'pointer' : '';
    } else {
      hoveredHotspotId = null;
      canvas.style.cursor = '';
      pointerWorld = renderer.screenToWorld(e.clientX, e.clientY, cameraX);
    }

    if (sceneMode === 'home' && buildMode && paintMode) {
      const f = state.floors[state.activeFloor];
      paintMode.hoverGridCol =
        pointerWorld.x >= 0 && pointerWorld.x <= f.gridCount * GRID_SIZE
          ? getGridColumnFromWorldX(pointerWorld.x, f.gridCount)
          : null;
    }

    if (sceneMode === 'home' && buildMode && placingMode) {
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
      const deltaClientX = e.clientX - panStartClientX;
      const deltaClientY = e.clientY - panStartClientY;
      if (Math.hypot(deltaClientX, sceneMode === 'map' ? deltaClientY : 0) > 5) {
        panMoved = true;
      }
      cameraX = panStartCamX - deltaClientX * scale;
      if (sceneMode === 'map') {
        cameraY = panStartCamY - deltaClientY * scale;
      }
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
      pendingHomeItem = null;

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
      if (sceneMode === 'map') {
        const mapPt = renderer.screenToWorldMap(e.clientX, e.clientY, cameraX, cameraY);
        const hitLm = hitTestMapLandmark(mapPt.x, mapPt.y);
        if (hitLm) {
          enterMapLandmark(hitLm.id);
        }
        return;
      }
      if (sceneMode === 'street') {
        const outPt = renderer.screenToOutdoor(e.clientX, e.clientY, cameraX);
        const hitSpot = STREET_HOTSPOTS.find(
          (h) => outPt.x >= h.x && outPt.x <= h.x + h.w && outPt.y >= h.y && outPt.y <= h.y + h.h
        );
        if (hitSpot) {
          activeStreetSpot = hitSpot.id;
          focusStreetActorOnSpot(hitSpot.id);
          hud.pushToast(`📍 已切换至「${hitSpot.name}」，可点击下方按钮打工或体验消费`, 'normal');
          syncHud();
        }
        return;
      }
      if (sceneMode !== 'home') return;

      const world = renderer.screenToWorld(e.clientX, e.clientY, cameraX);
      const hit = hitTestPlacedItem(world.x, world.y, getFloorItems(), atlas);

      if (buildMode) {
        selectedUid = hit ? hit.uid : null;
        syncHud();
      } else {
        if (!hit) {
          if (selectedResidentId || pendingHomeItem) {
            selectedResidentId = null;
            pendingHomeItem = null;
            syncHud();
          }
          return;
        }
        const meta = atlas.items[hit.itemId];
        if (meta?.light || meta?.toggleState) {
          hit.isActive = !hit.isActive;
          pendingHomeItem = null;
          save();
          syncHud();
        } else if (meta?.isStairs) {
          pendingHomeItem = null;
          if (state.floors[2].unlocked) {
            state.activeFloor = state.activeFloor === 1 ? 2 : 1;
            cameraX = 0;
            clampCamera();
            save();
            syncHud();
          } else {
            hud.pushToast(`二楼尚未加盖，点击右上角「🧱 扩建」即可解锁 (4,500 G)`, 'normal');
          }
        } else {
          const hasComputer = state.placedItems.some(
            (p) => p.floor === state.activeFloor && p.itemId === 'desktop_pc_set'
          );
          if (getHomeApplianceActionMeta(hit.itemId, hasComputer)) {
            pendingHomeItem = hit;
            selectedResidentId = null;
            syncHud();
          } else if (pendingHomeItem) {
            pendingHomeItem = null;
            syncHud();
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
      } else if (pendingHomeItem) {
        pendingHomeItem = null;
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

  clampCamera();
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
    if (mapPetBubbleTimer > 0) {
      mapPetBubbleTimer = Math.max(0, mapPetBubbleTimer - dt);
    }

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
    if (sceneMode === 'map' && (pressedKeys.has('w') || pressedKeys.has('arrowup'))) {
      cameraY -= panSpeed;
      panKeyMoved = true;
    }
    if (sceneMode === 'map' && (pressedKeys.has('s') || pressedKeys.has('arrowdown'))) {
      cameraY += panSpeed;
      panKeyMoved = true;
    }
    if (panKeyMoved) {
      clampCamera();
      hud.updateScrollArrowsOnly(state, cameraX, renderer.getViewDimensions().viewW);
    }

    const { dayChanged, triggerSundayBill } = clock.advance(dt);
    if (handleClockEvents(dayChanged, triggerSundayBill)) {
      save();
      syncHud();
    }

    // Advance Phase 2 resident AI or Phase 3-4 outdoor actors
    if (sceneMode === 'street') {
      updateOutdoorActors(streetActors, dt, clock.speed);
    } else if (sceneMode === 'market') {
      updateOutdoorActors(marketActors, dt, clock.speed);
    } else {
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
    }

    // Sync floating action bar smoothly if selected resident changed state autonomously
    if (sceneMode === 'home' && selectedResidentId && !buildMode) {
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
      sceneMode,
      outdoorActors: sceneMode === 'market' ? marketActors : streetActors,
      hoveredHotspotId,
      floor: state.floors[state.activeFloor],
      placedOnFloor: getFloorItems(),
      residentsOnFloor: getFloorResidents(),
      clock,
      cameraX,
      cameraY,
      mapPetBubbleTimer,
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
