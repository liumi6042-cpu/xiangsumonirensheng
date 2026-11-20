import './style.css';
import { GameClock } from './core/clock';
import {
  evaluatePlacement,
  getGridColumnFromWorldX,
  hitTestPlacedItem,
  type PlacementCandidate,
} from './core/placement';
import {
  CEILING_BOTTOM_Y,
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

async function bootstrap(): Promise<void> {
  const stageWrap = document.getElementById('stage-wrap') as HTMLElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const hudOverlay = document.getElementById('hud-overlay') as HTMLElement;
  const drawerSlot = document.getElementById('drawer-slot') as HTMLElement;
  const modalSlot = document.getElementById('modal-slot') as HTMLElement;
  const toastSlot = document.getElementById('toast-slot') as HTMLElement;

  const [atlasResp, atlasImg] = await Promise.all([
    fetch('./assets/furniture_atlas.json'),
    loadImage('./assets/furniture_atlas.png'),
  ]);
  const atlas = (await atlasResp.json()) as AtlasJson;

  let state: GameSaveState = loadSaveState();
  const clock = new GameClock(state.day, state.minuteOfDay, state.lastSundayBillDay);
  const renderer = new PixelRenderer(canvas, atlasImg, atlas);
  renderer.resizeToDisplay();

  // Interactive controller state
  let buildMode = false;
  let cameraX = 0;
  let selectedUid: string | null = null;
  let placingMode:
    | {
        kind: 'new';
        itemId: string;
        variant: number;
        flipped: boolean;
      }
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

  // Camera pan state
  let isPanning = false;
  let panMoved = false;
  let panStartClientX = 0;
  let panStartCamX = 0;
  const pressedKeys = new Set<string>();

  const clampCamera = (): void => {
    const { viewW } = renderer.getViewDimensions();
    const floorW = getFloorWidthPx(state, state.activeFloor);
    const maxCam = Math.max(0, floorW - viewW);
    cameraX = Math.max(0, Math.min(maxCam, cameraX));
  };

  const getFloorItems = (): PlacedItem[] =>
    state.placedItems.filter((i) => i.floor === state.activeFloor);

  const save = (): void => {
    state.day = clock.day;
    state.minuteOfDay = clock.minuteOfDay;
    state.lastSundayBillDay = clock.getLastSundayBillDay();
    persistSaveState(state);
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

  const shiftChildren = (parentUid: string, dx: number, dy: number): void => {
    for (const child of state.placedItems) {
      if (child.parentId === parentUid) {
        child.x += dx;
        child.y += dy;
      }
    }
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
      // Pack item + any tabletop props resting on it cleanly into inventory
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
      // Pan gently toward newly opened right space
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
      // Place a starter stairwell door + warm ceiling lamp on 2F automatically
      state.placedItems.push(
        {
          uid: `item_${state.nextUid++}`,
          itemId: 'stairwell_door_1f',
          floor: 2,
          x: 618,
          y: WALL_FLOOR_Y - (atlas.items['stairwell_door_1f']?.h ?? 172),
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
      hud.pushToast(`已发放 Phase 1 装修测试津贴 +${ECONOMY.testStipendAmount} G`, 'good');
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
      cancelActiveTool();
      cameraX = 0;
      hud.pushToast('已恢复初始温馨小屋与 1,200 G 启动资金', 'good');
      syncHud();
    },
    onShowIslandPreview: () => {
      hud.pushToast(
        '🗺️ 单屏小岛 8 大地点（海风咖啡馆、百货、公园、工坊、宠物店、诊所、海边夜市）将在 Phase 4 正式连通！',
        'normal'
      );
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
    hud.update({
      state,
      clock,
      buildMode,
      selectedItem,
      activeToolLabel: getActiveToolLabel(),
      placingItemId: placingMode?.itemId ?? null,
      paintStyleId: paintMode?.styleId ?? null,
      cameraX,
      viewW: renderer.getViewDimensions().viewW,
    });
  };

  // --- Pointer & Keyboard Interactions ---

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

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      cancelActiveTool();
      syncHud();
      return;
    }
    if (e.button !== 0) return;

    pointerWorld = renderer.screenToWorld(e.clientX, e.clientY, cameraX);

    // Handle active paint brush click
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

    // Handle active placement click
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
        // Keep placing props seamlessly for rapid decorating if Shift held or for cheap T1 props, else finish
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

    // Otherwise start panning (or click-select on pointerup if didn't drag)
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
    if (!isPanning) return;
    isPanning = false;
    canvas.classList.remove('dragging');

    if (!panMoved && e.button === 0) {
      const world = renderer.screenToWorld(e.clientX, e.clientY, cameraX);
      const hit = hitTestPlacedItem(world.x, world.y, getFloorItems(), atlas);

      if (buildMode) {
        selectedUid = hit ? hit.uid : null;
        syncHud();
      } else if (hit) {
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
            hud.pushToast(`二楼尚未加盖，点击右上角「🧱 扩建」即可解锁 (${4500} G)`, 'normal');
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

  // Initial HUD render
  syncHud();

  // --- Main Loop ---
  let lastTime = performance.now();
  let hudClockTick = 0;
  let elapsedSec = 0;

  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    elapsedSec += dt;

    // Smooth keyboard camera panning
    const panSpeed = 340 * dt;
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

    // Advance GameClock (档位 B)
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

    hudClockTick += dt;
    if (hudClockTick >= 0.45) {
      hudClockTick = 0;
      hud.tickClockDisplay(clock);
    }

    renderer.render({
      floor: state.floors[state.activeFloor],
      placedOnFloor: getFloorItems(),
      clock,
      cameraX,
      buildMode,
      selectedUid,
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
