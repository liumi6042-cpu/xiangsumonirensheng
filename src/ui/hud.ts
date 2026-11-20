import { RESIDENT_DEFS, RESIDENT_DEF_MAP, type ResidentAction, type ResidentId, type ResidentOutfit, type ResidentState } from '../core/characters';
import type { GameClock } from '../core/clock';
import { getFloorWidthPx, getNextExpansionForFloor, getTotalAssetValue, getTotalComfortScore, getTotalUnlockedGrids, type GameSaveState, type PlacedItem } from '../core/roomState';
import { CATALOG_ITEMS, CATALOG_MAP, FLOOR_STYLES, WALL_STYLES, type AtlasJson, type CatalogCategory } from '../data/catalog';
import { ECONOMY, FLOOR_2_UNLOCK_COST, calculateWeeklyBill, getSellRefund } from '../data/economy';
import { iconSvg, type IconName } from './icons';

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
  onSetResidentOutfit: (id: ResidentId, outfit: ResidentOutfit) => void;
  onTriggerResidentAction: (id: ResidentId, action: ResidentAction) => void;
  onToggleResidentPresence: (id: ResidentId) => void;
  onMoveResidentFloor: (id: ResidentId, floor: 1 | 2) => void;
  onFocusResident: (id: ResidentId) => void;
  onClearSelectedResident: () => void;
  onSummonAllResidents: () => void;
  onWaveAllResidents: () => void;
}

interface HudUpdate {
  state: GameSaveState;
  clock: GameClock;
  buildMode: boolean;
  selectedItem: PlacedItem | null;
  selectedResident: ResidentState | null;
  activeToolLabel: string | null;
  placingItemId: string | null;
  paintStyleId: string | null;
  cameraX: number;
  viewW: number;
}
type Modal = 'island' | 'residents' | 'expansion';
const actionNames: Record<ResidentAction, string> = { idle: '发呆中', walk: '散步中', sit: '坐着休息', sleep: '熟睡中', wave: '招手中' };
const tabs: DrawerTab[] = ['全部', '厨房餐饮', '客厅休闲', '卧室书房', '卫浴萌宠', '墙饰灯具', '桌面摆件', '墙纸地板', '仓库', '经济测试'];
const spots: ReadonlyArray<readonly [string, IconName]> = [
  ['我的温馨小屋', 'home'], ['海风咖啡街区', 'cup'], ['晨光面包房', 'bread'], ['美发造型沙龙', 'scissors'],
  ['中央樱花公园', 'blossom'], ['手作杂货百货', 'store'], ['萌宠医院与商店', 'paw'], ['星光海滨夜市', 'moon'],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name: IconName, size = 18): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = iconSvg(name, size);
  return template.content.firstElementChild as HTMLElement;
}
function button(label: string, glyph: IconName | null, run: () => void, cls = '', title = label, labelClass = ''): HTMLButtonElement {
  const btn = el('button', `pixel-btn ${cls}`);
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  if (glyph) btn.append(icon(glyph, cls.includes('speed-btn') ? 14 : 17));
  if (label) btn.append(el('span', labelClass, label));
  btn.onclick = run;
  return btn;
}
function pressed(btn: HTMLButtonElement, on: boolean): void {
  btn.setAttribute('aria-pressed', String(on));
}
function marked(cls: string, glyph: IconName, text: string, size = 16): HTMLElement {
  const node = el('span', cls);
  node.append(icon(glyph, size), document.createTextNode(text));
  return node;
}
function money(amount: number): string { return `${amount.toLocaleString('zh-CN')} G`; }

export class GameHud {
  private current: HudUpdate | null = null;
  private activeTab: DrawerTab = '全部';
  private modal: Modal | null = null;
  private photoMode = false;
  private lastCoins: number | null = null;
  private clockKey = '';
  private drawerKey = '';
  private residentKey = '';
  private modalKey = '';
  private readonly thumbs = new Map<string, string>();
  private readonly top = el('div', 'top-hud');
  private readonly clockBadge = el('div', 'clock-badge pixel-panel');
  private readonly speeds = el('div', 'speed-group pixel-panel hud-interactive');
  private readonly coinBadge = el('div', 'coin-badge pixel-panel');
  private readonly balance = el('span');
  private readonly tooltip = el('div', 'coin-tooltip pixel-card');
  private readonly tools = el('div', 'hud-group hud-tools');
  private readonly residents = button('', 'residents', () => this.setResidentModalOpen(true), '', '居民名册');
  private readonly residentsLabel = el('span', 'compact-label');
  private readonly expand = button('扩建', 'expand', () => this.setExpansionModalOpen(true), '', '扩建', 'compact-label');
  private readonly decorate = button('', null, () => this.cb.onToggleBuildMode());
  private readonly island = button('小岛', 'map', () => this.openModal('island'), '', '小岛导览', 'compact-label');
  private readonly helpButton = button('', 'help', () => this.toggleHelp(), 'icon-only', '操作帮助');
  private readonly help = el('section', 'help-card pixel-card');
  private readonly exitPhoto = button('退出拍照预览', 'eyeOff', () => this.setPhotoMode(false), 'photo-exit');
  private readonly cameraButton = button('', 'camera', () => this.setPhotoMode(true), 'icon-only', '拍照预览');
  private readonly floorSwitch = el('div', 'floor-switcher pixel-panel hud-interactive');
  private readonly left = button('', 'arrowLeft', () => this.cb.onScrollBy(-240), 'scroll-arrow left hud-interactive', '向左浏览房间');
  private readonly right = button('', 'arrowRight', () => this.cb.onScrollBy(240), 'scroll-arrow right hud-interactive', '向右浏览房间');
  private readonly bottom = el('div', 'bottom-info-bar');
  private readonly residentBar = el('div', 'resident-action-bar pixel-panel hud-interactive');
  private readonly selection = el('div', 'selection-bar pixel-panel hud-interactive');
  private readonly placement = el('div', 'placement-banner pixel-panel hud-interactive');
  private readonly drawer = el('section', 'build-drawer');
  private readonly dialog = el('dialog', 'modal-box pixel-panel');

  constructor(
    private overlayRoot: HTMLElement,
    private drawerSlot: HTMLElement,
    modalSlot: HTMLElement,
    private toastStackEl: HTMLElement,
    private atlasImg: HTMLImageElement,
    private atlas: AtlasJson,
    private cb: HudCallbacks
  ) {
    const timeGroup = el('div', 'hud-group');
    const speedIcons: readonly IconName[] = ['pause', 'play', 'fast', 'turbo'];
    for (const speed of [0, 1, 2, 3] as const) {
      this.speeds.append(button(speed ? `${speed}x` : '', speedIcons[speed], () => this.cb.onSetSpeed(speed), 'speed-btn', speed ? `${speed} 倍时间流速` : '暂停时间与人物行动'));
    }
    timeGroup.append(this.clockBadge, this.speeds);
    this.coinBadge.tabIndex = 0;
    this.tooltip.id = 'house-ledger';
    this.tooltip.setAttribute('role', 'tooltip');
    this.coinBadge.setAttribute('aria-describedby', this.tooltip.id);
    this.coinBadge.append(icon('coin'), this.balance, this.tooltip);
    this.residents.append(this.residentsLabel);
    this.tools.append(this.coinBadge, this.residents, this.expand, this.decorate, this.island, this.cameraButton, this.helpButton);
    this.help.id = 'house-controls';
    this.helpButton.setAttribute('aria-controls', this.help.id);
    this.helpButton.setAttribute('aria-expanded', 'false');
    const helpHeading = el('header');
    helpHeading.append(el('h2', '', '小屋操作'), button('', 'close', () => this.toggleHelp(false), 'icon-only', '收起帮助'));
    this.help.append(helpHeading, el('p', '', '拖动空白处浏览房间，或用 A、D 和左右方向键移动。'), el('p', '', '点选居民可招手、换装。把居民或宠物拖到椅子、沙发或床上即可休息。'), el('p', '', '点灯具或窗帘可开关。装修时点选家具可移动、换款、收起或出售。'));
    this.top.append(timeGroup, this.tools, this.help);
    this.dialog.setAttribute('aria-labelledby', 'house-dialog-title');
    this.dialog.oncancel = event => { event.preventDefault(); this.closeModal(); };
    this.dialog.onclick = event => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.closeModal();
    };
    this.dialog.onkeydown = event => event.stopPropagation();
    for (const node of [this.help, this.exitPhoto, this.drawer, this.selection, this.residentBar, this.placement]) node.hidden = true;
    this.overlayRoot.replaceChildren(this.top, this.floorSwitch, this.left, this.right, this.bottom, this.residentBar, this.selection, this.placement, this.exitPhoto);
    this.drawerSlot.replaceChildren(this.drawer);
    modalSlot.replaceChildren(this.dialog);
  }

  public setExpansionModalOpen(open: boolean): void {
    if (open) this.openModal('expansion');
    else if (this.modal === 'expansion') this.closeModal();
  }
  public setResidentModalOpen(open: boolean): void {
    if (open) this.openModal('residents');
    else if (this.modal === 'residents') this.closeModal();
  }
  private toggleHelp(open = this.help.hidden): void {
    this.help.hidden = !open;
    this.helpButton.setAttribute('aria-expanded', String(open));
    if (!open && this.help.contains(document.activeElement)) this.helpButton.focus();
  }
  private setPhotoMode(on: boolean): void {
    this.photoMode = on;
    this.toggleHelp(false);
    this.closeModal();
    this.overlayRoot.classList.toggle('photo-mode', on);
    this.exitPhoto.hidden = !on;
    this.drawerSlot.hidden = on;
    this.toastStackEl.hidden = on;
    (on ? this.exitPhoto : this.cameraButton).focus({ preventScroll: true });
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  public pushToast(message: string, tone: 'normal' | 'good' | 'warn' = 'normal'): void {
    if (this.photoMode) return;
    const toast = el('div', `toast-msg pixel-card ${tone}`, message);
    this.toastStackEl.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }
  public spawnCoinDelta(delta: number): void {
    if (!delta || this.photoMode) return;
    const rect = this.coinBadge.getBoundingClientRect();
    const badge = el('div', 'float-delta pixel-card', `${delta > 0 ? '+' : ''}${money(delta)}`);
    badge.style.left = `${rect.left}px`;
    badge.style.top = `${rect.bottom + 7}px`;
    this.overlayRoot.append(badge);
    window.setTimeout(() => badge.remove(), 1100);
  }
  public tickClockDisplay(clock: GameClock): void {
    const { periodLabel, weatherIcon } = clock.getSkyPalette();
    const key = `${clock.day}/${clock.formattedTime}/${periodLabel}/${clock.isNightMarketOpen}`;
    if (key === this.clockKey) return;
    this.clockKey = key;
    let glyph: IconName = 'sun';
    if (/夜|星|月/.test(periodLabel) || /🌙|🌃/.test(weatherIcon)) glyph = 'moon';
    else if (/黄昏|晚霞|夕|落日/.test(periodLabel) || weatherIcon === '🌇') glyph = 'sunset';
    else if (/晨|黎明|日出/.test(periodLabel) || weatherIcon === '🌅') glyph = 'sunrise';
    const sticker = el('span', 'sky-sticker');
    sticker.append(icon(glyph, 21));
    const date = el('span', 'clock-date');
    date.append(el('b', '', `DAY ${clock.day}`), el('small', '', clock.weekdayName));
    const period = el('span', 'period');
    period.append(el('span', '', periodLabel));
    this.clockBadge.title = clock.isNightMarketOpen ? `${periodLabel} · 夜市开市中` : periodLabel;
    this.clockBadge.replaceChildren(sticker, date, el('time', 'clock-time', clock.formattedTime), period);
  }
  public updateScrollArrowsOnly(state: GameSaveState, cameraX: number, viewW: number): void {
    this.left.hidden = cameraX <= 4;
    this.right.hidden = cameraX >= getFloorWidthPx(state, state.activeFloor) - viewW - 4;
  }
  public update(params: HudUpdate): void {
    const { state, clock, buildMode } = params;
    this.current = params;
    if (this.lastCoins !== null) this.spawnCoinDelta(state.coins - this.lastCoins);
    this.lastCoins = state.coins;
    this.tickClockDisplay(clock);
    Array.from(this.speeds.children).forEach((btn, speed) => pressed(btn as HTMLButtonElement, speed === clock.speed));
    this.renderLedger(state);
    const count = state.residents.filter(r => r.present).length;
    this.residentsLabel.textContent = `居民(${count})`;
    this.residents.setAttribute('aria-label', `居民名册，${count} 位在家`);
    const label = buildMode ? '完成装修' : '装修住宅';
    this.decorate.replaceChildren(icon(buildMode ? 'check' : 'decorate', 17), el('span', 'compact-label', label));
    this.decorate.title = label;
    this.decorate.setAttribute('aria-label', label);
    this.decorate.classList.toggle('gold', !buildMode);
    pressed(this.decorate, buildMode);
    this.renderFloors(state);
    this.updateScrollArrowsOnly(state, params.cameraX, params.viewW);
    this.bottom.hidden = buildMode;
    if (!buildMode) {
      const sticker = el('div', 'comfort-card pixel-card');
      sticker.title = '当前楼层面积与小屋温馨度';
      sticker.append(marked('comfort-row', 'home', `${state.activeFloor}F • ${state.floors[state.activeFloor].gridCount}格`, 13), marked('comfort-row', 'sparkle', `+${getTotalComfortScore(state)}`, 13));
      this.bottom.replaceChildren(sticker);
    }
    this.renderResidentBar(params);
    this.renderItemTools(params);
    this.renderDrawer(params);
    this.renderModal();
  }
  private renderLedger(state: GameSaveState): void {
    this.balance.textContent = money(state.coins);
    this.coinBadge.setAttribute('aria-label', `小屋账本，余额 ${this.balance.textContent}`);
    const bill = calculateWeeklyBill(getTotalUnlockedGrids(state), getTotalAssetValue(state));
    const lines = [['当天退货', '原价退回'], ['跨天出售', '原价的 65%'], ['周日 20:00 预计账单', money(bill.total)], ['小屋温馨度', `+${getTotalComfortScore(state)}`]];
    this.tooltip.replaceChildren(el('strong', '', '小屋账本'));
    for (const [label, value] of lines) {
      const line = el('div', 'ledger-line');
      line.append(el('span', '', label), el('b', '', value));
      this.tooltip.append(line);
    }
    this.tooltip.append(el('small', 'ledger-note', `基础 ${bill.baseFee} + 面积 ${bill.gridFee} + 家电 ${bill.assetFee} G`));
  }
  private renderFloors(state: GameSaveState): void {
    this.floorSwitch.replaceChildren();
    for (const floor of [2, 1] as const) {
      const unlocked = state.floors[floor].unlocked;
      const btn = button(`${floor}F`, floor === 2 ? 'stairs' : 'floor', () => {
        if (unlocked) this.cb.onSelectFloor(floor);
        else this.setExpansionModalOpen(true);
      }, 'floor-btn', unlocked ? `切换至 ${floor}F` : `加盖二楼需 ${money(FLOOR_2_UNLOCK_COST)}`);
      pressed(btn, state.activeFloor === floor);
      this.floorSwitch.append(btn);
    }
  }
  private renderResidentBar({ state, selectedResident: resident, buildMode }: HudUpdate): void {
    const def = resident && RESIDENT_DEF_MAP.get(resident.id);
    this.residentBar.hidden = buildMode || !resident?.present || !def;
    if (this.residentBar.hidden || !resident || !def) { this.residentKey = ''; return; }
    const key = [resident.id, resident.action, resident.outfit, resident.floor, state.floors[2].unlocked].join('/');
    if (this.residentKey === key) return;
    this.residentKey = key;
    this.residentBar.replaceChildren(marked('selection-title', def.isPet ? 'paw' : 'residents', `${def.name} · ${actionNames[resident.action]}`));
    const actions: ReadonlyArray<readonly [ResidentAction, IconName, string]> = [['wave', 'wave', '招手'], ['walk', 'walk', '散步'], ['sit', 'chair', '找座'], ['sleep', 'sleep', '睡觉']];
    for (const [action, glyph, label] of actions) {
      const btn = button(label, glyph, () => this.cb.onTriggerResidentAction(resident.id, action), '', label, 'action-word');
      pressed(btn, action === resident.action);
      this.residentBar.append(btn);
    }
    if (def.outfits.length > 1) {
      const picker = el('select', 'outfit-picker');
      picker.setAttribute('aria-label', `给${def.name}换装`);
      for (const outfit of def.outfits) picker.add(new Option(outfit.label, outfit.id, false, outfit.id === resident.outfit));
      picker.onchange = () => {
        const outfit = def.outfits.find(o => o.id === picker.value);
        if (outfit) this.cb.onSetResidentOutfit(resident.id, outfit.id);
      };
      this.residentBar.append(picker);
    }
    if (state.floors[2].unlocked) {
      const target = resident.floor === 1 ? 2 : 1;
      this.residentBar.append(button(`${target}F`, 'stairs', () => this.cb.onMoveResidentFloor(resident.id, target), '', `送去 ${target}F`));
    }
    this.residentBar.append(button('', 'close', () => this.cb.onClearSelectedResident(), '', '取消选中居民'));
  }
  private renderItemTools({ state, selectedItem: item, buildMode, activeToolLabel }: HudUpdate): void {
    this.selection.hidden = true;
    this.placement.hidden = !buildMode || !activeToolLabel;
    if (!this.placement.hidden && activeToolLabel) {
      this.placement.replaceChildren(marked('selection-title', 'wrench', activeToolLabel), button('取消', 'close', () => this.cb.onCancelTool(), 'danger', '取消工具（Esc）'));
      return;
    }
    if (!buildMode || !item) return;
    const def = CATALOG_MAP.get(item.itemId);
    const meta = this.atlas.items[item.itemId];
    if (!def || !meta) return;
    this.selection.hidden = false;
    this.selection.replaceChildren(el('b', 'selection-title', def.name), button('移动', 'move', () => this.cb.onMoveSelected()));
    if (item.itemId === 'table_lamp_warm' || (!meta.light && !meta.toggleState && meta.variants.length > 1)) {
      this.selection.append(button('换款', 'palette', () => this.cb.onCycleVariantSelected(), '', `换款 · ${meta.variants[item.variant]?.name ?? def.name}`));
    }
    if (meta.flippable) this.selection.append(button('翻转', 'flip', () => this.cb.onFlipSelected()));
    const { refund, isSameDay } = getSellRefund(item.purchasePrice, item.boughtOnDay, state.day);
    this.selection.append(button('收起', 'box', () => this.cb.onPackSelected()), button(`出售 +${money(refund)}`, 'sell', () => this.cb.onSellSelected(), 'danger', isSameDay ? '当天按原价退回' : '跨天按原价的 65% 回收'));
  }
  private thumbnail(id: string, character = false, variant = 0): string {
    const key = `${character ? 'resident' : 'item'}/${id}/${variant}`;
    const cached = this.thumbs.get(key);
    if (cached) return cached;
    const variants = this.atlas.items[id]?.variants;
    const rect = character ? this.atlas.characters?.[id] : variants?.[variant] ?? variants?.[0];
    if (!rect) return '';
    const canvas = el('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const url = canvas.toDataURL();
    this.thumbs.set(key, url);
    return url;
  }
  private itemImage(id: string, variant = 0): HTMLElement {
    const wrap = el('span', 'item-thumb-wrap');
    const img = el('img', 'item-thumb-canvas');
    img.alt = '';
    img.draggable = false;
    const src = this.thumbnail(id, false, variant);
    if (src) img.src = src;
    wrap.append(img);
    return wrap;
  }
  private craftCard(name: string, badge: string, preview: HTMLElement, cost: HTMLElement, detail: HTMLElement, run: () => void, selected = false): HTMLButtonElement {
    const card = el('button', `catalog-item pixel-card${selected ? ' selected' : ''}`);
    card.type = 'button';
    const tag = el('span', 'item-tier-badge', badge);
    tag.dataset.tier = badge;
    const meta = el('span', 'item-meta');
    meta.append(cost, detail);
    card.append(tag, preview, el('b', 'item-name', name), meta);
    card.onclick = run;
    return card;
  }
  private renderDrawer(params: HudUpdate, tabChanged = false): void {
    const { state, buildMode, placingItemId, paintStyleId } = params;
    this.drawer.hidden = !buildMode;
    if (!buildMode) return;
    const stockKey = this.activeTab === '仓库' ? state.inventory.map(i => `${i.uid}:${i.itemId}:${i.variant}`).join(',') : state.inventory.length;
    const key = [this.activeTab, state.coins, state.day, stockKey, placingItemId, paintStyleId].join('/');
    if (key === this.drawerKey) return;
    this.drawerKey = key;
    const bodyOffset = tabChanged ? 0 : this.drawer.querySelector('.drawer-body')?.scrollLeft ?? 0;
    const tabsOffset = this.drawer.querySelector('.drawer-tabs')?.scrollLeft ?? 0;
    const header = el('div', 'drawer-header');
    const nav = el('div', 'drawer-tabs');
    for (const tab of tabs) {
      const label = tab === '仓库' ? `仓库(${state.inventory.length})` : tab;
      const glyph = tab === '仓库' ? 'box' : tab === '墙纸地板' ? 'paint' : tab === '经济测试' ? 'wrench' : null;
      const btn = button(label, glyph, () => {
        this.activeTab = tab;
        if (this.current) this.renderDrawer(this.current, true);
      }, 'drawer-tab');
      pressed(btn, this.activeTab === tab);
      nav.append(btn);
    }
    header.append(nav);
    const body = el('div', 'drawer-body');
    if (this.activeTab === '经济测试') {
      const controls = el('div', 'test-controls pixel-card');
      controls.append(button(`装修津贴 +${money(ECONOMY.testStipendAmount)}`, 'coin', () => this.cb.onGrantTestCoins(), 'gold'), button('黄昏 18:00', 'sunset', () => this.cb.onJumpTime(18)), button('夜晚 21:00', 'moon', () => this.cb.onJumpTime(21)), button('清晨 09:00', 'sunrise', () => this.cb.onJumpTime(9)), button(`恢复初始小屋 · 第 ${state.day} 天`, 'home', () => this.cb.onResetSave(), 'danger'));
      body.append(controls);
    } else if (this.activeTab === '墙纸地板') {
      for (const kind of ['wall', 'floor'] as const) {
        const styles = kind === 'wall' ? WALL_STYLES : FLOOR_STYLES;
        for (const style of styles) {
          const swatch = el('span', 'surface-swatch');
          swatch.style.backgroundImage = `url('${style.textureUrl}')`;
          swatch.style.backgroundColor = 'baseColor' in style ? style.baseColor : style.plankA;
          const label = kind === 'wall' ? '墙纸' : '地板';
          body.append(this.craftCard(style.name, label, swatch, marked('', 'coin', `${style.pricePerGrid}/格`, 13), el('span', '', label), () => this.cb.onStartPaint(kind, style.id), paintStyleId === style.id));
        }
      }
    } else if (this.activeTab === '仓库') {
      if (!state.inventory.length) body.append(el('p', 'drawer-empty', '仓库空着呢。在房间里选中家具，点「收起」就能存到这里。'));
      for (const item of state.inventory) {
        const def = CATALOG_MAP.get(item.itemId);
        if (def) body.append(this.craftCard(def.name, '已有', this.itemImage(item.itemId, item.variant), el('span', '', '免费放置'), marked('', 'sparkle', `+${def.comfort}`, 13), () => this.cb.onStartPlaceFromInventory(item.uid)));
      }
    } else {
      for (const def of CATALOG_ITEMS) {
        if (this.activeTab !== '全部' && this.activeTab !== def.category) continue;
        const price = marked(state.coins < def.price ? 'short-funds' : '', 'coin', String(def.price), 13);
        const card = this.craftCard(def.name, def.tier, this.itemImage(def.id), price, marked('', 'sparkle', `+${def.comfort}`, 13), () => this.cb.onStartPlaceNew(def.id), placingItemId === def.id);
        card.title = def.description;
        body.append(card);
      }
    }
    this.drawer.replaceChildren(header, body);
    nav.scrollLeft = tabsOffset;
    body.scrollLeft = bodyOffset;
  }
  private openModal(modal: Modal): void {
    if (this.photoMode) return;
    this.toggleHelp(false);
    this.modal = modal;
    this.renderModal();
  }
  private closeModal(): void {
    this.modal = null;
    this.modalKey = '';
    if (this.dialog.open) this.dialog.close();
    this.residents.classList.remove('active');
    this.expand.classList.remove('active');
    this.island.classList.remove('active');
  }
  private renderModal(): void {
    if (!this.modal || !this.current || this.photoMode) return;
    const state = this.current.state;
    let key: string = this.modal;
    if (this.modal === 'residents') key += `${state.activeFloor}/${state.residents.map(r => [r.id, r.present, r.floor, r.action].join(':')).join('/')}`;
    if (this.modal === 'expansion') key += [state.coins, state.floors[1].gridCount, state.floors[2].unlocked, state.floors[2].gridCount, getTotalAssetValue(state)].join('/');
    if (key === this.modalKey && this.dialog.open) return;
    this.modalKey = key;
    this.residents.classList.toggle('active', this.modal === 'residents');
    this.expand.classList.toggle('active', this.modal === 'expansion');
    this.island.classList.toggle('active', this.modal === 'island');
    const scroll = this.dialog.open ? this.dialog.scrollTop : 0;
    const focused = this.dialog.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focusKey : undefined;
    const content = el('div', 'modal-content');
    const heading = el('header', 'modal-heading');
    const title = el('h2', 'modal-title');
    title.id = 'house-dialog-title';
    const glyph = this.modal === 'island' ? 'map' : this.modal === 'residents' ? 'residents' : 'expand';
    const sticker = el('span', 'chapter-icon');
    sticker.append(icon(glyph, 23));
    title.append(sticker, document.createTextNode(this.modal === 'island' ? '小岛导览' : this.modal === 'residents' ? '居民与宠物名册' : '小屋扩建图纸'));
    const close = button('', 'close', () => this.closeModal(), 'icon-only', '关闭弹窗');
    close.dataset.focusKey = 'close';
    heading.append(title, close);
    content.append(heading);
    if (this.modal === 'island') this.fillIsland(content);
    if (this.modal === 'residents') this.fillRoster(content, state);
    if (this.modal === 'expansion') this.fillExpansion(content, state);
    this.dialog.replaceChildren(content);
    if (!this.dialog.open) this.dialog.showModal();
    else if (focused) {
      const target = Array.from(content.querySelectorAll<HTMLButtonElement>('button')).find(btn => btn.dataset.focusKey === focused && !btn.disabled);
      (target ?? close).focus({ preventScroll: true });
    }
    this.dialog.scrollTop = scroll;
  }
  private fillIsland(content: HTMLElement): void {
    const frame = el('figure', 'map-print');
    const image = el('img');
    image.src = './assets/backdrops/backdrop_street_town_day.png';
    image.alt = '阳光下的小岛街区全景';
    frame.append(image);
    const grid = el('div', 'spot-grid');
    for (const [name, glyph] of spots) {
      const current = glyph === 'home';
      const card = el('div', `spot${current ? ' current' : ''}`);
      const stamp = el('span', 'spot-icon');
      stamp.append(icon(glyph, 21));
      card.append(stamp, el('b', '', name), el('span', 'spot-status', current ? '已入住' : '敬请期待'));
      grid.append(card);
    }
    content.append(frame, grid);
  }
  private fillRoster(content: HTMLElement, state: GameSaveState): void {
    const group = el('div', 'group-actions');
    const summon = button(`全员集合到 ${state.activeFloor}F`, 'home', () => { this.closeModal(); this.cb.onSummonAllResidents(); }, 'gold');
    const wave = button('全员开心招手', 'wave', () => { this.closeModal(); this.cb.onWaveAllResidents(); });
    summon.dataset.focusKey = 'summon';
    wave.dataset.focusKey = 'wave';
    group.append(summon, wave);
    const grid = el('div', 'roster-grid');
    for (const def of RESIDENT_DEFS) {
      const resident = state.residents.find(r => r.id === def.id);
      if (!resident) continue;
      const card = el('article', 'roster-card pixel-card');
      const avatar = el('img', 'roster-avatar');
      avatar.alt = def.name;
      const src = this.thumbnail(def.defaultSprite, true);
      if (src) avatar.src = src;
      const info = el('div');
      const line = el('div', 'role-line');
      line.append(el('b', '', def.name), el('span', 'role-badge', def.role));
      const status = resident.present ? `${resident.floor}F · ${actionNames[resident.action]}` : '尚未进屋';
      const buttons = el('div', 'roster-buttons');
      const toggle = button(resident.present ? '暂离' : '请进屋', resident.present ? null : 'home', () => this.cb.onToggleResidentPresence(def.id), resident.present ? '' : 'gold');
      toggle.dataset.focusKey = `invite-${def.id}`;
      buttons.append(toggle);
      if (resident.present) {
        const locate = button('找ta', def.isPet ? 'paw' : 'residents', () => { this.closeModal(); this.cb.onFocusResident(def.id); });
        locate.dataset.focusKey = `locate-${def.id}`;
        buttons.append(locate);
      }
      info.append(line, el('p', 'resident-status', status), buttons);
      card.append(avatar, info);
      grid.append(card);
    }
    content.append(group, grid);
  }
  private maxGrids(state: GameSaveState, level: 1 | 2): number {
    const floor = state.floors[level];
    if ('maxGrids' in floor && typeof floor.maxGrids === 'number' && floor.maxGrids > 0) return floor.maxGrids;
    const probeFloor = { ...floor, unlocked: true };
    const probe = { ...state, floors: { ...state.floors, [level]: probeFloor } };
    let step = getNextExpansionForFloor(probe, level);
    while (step && step.targetGrids > probeFloor.gridCount) {
      probeFloor.gridCount = step.targetGrids;
      step = getNextExpansionForFloor(probe, level);
    }
    return probeFloor.gridCount;
  }
  private fillExpansion(content: HTMLElement, state: GameSaveState): void {
    const list = el('div', 'blueprint');
    for (const level of [1, 2] as const) {
      const floor = state.floors[level];
      const locked = !floor.unlocked;
      const count = locked ? 0 : floor.gridCount;
      const max = this.maxGrids(state, level);
      const next = getNextExpansionForFloor(state, level);
      const plan = el('article', 'floor-plan pixel-card');
      const heading = el('div', 'floor-heading');
      heading.append(el('strong', '', `${level}F · ${locked ? '待加盖' : '已入住'}`), el('b', '', `${count} / ${max} 格`));
      const progress = el('progress');
      progress.max = Math.max(1, max);
      progress.value = count;
      progress.setAttribute('aria-label', `${level}F 已开放面积`);
      const detail = el('div', 'floor-detail');
      detail.append(el('span', '', locked ? `加盖后开放 ${floor.gridCount} 格，连通木楼梯` : next?.label ?? '本层已达最大面积'));
      if (locked || next) {
        const cost = locked ? FLOOR_2_UNLOCK_COST : next!.cost;
        const purchase = button(`${locked ? '加盖' : '扩建'} ${money(cost)}`, 'coin', () => {
          if (locked) this.cb.onUnlockFloor2();
          else this.cb.onExpandFloor(level);
        }, 'gold');
        purchase.dataset.focusKey = `expand-${level}`;
        purchase.disabled = state.coins < cost;
        if (purchase.disabled) purchase.title = `还差 ${money(cost - state.coins)}`;
        detail.append(purchase);
      }
      plan.append(heading, progress, detail);
      list.append(plan);
    }
    const bill = calculateWeeklyBill(getTotalUnlockedGrids(state), getTotalAssetValue(state));
    content.append(list, marked('blueprint-note', 'coin', `存款 ${money(state.coins)}。周日 20:00 结算水电物业费，目前预计 ${money(bill.total)}，随面积和家电价值调整。`));
  }
}