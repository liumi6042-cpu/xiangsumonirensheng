import type { GameClock } from '../core/clock';
import {
  getFloorWidthPx,
  getNextExpansionForFloor,
  getTotalAssetValue,
  getTotalComfortScore,
  getTotalUnlockedGrids,
  type GameSaveState,
  type PlacedItem,
} from '../core/roomState';
import {
  CATALOG_ITEMS,
  CATALOG_MAP,
  FLOOR_STYLES,
  WALL_STYLES,
  type AtlasJson,
  type CatalogCategory,
} from '../data/catalog';
import {
  ECONOMY,
  FLOOR_2_UNLOCK_COST,
  calculateWeeklyBill,
  getSellRefund,
} from '../data/economy';

export type DrawerTab = CatalogCategory | '墙纸地板' | '仓库' | '经济测试';

export interface HudCallbacks {
  onSetSpeed: (speed: 0 | 1 | 2 | 3) => void;
  onToggleBuildMode: () => void;
  onSelectFloor: (floor: 1 | 2) => void;
  onScrollBy: (dx: number) => void;
  onStartPlaceNew: (itemId: string) => void;
  onStartPlaceFromInventory: (invUid: string) => void;
  onStartPaint: (type: 'wall' | 'floor', styleId: string) => void;
  onCancelTool: () => void;
  onMoveSelected: () => void;
  onCycleVariantSelected: () => void;
  onFlipSelected: () => void;
  onPackSelected: () => void;
  onSellSelected: () => void;
  onExpandFloor: (floor: 1 | 2) => void;
  onUnlockFloor2: () => void;
  onGrantTestCoins: () => void;
  onJumpTime: (hour: number) => void;
  onResetSave: () => void;
  onShowIslandPreview: () => void;
}

export class GameHud {
  private activeTab: DrawerTab = '全部';
  private showExpansionModal = false;

  private topBarEl!: HTMLElement;
  private floorSwitcherEl!: HTMLElement;
  private scrollLeftBtn!: HTMLButtonElement;
  private scrollRightBtn!: HTMLButtonElement;
  private bottomInfoEl!: HTMLElement;
  private drawerEl!: HTMLElement;
  private selectionBarEl!: HTMLElement;
  private placementBannerEl!: HTMLElement;
  private modalEl!: HTMLElement;

  private thumbCache = new Map<string, string>();
  private lastCoins = 0;
  private clockTextEl: HTMLElement | null = null;
  private drawerScrollLeft = 0;

  constructor(
    private overlayRoot: HTMLElement,
    private drawerSlot: HTMLElement,
    private modalSlot: HTMLElement,
    private toastStackEl: HTMLElement,
    private atlasImg: HTMLImageElement,
    private atlas: AtlasJson,
    private cb: HudCallbacks
  ) {
    this.buildDom();
  }

  private buildDom(): void {
    this.overlayRoot.innerHTML = '';
    this.drawerSlot.innerHTML = '';
    this.modalSlot.innerHTML = '';

    this.topBarEl = this.el('div', 'top-hud');
    this.floorSwitcherEl = this.el('div', 'floor-switcher pixel-panel hud-interactive');
    this.scrollLeftBtn = this.el('button', 'pixel-btn scroll-arrow left hud-interactive') as HTMLButtonElement;
    this.scrollLeftBtn.textContent = '◀';
    this.scrollLeftBtn.title = '向左滑动房间 (A / ←)';
    this.scrollLeftBtn.onclick = () => this.cb.onScrollBy(-240);

    this.scrollRightBtn = this.el('button', 'pixel-btn scroll-arrow right hud-interactive') as HTMLButtonElement;
    this.scrollRightBtn.textContent = '▶';
    this.scrollRightBtn.title = '向右滑动房间 (D / →)';
    this.scrollRightBtn.onclick = () => this.cb.onScrollBy(240);

    this.bottomInfoEl = this.el('div', 'bottom-info-bar');
    this.selectionBarEl = this.el('div', 'selection-bar pixel-panel hud-interactive');
    this.placementBannerEl = this.el('div', 'placement-banner pixel-panel hud-interactive');
    this.drawerEl = this.el('div', 'build-drawer pixel-panel hud-interactive');
    this.modalEl = this.el('div', 'modal-backdrop hud-interactive');

    this.overlayRoot.append(
      this.topBarEl,
      this.floorSwitcherEl,
      this.scrollLeftBtn,
      this.scrollRightBtn,
      this.bottomInfoEl,
      this.selectionBarEl,
      this.placementBannerEl
    );
    this.drawerSlot.appendChild(this.drawerEl);
    this.modalSlot.appendChild(this.modalEl);
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = cls;
    return node;
  }

  public setExpansionModalOpen(open: boolean): void {
    this.showExpansionModal = open;
  }

  public pushToast(message: string, tone: 'normal' | 'good' | 'warn' = 'normal'): void {
    const toast = this.el('div', 'toast-msg pixel-card');
    if (tone === 'good') {
      toast.style.background = '#e1f7df';
      toast.style.borderColor = '#2e733b';
    } else if (tone === 'warn') {
      toast.style.background = '#ffe3dc';
      toast.style.borderColor = '#9f3528';
    }
    toast.textContent = message;
    this.toastStackEl.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  public spawnCoinDelta(delta: number): void {
    if (delta === 0) return;
    const badge = this.topBarEl.querySelector('.coin-badge');
    const rect = badge?.getBoundingClientRect();
    const node = this.el('div', 'float-delta');
    node.textContent = delta > 0 ? `+${delta} G` : `${delta} G`;
    node.style.color = delta > 0 ? '#7df28b' : '#ff9885';
    node.style.left = `${rect ? rect.left + 12 : window.innerWidth - 200}px`;
    node.style.top = `${rect ? rect.bottom + 4 : 52}px`;
    this.overlayRoot.appendChild(node);
    setTimeout(() => node.remove(), 1100);
  }

  public tickClockDisplay(clock: GameClock): void {
    if (!this.clockTextEl) return;
    const sky = clock.getSkyPalette();
    const nightTag = clock.isNightMarketOpen ? ' · ✦夜市开市中' : '';
    this.clockTextEl.innerHTML = `<span>${sky.weatherIcon}</span><span>DAY ${clock.day} ${clock.weekdayName} • ${clock.formattedTime}</span><span style="color:#ffd885;font-size:12px;">${sky.periodLabel}${nightTag}</span>`;
  }

  public updateScrollArrowsOnly(state: GameSaveState, cameraX: number, viewW: number): void {
    this.renderScrollArrows(state, cameraX, viewW);
  }

  public update(params: {
    state: GameSaveState;
    clock: GameClock;
    buildMode: boolean;
    selectedItem: PlacedItem | null;
    activeToolLabel: string | null;
    placingItemId: string | null;
    paintStyleId: string | null;
    cameraX: number;
    viewW: number;
  }): void {
    const { state, clock, buildMode, selectedItem, activeToolLabel } = params;
    if (this.lastCoins !== 0 && state.coins !== this.lastCoins) {
      this.spawnCoinDelta(state.coins - this.lastCoins);
    }
    this.lastCoins = state.coins;

    this.renderTopBar(state, clock, buildMode);
    this.renderFloorSwitcher(state);
    this.renderScrollArrows(state, params.cameraX, params.viewW);
    this.renderBottomInfo(state, buildMode);
    this.renderSelectionBar(state, selectedItem, buildMode, activeToolLabel);
    this.renderPlacementBanner(buildMode, activeToolLabel);
    this.renderDrawer(state, buildMode, params.placingItemId, params.paintStyleId);
    this.renderExpansionModal(state);
  }

  private renderTopBar(state: GameSaveState, clock: GameClock, buildMode: boolean): void {
    const sky = clock.getSkyPalette();
    const bill = calculateWeeklyBill(getTotalUnlockedGrids(state), getTotalAssetValue(state));
    const comfort = getTotalComfortScore(state);
    const nightTag = clock.isNightMarketOpen ? ' · ✦夜市开市中' : '';

    this.topBarEl.innerHTML = '';

    // Left cluster: clock + speed
    const leftGroup = this.el('div', 'hud-group hud-interactive');

    const clockBadge = this.el('div', 'clock-badge pixel-panel');
    clockBadge.innerHTML = `<span>${sky.weatherIcon}</span><span>DAY ${clock.day} ${clock.weekdayName} • ${clock.formattedTime}</span><span style="color:#ffd885;font-size:12px;">${sky.periodLabel}${nightTag}</span>`;
    this.clockTextEl = clockBadge;

    const speedBox = this.el('div', 'speed-group pixel-panel');
    const speeds: Array<{ s: 0 | 1 | 2 | 3; label: string; title: string }> = [
      { s: 0, label: '⏸', title: '暂停时间' },
      { s: 1, label: '▶ 1x', title: '档位 B 标准流速（1秒=1游戏分钟）' },
      { s: 2, label: '▶▶ 2x', title: '3倍速快进' },
      { s: 3, label: '⚡ 3x', title: '8倍速极速快进' },
    ];
    for (const sp of speeds) {
      const btn = this.el('button', `pixel-btn speed-btn${clock.speed === sp.s ? ' active' : ''}`);
      btn.textContent = sp.label;
      btn.title = sp.title;
      btn.onclick = () => this.cb.onSetSpeed(sp.s);
      speedBox.appendChild(btn);
    }

    leftGroup.append(clockBadge, speedBox);

    // Right cluster: coins + actions
    const rightGroup = this.el('div', 'hud-group hud-interactive');

    const coinBadge = this.el('div', 'coin-badge pixel-panel');
    coinBadge.innerHTML = `
      <span class="coin-dot">G</span><span>${state.coins.toLocaleString()} G</span>
      <div class="coin-tooltip pixel-card">
        <div style="font-weight:800;margin-bottom:4px;">💰 全局经济看板（档位 B）</div>
        <div>• 当天退回家具：<b>100% 原价退款</b></div>
        <div>• 跨天二手出售：<b>65% 折旧回收</b></div>
        <div>• 周日 20:00 账单预估：<b>${bill.total} G</b><br><span style="color:#6d4727;">（基础${bill.baseFee} + 面积${bill.gridFee} + 家电${bill.assetFee}）</span></div>
        <div>• 当前房间温馨度：<b>✨ +${comfort}</b></div>
      </div>
    `;

    const expandBtn = this.el('button', 'pixel-btn');
    expandBtn.textContent = '🧱 扩建';
    expandBtn.onclick = () => {
      this.showExpansionModal = true;
      this.renderExpansionModal(state);
    };

    const buildBtn = this.el('button', `pixel-btn${buildMode ? ' active' : ' gold'}`);
    buildBtn.textContent = buildMode ? '✅ 退出装修' : '🛋️ 装修模式';
    buildBtn.onclick = () => this.cb.onToggleBuildMode();

    const mapBtn = this.el('button', 'pixel-btn');
    mapBtn.textContent = '🗺️ 小岛';
    mapBtn.title = '查看 8 大首发地点小岛地图计划';
    mapBtn.onclick = () => this.cb.onShowIslandPreview();

    rightGroup.append(coinBadge, expandBtn, buildBtn, mapBtn);
    this.topBarEl.append(leftGroup, rightGroup);
  }

  private renderFloorSwitcher(state: GameSaveState): void {
    this.floorSwitcherEl.innerHTML = '';
    const f2Btn = this.el('button', `pixel-btn floor-btn${state.activeFloor === 2 ? ' active' : ''}`);
    f2Btn.textContent = state.floors[2].unlocked ? '2F' : '2F 🔒';
    f2Btn.title = state.floors[2].unlocked ? '切换到二楼' : `加盖二楼需 ${FLOOR_2_UNLOCK_COST} G`;
    f2Btn.onclick = () => {
      if (!state.floors[2].unlocked) {
        this.showExpansionModal = true;
        this.renderExpansionModal(state);
      } else {
        this.cb.onSelectFloor(2);
      }
    };

    const f1Btn = this.el('button', `pixel-btn floor-btn${state.activeFloor === 1 ? ' active' : ''}`);
    f1Btn.textContent = '1F';
    f1Btn.title = '切换到一楼';
    f1Btn.onclick = () => this.cb.onSelectFloor(1);

    this.floorSwitcherEl.append(f2Btn, f1Btn);
  }

  private renderScrollArrows(state: GameSaveState, cameraX: number, viewW: number): void {
    const floorW = getFloorWidthPx(state, state.activeFloor);
    const maxCam = Math.max(0, floorW - viewW);
    this.scrollLeftBtn.style.display = cameraX > 4 ? 'inline-flex' : 'none';
    this.scrollRightBtn.style.display = cameraX < maxCam - 4 ? 'inline-flex' : 'none';
  }

  private renderBottomInfo(state: GameSaveState, buildMode: boolean): void {
    if (buildMode) {
      this.bottomInfoEl.style.display = 'none';
      return;
    }
    this.bottomInfoEl.style.display = 'flex';
    const f = state.floors[state.activeFloor];
    const comfort = getTotalComfortScore(state);
    this.bottomInfoEl.innerHTML = `
      <div class="comfort-card pixel-card">
        <div class="comfort-row">🏠 ${f.level}F 室内空间 • ${f.gridCount} 格</div>
        <div class="comfort-row" style="color:#854d16;">✨ 房间温馨度 +${comfort}</div>
      </div>
      <div class="mini-hint">
        💡 拖动空白处/滚轮左右逛屋子 • 点击<b>灯具/窗帘</b>可开关 • 点右上角<b>🛋️ 装修模式</b>体验 2px 精细摆件
      </div>
    `;
  }

  private renderSelectionBar(
    state: GameSaveState,
    selected: PlacedItem | null,
    buildMode: boolean,
    activeToolLabel: string | null
  ): void {
    if (!buildMode || !selected || activeToolLabel) {
      this.selectionBarEl.style.display = 'none';
      return;
    }
    const def = CATALOG_MAP.get(selected.itemId);
    const meta = this.atlas.items[selected.itemId];
    if (!def || !meta) {
      this.selectionBarEl.style.display = 'none';
      return;
    }

    this.selectionBarEl.style.display = 'flex';
    this.selectionBarEl.innerHTML = '';

    const title = this.el('span', 'selection-title');
    title.textContent = `${def.name}`;
    this.selectionBarEl.appendChild(title);

    const moveBtn = this.el('button', 'pixel-btn');
    moveBtn.textContent = '✥ 移动';
    moveBtn.onclick = () => this.cb.onMoveSelected();
    this.selectionBarEl.appendChild(moveBtn);

    // Show variant swap if non-toggle item has >1 variants, or table lamp color groups
    const canSwapColor =
      selected.itemId === 'table_lamp_warm' ||
      (!meta.light && !meta.toggleState && meta.variants.length > 1);
    if (canSwapColor) {
      const varBtn = this.el('button', 'pixel-btn');
      const curName = meta.variants[selected.variant]?.name ?? '';
      varBtn.textContent = `🎨 换款(${curName.replace(/\(.*\)/, '')})`;
      varBtn.onclick = () => this.cb.onCycleVariantSelected();
      this.selectionBarEl.appendChild(varBtn);
    }

    if (meta.flippable) {
      const flipBtn = this.el('button', 'pixel-btn');
      flipBtn.textContent = '↔ 翻转';
      flipBtn.onclick = () => this.cb.onFlipSelected();
      this.selectionBarEl.appendChild(flipBtn);
    }

    const packBtn = this.el('button', 'pixel-btn');
    packBtn.textContent = '📦 收起';
    packBtn.onclick = () => this.cb.onPackSelected();
    this.selectionBarEl.appendChild(packBtn);

    const { refund, isSameDay } = getSellRefund(selected.purchasePrice, selected.boughtOnDay, state.day);
    const sellBtn = this.el('button', 'pixel-btn danger');
    sellBtn.textContent = `💰 出售 +${refund}G (${isSameDay ? '原价退' : '65%折旧'})`;
    sellBtn.onclick = () => this.cb.onSellSelected();
    this.selectionBarEl.appendChild(sellBtn);
  }

  private renderPlacementBanner(buildMode: boolean, activeToolLabel: string | null): void {
    if (!buildMode || !activeToolLabel) {
      this.placementBannerEl.style.display = 'none';
      return;
    }
    this.placementBannerEl.style.display = 'flex';
    this.placementBannerEl.innerHTML = '';
    const txt = this.el('span', '');
    txt.textContent = `🎯 正在操作：${activeToolLabel}（左键放置 / 右键或 Esc 取消）`;
    const cancelBtn = this.el('button', 'pixel-btn danger');
    cancelBtn.style.padding = '3px 8px';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => this.cb.onCancelTool();
    this.placementBannerEl.append(txt, cancelBtn);
  }

  private renderDrawer(
    state: GameSaveState,
    buildMode: boolean,
    placingItemId: string | null,
    paintStyleId: string | null
  ): void {
    if (!buildMode) {
      this.drawerEl.style.display = 'none';
      return;
    }
    const existingBody = this.drawerEl.querySelector('.drawer-body');
    if (existingBody) {
      this.drawerScrollLeft = existingBody.scrollLeft;
    }
    this.drawerEl.style.display = 'flex';
    this.drawerEl.innerHTML = '';

    const header = this.el('div', 'drawer-header');
    const tabsEl = this.el('div', 'drawer-tabs');

    const tabs: DrawerTab[] = [
      '全部',
      '厨房餐饮',
      '客厅休闲',
      '卧室书房',
      '卫浴萌宠',
      '墙饰灯具',
      '桌面摆件',
      '墙纸地板',
      '仓库',
      '经济测试',
    ];

    for (const tab of tabs) {
      const btn = this.el('button', `pixel-btn drawer-tab${this.activeTab === tab ? ' active' : ''}`);
      btn.textContent = tab === '仓库' ? `📦 仓库(${state.inventory.length})` : tab;
      btn.onclick = () => {
        this.activeTab = tab;
        this.renderDrawer(state, buildMode, placingItemId, paintStyleId);
      };
      tabsEl.appendChild(btn);
    }

    const hint = this.el('div', '');
    hint.style.fontSize = '12px';
    hint.style.color = '#f5d7a3';
    hint.textContent = '💡 桌面小摆件支持 2px 精细微距叠放；点击已放家具可换色/翻转/退货';

    header.append(tabsEl, hint);

    const body = this.el('div', 'drawer-body');
    if (this.activeTab === '墙纸地板') {
      this.fillPaintTab(body, paintStyleId);
    } else if (this.activeTab === '仓库') {
      this.fillInventoryTab(body, state);
    } else if (this.activeTab === '经济测试') {
      this.fillTestTab(body, state);
    } else {
      this.fillCatalogTab(body, state, placingItemId);
    }

    this.drawerEl.append(header, body);
    body.scrollLeft = this.drawerScrollLeft;
  }

  private getThumbnailDataUrl(itemId: string): string {
    if (this.thumbCache.has(itemId)) {
      return this.thumbCache.get(itemId)!;
    }
    const meta = this.atlas.items[itemId];
    const v = meta?.variants[0];
    if (!v) return '';
    const c = document.createElement('canvas');
    c.width = v.w;
    c.height = v.h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.atlasImg, v.x, v.y, v.w, v.h, 0, 0, v.w, v.h);
    const url = c.toDataURL();
    this.thumbCache.set(itemId, url);
    return url;
  }

  private fillCatalogTab(body: HTMLElement, state: GameSaveState, placingItemId: string | null): void {
    const items =
      this.activeTab === '全部'
        ? CATALOG_ITEMS
        : CATALOG_ITEMS.filter((i) => i.category === this.activeTab);

    for (const def of items) {
      const card = this.el(
        'div',
        `catalog-item pixel-card${placingItemId === def.id ? ' selected' : ''}`
      );
      card.title = def.description;
      const canAfford = state.coins >= def.price;

      const tier = this.el('span', 'item-tier-badge');
      tier.textContent = def.tier;

      const thumbWrap = this.el('div', 'item-thumb-wrap');
      const img = document.createElement('img');
      img.className = 'item-thumb-canvas';
      img.src = this.getThumbnailDataUrl(def.id);
      img.alt = def.name;
      // Scale pixel art crisply inside preview
      const meta = this.atlas.items[def.id];
      if (meta) {
        const scale = Math.min(62 / meta.w, 56 / meta.h);
        img.style.width = `${Math.max(16, Math.round(meta.w * scale))}px`;
        img.style.height = `${Math.max(16, Math.round(meta.h * scale))}px`;
      }
      thumbWrap.appendChild(img);

      const name = this.el('div', 'item-name');
      name.textContent = def.name;

      const metaRow = this.el('div', 'item-meta');
      metaRow.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px;color:${canAfford ? '#934f0b' : '#c63b2d'}"><span class="coin-dot sm">G</span>${def.price}</span><span>✨+${def.comfort}</span>`;

      card.append(tier, thumbWrap, name, metaRow);
      card.onclick = () => this.cb.onStartPlaceNew(def.id);
      body.appendChild(card);
    }
  }

  private fillPaintTab(body: HTMLElement, paintStyleId: string | null): void {
    for (const w of WALL_STYLES) {
      const card = this.el('div', `catalog-item pixel-card${paintStyleId === w.id ? ' selected' : ''}`);
      const tag = this.el('span', 'item-tier-badge');
      tag.textContent = '墙纸';
      const swatch = this.el('div', 'surface-swatch');
      swatch.style.background = `repeating-linear-gradient(90deg, ${w.baseColor}, ${w.baseColor} 8px, ${w.stripeColor} 8px, ${w.stripeColor} 14px)`;
      const name = this.el('div', 'item-name');
      name.textContent = w.name;
      const meta = this.el('div', 'item-meta');
      meta.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px;"><span class="coin-dot sm">G</span>${w.pricePerGrid}/格</span><span>墙面</span>`;
      card.append(tag, swatch, name, meta);
      card.onclick = () => this.cb.onStartPaint('wall', w.id);
      body.appendChild(card);
    }

    for (const f of FLOOR_STYLES) {
      const card = this.el('div', `catalog-item pixel-card${paintStyleId === f.id ? ' selected' : ''}`);
      const tag = this.el('span', 'item-tier-badge');
      tag.textContent = '地板';
      const swatch = this.el('div', 'surface-swatch');
      swatch.style.background = `repeating-linear-gradient(0deg, ${f.plankA}, ${f.plankA} 9px, ${f.plankB} 9px, ${f.plankB} 18px)`;
      const name = this.el('div', 'item-name');
      name.textContent = f.name;
      const meta = this.el('div', 'item-meta');
      meta.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px;"><span class="coin-dot sm">G</span>${f.pricePerGrid}/格</span><span>地面</span>`;
      card.append(tag, swatch, name, meta);
      card.onclick = () => this.cb.onStartPaint('floor', f.id);
      body.appendChild(card);
    }
  }

  private fillInventoryTab(body: HTMLElement, state: GameSaveState): void {
    if (state.inventory.length === 0) {
      const empty = this.el('div', '');
      empty.style.color = '#edd6ae';
      empty.style.fontSize = '13px';
      empty.textContent = '仓库空空如也。点击房间里的任意家具选择「📦 收起」，可免费存到这里备用或摆到二楼。';
      body.appendChild(empty);
      return;
    }

    for (const inv of state.inventory) {
      const def = CATALOG_MAP.get(inv.itemId);
      if (!def) continue;
      const card = this.el('div', 'catalog-item pixel-card');
      const tag = this.el('span', 'item-tier-badge');
      tag.textContent = '已有';
      const thumbWrap = this.el('div', 'item-thumb-wrap');
      const img = document.createElement('img');
      img.className = 'item-thumb-canvas';
      img.src = this.getThumbnailDataUrl(inv.itemId);
      thumbWrap.appendChild(img);
      const name = this.el('div', 'item-name');
      name.textContent = def.name;
      const meta = this.el('div', 'item-meta');
      meta.innerHTML = `<span style="color:#2e733b">免费放</span><span>✨+${def.comfort}</span>`;
      card.append(tag, thumbWrap, name, meta);
      card.onclick = () => this.cb.onStartPlaceFromInventory(inv.uid);
      body.appendChild(card);
    }
  }

  private fillTestTab(body: HTMLElement, state: GameSaveState): void {
    const info = this.el('div', 'pixel-card');
    info.style.padding = '12px 16px';
    info.style.display = 'flex';
    info.style.alignItems = 'center';
    info.style.gap = '10px';
    info.style.flexWrap = 'wrap';

    const btnStipend = this.el('button', 'pixel-btn gold');
    btnStipend.textContent = `💰 领取 Phase 1 装修测试津贴 (+${ECONOMY.testStipendAmount} G)`;
    btnStipend.onclick = () => this.cb.onGrantTestCoins();

    const btnSunset = this.el('button', 'pixel-btn');
    btnSunset.textContent = '🌇 跳至黄昏 (18:00 夜市开市)';
    btnSunset.onclick = () => this.cb.onJumpTime(18);

    const btnNight = this.el('button', 'pixel-btn');
    btnNight.textContent = '🌙 跳至夜晚 (21:00 看室内暖光)';
    btnNight.onclick = () => this.cb.onJumpTime(21);

    const btnMorning = this.el('button', 'pixel-btn');
    btnMorning.textContent = '☀️ 推进到次日清晨 (验证二手 65% 折旧)';
    btnMorning.onclick = () => this.cb.onJumpTime(9);

    const btnReset = this.el('button', 'pixel-btn danger');
    btnReset.textContent = `🔄 恢复初始小屋（当前第 ${state.day} 天）`;
    btnReset.onclick = () => this.cb.onResetSave();

    info.append(btnStipend, btnSunset, btnNight, btnMorning, btnReset);
    body.appendChild(info);
  }

  private renderExpansionModal(state: GameSaveState): void {
    if (!this.showExpansionModal) {
      this.modalEl.style.display = 'none';
      return;
    }
    this.modalEl.style.display = 'flex';
    this.modalEl.innerHTML = '';

    const box = this.el('div', 'modal-box pixel-panel');
    box.innerHTML = `
      <h3 class="modal-title">🧱 房屋扩建与加盖计划</h3>
      <div style="font-size:12px;color:#eed7af;line-height:1.5;">
        房屋面积越大、家电越多，每周日 20:00 的水电物业账单也会对应增长（当前存款：<b>${state.coins.toLocaleString()} G</b>）。
      </div>
    `;

    const list = this.el('div', 'modal-list');

    // 1F Expansion row
    const next1F = getNextExpansionForFloor(state, 1);
    const row1 = this.el('div', 'modal-row pixel-card');
    if (next1F) {
      row1.innerHTML = `<div><b>${next1F.label}</b><div style="font-size:11px;color:#6d4727;">向右砸墙延展更多客厅/宠物角/工作区</div></div>`;
      const btn = this.el('button', 'pixel-btn gold');
      btn.textContent = `${next1F.cost} G 扩建`;
      btn.disabled = state.coins < next1F.cost;
      btn.onclick = () => this.cb.onExpandFloor(1);
      row1.appendChild(btn);
    } else {
      row1.innerHTML = `<div><b>1F 已扩建至最大宽度 (${state.floors[1].gridCount} 格)</b></div>`;
    }
    list.appendChild(row1);

    // 2F Unlock or Expansion row
    const row2 = this.el('div', 'modal-row pixel-card');
    if (!state.floors[2].unlocked) {
      row2.innerHTML = `<div><b>加盖 2F 整层（含 22 格空间 + 楼梯接入）</b><div style="font-size:11px;color:#6d4727;">可在二楼布置独立主卧、婴儿房与海景书房</div></div>`;
      const btn2 = this.el('button', 'pixel-btn gold');
      btn2.textContent = `${FLOOR_2_UNLOCK_COST} G 加盖`;
      btn2.disabled = state.coins < FLOOR_2_UNLOCK_COST;
      btn2.onclick = () => this.cb.onUnlockFloor2();
      row2.appendChild(btn2);
    } else {
      const next2F = getNextExpansionForFloor(state, 2);
      if (next2F) {
        row2.innerHTML = `<div><b>${next2F.label}</b></div>`;
        const btn2 = this.el('button', 'pixel-btn gold');
        btn2.textContent = `${next2F.cost} G 扩建`;
        btn2.disabled = state.coins < next2F.cost;
        btn2.onclick = () => this.cb.onExpandFloor(2);
        row2.appendChild(btn2);
      } else {
        row2.innerHTML = `<div><b>2F 已扩建至最大宽度 (${state.floors[2].gridCount} 格)</b></div>`;
      }
    }
    list.appendChild(row2);

    const closeBtn = this.el('button', 'pixel-btn');
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => {
      this.showExpansionModal = false;
      this.renderExpansionModal(state);
    };

    box.append(list, closeBtn);
    this.modalEl.appendChild(box);
  }
}
