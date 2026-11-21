import { CATALOG_ITEMS, type AtlasJson } from '../data/catalog';
import { CAREER_WAGE_TABLE, ECONOMY } from '../data/economy';
import type { GameSaveState } from './roomState';

export type SceneMode = 'map' | 'home' | 'street' | 'market' | 'venue';
export type VenueId = 'cafe' | 'bakery' | 'salon' | 'pet';
export type StreetSpotId = 'cafe' | 'salon' | 'bakery' | 'park' | 'home' | 'market';
export type MarketWareId = 'coffee' | 'pastry' | 'craft';
export type WorldMapLandmarkId = 'home' | 'salon' | 'bakery' | 'store' | 'park' | 'cafe' | 'pet' | 'market';

export const WORLD_MAP_SIZE = { w: 1380, h: 920 } as const;

export interface WorldMapLandmark {
  id: WorldMapLandmarkId;
  name: string;
  tag: string;
  actionHint: string;
  nx: number;
  ny: number;
  nw: number;
  nh: number;
  pinX: number;
  pinY: number;
  accentColor: string;
  targetScene: Exclude<SceneMode, 'map'>;
  targetSpot?: Exclude<StreetSpotId, 'home' | 'market'>;
  targetVenue?: VenueId;
}

export const WORLD_MAP_LANDMARKS: WorldMapLandmark[] = [
  {
    id: 'home',
    name: '我的温馨小屋',
    tag: '回家装修',
    actionHint: '点击进入 2 层住宅室内，自由装修并陪伴居民生活',
    nx: 0.03,
    ny: 0.13,
    nw: 0.21,
    nh: 0.31,
    pinX: 0.14,
    pinY: 0.435,
    accentColor: '#E57A63',
    targetScene: 'home',
  },
  {
    id: 'salon',
    name: '美发造型沙龙',
    tag: '进店体验',
    actionHint: '走进糖心造型沙龙室内：造型兼职、当场试穿新造型或抽扭蛋',
    nx: 0.02,
    ny: 0.58,
    nw: 0.20,
    nh: 0.29,
    pinX: 0.125,
    pinY: 0.855,
    accentColor: '#75A5CE',
    targetScene: 'venue',
    targetVenue: 'salon',
  },
  {
    id: 'bakery',
    name: '晨光面包房',
    tag: '进店烘焙',
    actionHint: '走进可颂烘焙坊室内：烘焙打工或现买热乎酥脆黄油可颂',
    nx: 0.26,
    ny: 0.14,
    nw: 0.18,
    nh: 0.25,
    pinX: 0.35,
    pinY: 0.40,
    accentColor: '#DF9F42',
    targetScene: 'venue',
    targetVenue: 'bakery',
  },
  {
    id: 'store',
    name: '手作杂货百货',
    tag: '180G扭蛋',
    actionHint: '走进手作扭蛋百货室内，-180G 抽取精选 T1/T2 家具直接进仓库',
    nx: 0.25,
    ny: 0.60,
    nw: 0.20,
    nh: 0.27,
    pinX: 0.355,
    pinY: 0.86,
    accentColor: '#699F78',
    targetScene: 'venue',
    targetVenue: 'salon',
  },
  {
    id: 'park',
    name: '中央樱花公园',
    tag: '免费小憩',
    actionHint: '在街心花园长椅晒太阳看锦鲤（免费 +14⚡ / +20😊）',
    nx: 0.38,
    ny: 0.37,
    nw: 0.28,
    nh: 0.27,
    pinX: 0.505,
    pinY: 0.61,
    accentColor: '#DA7B9B',
    targetScene: 'street',
    targetSpot: 'park',
  },
  {
    id: 'cafe',
    name: '海风咖啡街区',
    tag: '进店咖啡',
    actionHint: '走进海风玻璃花房咖啡馆室内：咖啡师兼职或点现磨拿铁甜点',
    nx: 0.56,
    ny: 0.14,
    nw: 0.28,
    nh: 0.27,
    pinX: 0.705,
    pinY: 0.40,
    accentColor: '#5B9A77',
    targetScene: 'venue',
    targetVenue: 'cafe',
  },
  {
    id: 'pet',
    name: '萌宠护理小屋',
    tag: '进店撸狗',
    actionHint: '走进萌宠洗护小屋室内：陪豆包洗香香泡泡浴或兼职宠物美容师',
    nx: 0.52,
    ny: 0.60,
    nw: 0.28,
    nh: 0.29,
    pinX: 0.66,
    pinY: 0.88,
    accentColor: '#C9894C',
    targetScene: 'venue',
    targetVenue: 'pet',
  },
  {
    id: 'market',
    name: '星光海滨夜市',
    tag: '夜摊出单',
    actionHint: '18:00–02:00 前往海岸码头摆摊售卖手作好物，每日限 10 单',
    nx: 0.72,
    ny: 0.39,
    nw: 0.27,
    nh: 0.38,
    pinX: 0.84,
    pinY: 0.67,
    accentColor: '#7C6EB5',
    targetScene: 'market',
  },
];

export interface StreetHotspot {
  id: Exclude<StreetSpotId, 'home' | 'market'>;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  standX: number;
  jobTitle: string;
  treatTitle: string;
}

export const STREET_HOTSPOTS: StreetHotspot[] = [
  {
    id: 'cafe',
    name: '海风咖啡馆',
    subtitle: '现磨拿铁与兼职吧台',
    x: 56,
    y: 138,
    w: 274,
    h: 294,
    standX: 195,
    jobTitle: '咖啡师兼职 (2h · +160~320G)',
    treatTitle: '海风拿铁 (-18G · +18精力/+22心情)',
  },
  {
    id: 'salon',
    name: '糖心沙龙 & 扭蛋屋',
    subtitle: '造型助手 & 街区盲盒扭蛋',
    x: 365,
    y: 165,
    w: 240,
    h: 266,
    standX: 485,
    jobTitle: '造型助理 (2h · +160~320G)',
    treatTitle: '惊喜扭蛋 (-180G · 抽家具进仓库)',
  },
  {
    id: 'bakery',
    name: '晨光可颂烘焙坊',
    subtitle: '刚出炉酥脆可颂与甜点',
    x: 658,
    y: 150,
    w: 262,
    h: 282,
    standX: 785,
    jobTitle: '烘焙帮工 (2h · +160~320G)',
    treatTitle: '黄油可颂 (-12G · +26精力/+16心情)',
  },
];

export interface MarketWareDef {
  id: MarketWareId;
  name: string;
  spriteItemId: string;
  baseCost: number;
  desc: string;
}

export const MARKET_WARES: MarketWareDef[] = [
  { id: 'coffee', name: '冰手冲咖啡', spriteItemId: 'coffee_mug_steaming', baseCost: 14, desc: '微利爆款，客流最快' },
  { id: 'pastry', name: '草莓奶油点心', spriteItemId: 'strawberry_cake', baseCost: 22, desc: '口碑甜品，高倍率小费' },
  { id: 'craft', name: '手作手办盲盒', spriteItemId: 'chibi_figurine_trio', baseCost: 34, desc: '文艺珍藏，单笔最高盈利' },
];

export interface OutdoorActor {
  spritePrefix: string;
  staticSprite: string;
  hasWalkFrames: boolean;
  name: string;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  facing: 'left' | 'right';
  walkPhase: number;
  speed: number;
  pauseTimer: number;
  seated?: boolean;
  emoteText?: string;
  emoteTimer: number;
}

export interface CareerTierInfo {
  level: number;
  title: string;
  multiplier: number;
  nextXp: number | null;
}

export function getCareerTier(xp: number): CareerTierInfo {
  if (xp < 60) return { level: 1, title: '见习小透明', multiplier: 1.0, nextXp: 60 };
  if (xp < 160) return { level: 2, title: '街区热心帮手', multiplier: 1.15, nextXp: 160 };
  if (xp < 320) return { level: 3, title: '手作设计达人', multiplier: 1.32, nextXp: 320 };
  if (xp < 540) return { level: 4, title: '小岛口碑大师', multiplier: 1.5, nextXp: 540 };
  if (xp < 880) return { level: 5, title: '独立主理人', multiplier: 1.75, nextXp: 880 };
  return { level: 6, title: '漫时光梦想家', multiplier: 2.0, nextXp: null };
}

export function clampVital(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function randomRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export function createStreetActors(): OutdoorActor[] {
  return [
    {
      spritePrefix: 'char_girl',
      staticSprite: 'char_girl_basic',
      hasWalkFrames: true,
      name: '小葵',
      x: 410,
      y: 472,
      minX: 110,
      maxX: 860,
      facing: 'right',
      walkPhase: 0,
      speed: 58,
      pauseTimer: 1.2,
      emoteText: '☀️',
      emoteTimer: 2.2,
    },
    {
      spritePrefix: 'shiba',
      staticSprite: 'shiba_dog_pet',
      hasWalkFrames: false,
      name: '豆包',
      x: 348,
      y: 476,
      minX: 120,
      maxX: 840,
      facing: 'right',
      walkPhase: 0,
      speed: 62,
      pauseTimer: 1.8,
      emoteTimer: 0,
    },
    {
      spritePrefix: 'char_florist_girl',
      staticSprite: 'char_florist_girl',
      hasWalkFrames: false,
      name: '小夏',
      x: 220,
      y: 454,
      minX: 110,
      maxX: 310,
      facing: 'right',
      walkPhase: 0,
      speed: 36,
      pauseTimer: 2.4,
      emoteText: '☕',
      emoteTimer: 2.0,
    },
    {
      spritePrefix: 'char_chef_barista',
      staticSprite: 'char_chef_barista',
      hasWalkFrames: false,
      name: '麦麦',
      x: 780,
      y: 454,
      minX: 690,
      maxX: 870,
      facing: 'left',
      walkPhase: 0,
      speed: 38,
      pauseTimer: 2.0,
      emoteTimer: 0,
    },
    {
      spritePrefix: 'char_grandpa',
      staticSprite: 'char_grandpa',
      hasWalkFrames: false,
      name: '福伯',
      x: 560,
      y: 462,
      minX: 430,
      maxX: 660,
      facing: 'left',
      walkPhase: 0,
      speed: 28,
      pauseTimer: 3.1,
      emoteTimer: 0,
    },
  ];
}

export function createMarketActors(): OutdoorActor[] {
  return [
    {
      spritePrefix: 'char_girl',
      staticSprite: 'char_girl_outfit_coat',
      hasWalkFrames: false,
      name: '小葵 (摊主)',
      x: 428,
      y: 452,
      minX: 420,
      maxX: 438,
      facing: 'right',
      walkPhase: 0,
      speed: 0,
      pauseTimer: 999,
      emoteText: '✨',
      emoteTimer: 2.4,
    },
    {
      spritePrefix: 'shiba',
      staticSprite: 'shiba_dog_pet',
      hasWalkFrames: false,
      name: '豆包',
      x: 345,
      y: 474,
      minX: 280,
      maxX: 375,
      facing: 'right',
      walkPhase: 0,
      speed: 25,
      pauseTimer: 2.5,
      emoteTimer: 0,
    },
    {
      spritePrefix: 'char_boy',
      staticSprite: 'char_boy_outfit_sport',
      hasWalkFrames: false,
      name: '阿墨',
      x: 590,
      y: 472,
      minX: 520,
      maxX: 790,
      facing: 'left',
      walkPhase: 0,
      speed: 44,
      pauseTimer: 1.5,
      emoteText: '🌙',
      emoteTimer: 2.0,
    },
    {
      spritePrefix: 'char_toddler_kid',
      staticSprite: 'char_toddler_kid',
      hasWalkFrames: false,
      name: '芽芽',
      x: 720,
      y: 478,
      minX: 550,
      maxX: 860,
      facing: 'left',
      walkPhase: 0,
      speed: 48,
      pauseTimer: 1.8,
      emoteTimer: 0,
    },
  ];
}

export function updateOutdoorActors(actors: OutdoorActor[], dt: number, speedMult: number): void {
  if (speedMult <= 0) return;
  const stepDt = dt * (speedMult === 1 ? 1 : speedMult === 2 ? 1.8 : 2.6);

  for (const a of actors) {
    a.emoteTimer = Math.max(0, a.emoteTimer - stepDt);
    if (a.emoteTimer <= 0) a.emoteText = undefined;
    if (a.speed <= 0 || a.seated) continue;

    if (a.pauseTimer > 0) {
      a.pauseTimer -= stepDt;
      continue;
    }

    const dir = a.facing === 'right' ? 1 : -1;
    a.x += dir * a.speed * stepDt;
    a.walkPhase += stepDt * 3.6;

    if (a.x >= a.maxX) {
      a.x = a.maxX;
      a.facing = 'left';
      a.pauseTimer = 1.6 + Math.random() * 2.4;
    } else if (a.x <= a.minX) {
      a.x = a.minX;
      a.facing = 'right';
      a.pauseTimer = 1.6 + Math.random() * 2.4;
    }
  }
}

export function pullGachaItem(state: GameSaveState, atlas: AtlasJson, currentDay: number): {
  itemId: string;
  itemName: string;
  tier: string;
} | null {
  const pool = CATALOG_ITEMS.filter(
    (item) => (item.tier === 'T1' || item.tier === 'T2') && atlas.items[item.id]
  );
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const meta = atlas.items[pick.id];
  const variant = meta ? Math.floor(Math.random() * meta.variants.length) : 0;
  state.inventory.push({
    uid: `item_${state.nextUid++}`,
    itemId: pick.id,
    variant,
    flipped: false,
    isActive: true,
    boughtOnDay: currentDay,
    purchasePrice: pick.price,
  });
  state.gachaPullCount += 1;
  return { itemId: pick.id, itemName: pick.name, tier: pick.tier };
}

export function computeHomeRecoveryBonus(comfortScore: number): number {
  return Math.min(18, Math.floor(comfortScore / 35));
}

export function computeEntryJobPay(xp: number, mood: number): { base: number; tip: number; total: number } {
  const tier = getCareerTier(xp);
  const rawBase = randomRange(CAREER_WAGE_TABLE.entryJob.min, CAREER_WAGE_TABLE.entryJob.max);
  const tipChance = mood >= 70 ? 0.9 : 0.55;
  const rawTip =
    Math.random() < tipChance
      ? randomRange(CAREER_WAGE_TABLE.entryJob.activeTipBonus[0], CAREER_WAGE_TABLE.entryJob.activeTipBonus[1])
      : 15;
  const base = Math.round(rawBase * tier.multiplier);
  const tip = Math.round(rawTip * tier.multiplier);
  return { base, tip, total: base + tip };
}

export function computeFreelanceOrderPay(
  hasComputer: boolean,
  xp: number,
  comfortScore: number
): number {
  const tier = getCareerTier(xp);
  if (hasComputer) {
    const comfortBoost = 1 + Math.min(0.28, comfortScore / 800);
    if (tier.level >= 5) {
      const rawExpert = randomRange(
        CAREER_WAGE_TABLE.expertCareer.min,
        CAREER_WAGE_TABLE.expertCareer.max
      );
      return Math.round(rawExpert * (tier.level >= 6 ? 1.15 : 1.0) * comfortBoost);
    }
    const raw = randomRange(
      CAREER_WAGE_TABLE.midFreelanceAndMarket.min,
      CAREER_WAGE_TABLE.midFreelanceAndMarket.max
    );
    return Math.round(raw * tier.multiplier * comfortBoost);
  }
  const raw = randomRange(CAREER_WAGE_TABLE.sideGig.min, CAREER_WAGE_TABLE.sideGig.max);
  return Math.round(raw * tier.multiplier);
}

export function computeRoommateRent(state: GameSaveState, comfortScore: number): {
  rent: number;
  roommateCount: number;
} {
  const roommates = state.residents.filter((r) => r.present && r.id !== 'girl' && r.id !== 'shiba');
  const count = roommates.length;
  if (count === 0) return { rent: 0, roommateCount: 0 };
  const rentCfg = CAREER_WAGE_TABLE.roommateRentEvery3Days;
  const baseRent = randomRange(rentCfg.min, rentCfg.max);
  const scaleFactor = 1 + Math.max(0, count - 1) * 0.25 + (state.floors[2].unlocked ? 0.25 : 0);
  const comfortFactor = 1 + Math.min(0.25, comfortScore / 900);
  return {
    rent: Math.round(baseRent * scaleFactor * comfortFactor),
    roommateCount: count,
  };
}

export function computeNightMarketSale(ware: MarketWareDef, xp: number, mood: number): {
  revenue: number;
  mult: number;
} {
  const tier = getCareerTier(xp);
  const [mMin, mMax] = CAREER_WAGE_TABLE.midFreelanceAndMarket.nightMarketMarginMultiplier;
  const rawMult = mMin + Math.random() * (mMax - mMin) + (mood >= 80 ? 0.25 : 0);
  const revenue = Math.round(ware.baseCost * rawMult * tier.multiplier);
  return { revenue, mult: Number(rawMult.toFixed(1)) };
}

export function getHomeApplianceActionMeta(
  itemId: string,
  hasComputerOnFloor: boolean
): {
  kind: 'freelance' | 'sleep' | 'bath' | 'meal' | 'relax';
  title: string;
  buttonText: string;
  costCoins: number;
  energyDelta: number;
  moodDelta: number;
  minutes: number;
  rewardHint: string;
} | null {
  if (itemId === 'desktop_pc_set') {
    return {
      kind: 'freelance',
      title: '电脑工作台 · 承接独立插画/程序单',
      buttonText: '接单干活 (3h)',
      costCoins: 0,
      energyDelta: -32,
      moodDelta: -4,
      minutes: 180,
      rewardHint: '+380~680G+',
    };
  }
  if (itemId === 'study_desk') {
    return hasComputerOnFloor
      ? {
          kind: 'freelance',
          title: '书桌工作区 · 接居家外包单',
          buttonText: '接单干活 (3h)',
          costCoins: 0,
          energyDelta: -32,
          moodDelta: -4,
          minutes: 180,
          rewardHint: '+380~680G+',
        }
      : {
          kind: 'freelance',
          title: '实木书桌 · 手账整理零工',
          buttonText: '接小零工 (1h)',
          costCoins: 0,
          energyDelta: -16,
          moodDelta: 2,
          minutes: 60,
          rewardHint: '+40~90G+',
        };
  }
  if (itemId === 'cozy_patchwork_bed') {
    return {
      kind: 'sleep',
      title: '晴空软床 · 上床补觉恢复精力',
      buttonText: '美美小睡 (2.5h)',
      costCoins: 0,
      energyDelta: 48,
      moodDelta: 18,
      minutes: 150,
      rewardHint: '精力大幅回复',
    };
  }
  if (itemId === 'clawfoot_bathtub') {
    return {
      kind: 'bath',
      title: '猫脚浴缸 · 暖香泡泡浴',
      buttonText: '舒缓泡澡 (1h)',
      costCoins: 0,
      energyDelta: 24,
      moodDelta: 36,
      minutes: 60,
      rewardHint: '心情大涨',
    };
  }
  if (
    itemId === 'retro_fridge' ||
    itemId === 'kitchen_stove_counter' ||
    itemId === 'dining_table' ||
    itemId === 'plate_omurice' ||
    itemId === 'strawberry_cake' ||
    itemId === 'coffee_mug_steaming'
  ) {
    return {
      kind: 'meal',
      title: '温馨餐厨 · 现做并享用暖心料理',
      buttonText: `开动 (-${ECONOMY.homeMealCost} G)`,
      costCoins: ECONOMY.homeMealCost,
      energyDelta: 34,
      moodDelta: 20,
      minutes: 45,
      rewardHint: '超值回体力',
    };
  }
  if (
    itemId === 'plush_sofa' ||
    itemId === 'balcony_egg_chair' ||
    itemId === 'patio_lounge_chair' ||
    itemId === 'street_bench'
  ) {
    return {
      kind: 'relax',
      title: '柔软休闲座 · 倚靠放松看窗景',
      buttonText: '小憩片刻 (30m)',
      costCoins: 0,
      energyDelta: 16,
      moodDelta: 20,
      minutes: 30,
      rewardHint: '舒缓解压',
    };
  }
  return null;
}

export interface VenueHotspotDef {
  id: string;
  label: string;
  actionKind: 'job' | 'treat' | 'treat_special' | 'gacha' | 'pet_spa' | 'outfit';
  x: number;
  y: number;
  w: number;
  h: number;
  buttonText: string;
  energyCost?: number;
  coinCost?: number;
  energyGain?: number;
  moodGain?: number;
  minutes: number;
  xpGain: number;
}

export interface VenueDef {
  id: VenueId;
  name: string;
  subtitle: string;
  backdropUrl: string;
  floorMinY: number;
  floorMaxY: number;
  hotspots: VenueHotspotDef[];
  seats: Array<{ x: number; footY: number; facing: 'left' | 'right' }>;
  lampGlows: Array<{ x: number; y: number; r: number }>;
}

export const VENUE_DEFS: Record<VenueId, VenueDef> = {
  cafe: {
    id: 'cafe',
    name: '海风玻璃花房咖啡馆',
    subtitle: '点击咖啡吧台或甜点柜台互动；拖动人物坐到餐桌旁',
    backdropUrl: './assets/backdrops/venue_cafe.png',
    floorMinY: 388,
    floorMaxY: 495,
    hotspots: [
      {
        id: 'cafe_bar',
        label: '手冲咖啡吧台 · 打工',
        actionKind: 'job',
        x: 10,
        y: 120,
        w: 222,
        h: 248,
        buttonText: '咖啡兼职 (+160~320G+)',
        energyCost: 24,
        minutes: 120,
        xpGain: 18,
      },
      {
        id: 'cafe_latte',
        label: '现磨拿铁 & 甜点柜',
        actionKind: 'treat',
        x: 235,
        y: 168,
        w: 165,
        h: 198,
        buttonText: '海风拿铁 (-18G · +18⚡/+22😊)',
        coinCost: ECONOMY.coffeePrice,
        energyGain: 18,
        moodGain: 22,
        minutes: 25,
        xpGain: 4,
      },
    ],
    seats: [
      { x: 598, footY: 382, facing: 'right' },
      { x: 706, footY: 382, facing: 'left' },
      { x: 790, footY: 382, facing: 'right' },
      { x: 902, footY: 382, facing: 'left' },
    ],
    lampGlows: [
      { x: 80, y: 115, r: 145 },
      { x: 185, y: 115, r: 145 },
      { x: 905, y: 190, r: 155 },
    ],
  },
  bakery: {
    id: 'bakery',
    name: '晨光可颂烘焙坊',
    subtitle: '点击窑炉与甜点柜烘焙打工或买现烤面包',
    backdropUrl: './assets/backdrops/venue_bakery.png',
    floorMinY: 388,
    floorMaxY: 495,
    hotspots: [
      {
        id: 'bakery_oven',
        label: '金黄窑烤烘焙台 · 打工',
        actionKind: 'job',
        x: 16,
        y: 100,
        w: 315,
        h: 270,
        buttonText: '烘焙兼职 (+160~320G+)',
        energyCost: 24,
        minutes: 120,
        xpGain: 18,
      },
      {
        id: 'bakery_case',
        label: '酥脆可颂展示柜',
        actionKind: 'treat',
        x: 336,
        y: 135,
        w: 318,
        h: 235,
        buttonText: '黄油可颂 (-12G · +26⚡/+16😊)',
        coinCost: 12,
        energyGain: 26,
        moodGain: 16,
        minutes: 25,
        xpGain: 4,
      },
    ],
    seats: [
      { x: 718, footY: 382, facing: 'left' },
      { x: 782, footY: 382, facing: 'left' },
    ],
    lampGlows: [
      { x: 130, y: 215, r: 165 },
      { x: 405, y: 95, r: 150 },
      { x: 505, y: 95, r: 150 },
      { x: 600, y: 95, r: 150 },
    ],
  },
  salon: {
    id: 'salon',
    name: '糖心沙龙 & 扭蛋杂货屋',
    subtitle: '点击造型台打工或换装；点击右侧扭蛋机抽盲盒进仓库',
    backdropUrl: './assets/backdrops/venue_salon.png',
    floorMinY: 392,
    floorMaxY: 495,
    hotspots: [
      {
        id: 'salon_mirror',
        label: '星光造型镜台 · 兼职',
        actionKind: 'job',
        x: 20,
        y: 95,
        w: 405,
        h: 278,
        buttonText: '造型兼职 (+160~320G+)',
        energyCost: 24,
        minutes: 120,
        xpGain: 18,
      },
      {
        id: 'salon_gacha',
        label: '彩虹惊喜盲盒扭蛋机',
        actionKind: 'gacha',
        x: 685,
        y: 120,
        w: 162,
        h: 256,
        buttonText: `抽扭蛋 (-${ECONOMY.gachaPullPrice}G)`,
        coinCost: ECONOMY.gachaPullPrice,
        moodGain: 18,
        minutes: 15,
        xpGain: 6,
      },
    ],
    seats: [
      { x: 113, footY: 388, facing: 'right' },
      { x: 330, footY: 388, facing: 'right' },
    ],
    lampGlows: [
      { x: 105, y: 180, r: 150 },
      { x: 335, y: 180, r: 150 },
      { x: 765, y: 245, r: 150 },
    ],
  },
  pet: {
    id: 'pet',
    name: '萌宠护理与洗护小屋',
    subtitle: '点击暖香浴缸给豆包洗泡泡浴；点击零食柜台兼职',
    backdropUrl: './assets/backdrops/venue_pet.png',
    floorMinY: 388,
    floorMaxY: 495,
    hotspots: [
      {
        id: 'pet_tub',
        label: '泡泡顺毛洗护浴缸',
        actionKind: 'pet_spa',
        x: 18,
        y: 140,
        w: 280,
        h: 236,
        buttonText: '柴犬泡泡SPA (-20G · +8⚡/+28😊)',
        coinCost: 20,
        energyGain: 8,
        moodGain: 28,
        minutes: 30,
        xpGain: 6,
      },
      {
        id: 'pet_counter',
        label: '宠物零食收银台 · 兼职',
        actionKind: 'job',
        x: 655,
        y: 80,
        w: 295,
        h: 292,
        buttonText: '美容兼职 (+160~320G+)',
        energyCost: 24,
        minutes: 120,
        xpGain: 18,
      },
    ],
    seats: [
      { x: 542, footY: 382, facing: 'left' },
    ],
    lampGlows: [
      { x: 92, y: 100, r: 145 },
      { x: 225, y: 100, r: 145 },
      { x: 785, y: 170, r: 155 },
    ],
  },
};

export function createVenueActors(venueId: VenueId): OutdoorActor[] {
  if (venueId === 'cafe') {
    return [
      {
        spritePrefix: 'char_chef_barista',
        staticSprite: 'char_chef_barista',
        hasWalkFrames: false,
        name: '麦麦 (咖啡师)',
        x: 205,
        y: 418,
        minX: 110,
        maxX: 295,
        facing: 'right',
        walkPhase: 0,
        speed: 22,
        pauseTimer: 2.5,
        emoteText: '☕',
        emoteTimer: 2.6,
      },
      {
        spritePrefix: 'char_girl',
        staticSprite: 'char_girl_basic',
        hasWalkFrames: true,
        name: '小葵',
        x: 525,
        y: 454,
        minX: 390,
        maxX: 790,
        facing: 'right',
        walkPhase: 0,
        speed: 48,
        pauseTimer: 1.4,
        emoteText: '🍰',
        emoteTimer: 2.2,
      },
      {
        spritePrefix: 'char_boy',
        staticSprite: 'char_boy_basic',
        hasWalkFrames: true,
        name: '阿墨',
        x: 720,
        y: 456,
        minX: 560,
        maxX: 860,
        facing: 'left',
        walkPhase: 0,
        speed: 42,
        pauseTimer: 2.0,
        emoteTimer: 0,
      },
    ];
  }
  if (venueId === 'bakery') {
    return [
      {
        spritePrefix: 'char_chef_barista',
        staticSprite: 'char_chef_barista',
        hasWalkFrames: false,
        name: '麦麦 (烘焙师)',
        x: 235,
        y: 424,
        minX: 120,
        maxX: 360,
        facing: 'right',
        walkPhase: 0,
        speed: 24,
        pauseTimer: 2.2,
        emoteText: '🥐',
        emoteTimer: 2.6,
      },
      {
        spritePrefix: 'char_toddler_kid',
        staticSprite: 'char_toddler_kid',
        hasWalkFrames: false,
        name: '芽芽',
        x: 490,
        y: 458,
        minX: 380,
        maxX: 690,
        facing: 'left',
        walkPhase: 0,
        speed: 44,
        pauseTimer: 1.6,
        emoteText: '😋',
        emoteTimer: 2.0,
      },
      {
        spritePrefix: 'char_girl',
        staticSprite: 'char_girl_outfit_summer',
        hasWalkFrames: false,
        name: '小葵',
        x: 750,
        y: 452,
        minX: 580,
        maxX: 850,
        facing: 'left',
        walkPhase: 0,
        speed: 38,
        pauseTimer: 1.8,
        emoteTimer: 0,
      },
    ];
  }
  if (venueId === 'salon') {
    return [
      {
        spritePrefix: 'char_florist_girl',
        staticSprite: 'char_florist_girl',
        hasWalkFrames: false,
        name: '小夏 (造型师)',
        x: 255,
        y: 426,
        minX: 120,
        maxX: 430,
        facing: 'left',
        walkPhase: 0,
        speed: 26,
        pauseTimer: 2.3,
        emoteText: '✨',
        emoteTimer: 2.5,
      },
      {
        spritePrefix: 'char_girl',
        staticSprite: 'char_girl_basic',
        hasWalkFrames: true,
        name: '小葵',
        x: 560,
        y: 454,
        minX: 410,
        maxX: 775,
        facing: 'right',
        walkPhase: 0,
        speed: 46,
        pauseTimer: 1.5,
        emoteText: '🎁',
        emoteTimer: 2.4,
      },
      {
        spritePrefix: 'char_boy',
        staticSprite: 'char_boy_outfit_sport',
        hasWalkFrames: false,
        name: '阿墨',
        x: 690,
        y: 452,
        minX: 480,
        maxX: 820,
        facing: 'left',
        walkPhase: 0,
        speed: 38,
        pauseTimer: 2.1,
        emoteTimer: 0,
      },
    ];
  }
  // pet cabin
  return [
    {
      spritePrefix: 'shiba',
      staticSprite: 'shiba_dog_pet',
      hasWalkFrames: false,
      name: '豆包',
      x: 265,
      y: 460,
      minX: 180,
      maxX: 620,
      facing: 'right',
      walkPhase: 0,
      speed: 52,
      pauseTimer: 1.4,
      emoteText: '🫧',
      emoteTimer: 2.6,
    },
    {
      spritePrefix: 'char_florist_girl',
      staticSprite: 'char_florist_girl',
      hasWalkFrames: false,
      name: '小夏 (护理师)',
      x: 710,
      y: 432,
      minX: 540,
      maxX: 810,
      facing: 'left',
      walkPhase: 0,
      speed: 26,
      pauseTimer: 2.4,
      emoteText: '🐾',
      emoteTimer: 2.2,
    },
    {
      spritePrefix: 'char_toddler_kid',
      staticSprite: 'char_toddler_kid',
      hasWalkFrames: false,
      name: '芽芽',
      x: 420,
      y: 454,
      minX: 300,
      maxX: 640,
      facing: 'right',
      walkPhase: 0,
      speed: 40,
      pauseTimer: 1.8,
      emoteTimer: 0,
    },
  ];
}

export interface IslandMilestoneDef {
  id: string;
  title: string;
  desc: string;
  rewardCoins: number;
  check: (state: GameSaveState, comfortScore: number) => boolean;
}

export const ISLAND_MILESTONES: IslandMilestoneDef[] = [
  {
    id: 'explore_4',
    title: '初探海风小岛',
    desc: '打卡 4 个不同小镇建筑',
    rewardCoins: 180,
    check: (s) => s.visitedLandmarks.length >= 4,
  },
  {
    id: 'explore_all',
    title: '全岛漫游达人',
    desc: '打卡全部 8 处小镇地标',
    rewardCoins: 380,
    check: (s) => s.visitedLandmarks.length >= 8,
  },
  {
    id: 'cozy_300',
    title: '温馨小窝营造师',
    desc: '小屋温馨度达到 300+',
    rewardCoins: 260,
    check: (_s, comfort) => comfort >= 300,
  },
  {
    id: 'gacha_3',
    title: '扭蛋盲盒收藏家',
    desc: '在扭蛋屋抽取 3 次盲盒家具',
    rewardCoins: 220,
    check: (s) => s.gachaPullCount >= 3,
  },
  {
    id: 'career_lv5',
    title: '独立主理人之路',
    desc: '职业等级达到 Lv.5 独立主理人',
    rewardCoins: 500,
    check: (s) => getCareerTier(s.careerXp).level >= 5,
  },
];

export function evaluateMilestones(state: GameSaveState, comfortScore: number): IslandMilestoneDef[] {
  const unlockedNow: IslandMilestoneDef[] = [];
  for (const m of ISLAND_MILESTONES) {
    if (!state.claimedMilestones.includes(m.id) && m.check(state, comfortScore)) {
      state.claimedMilestones.push(m.id);
      state.coins += m.rewardCoins;
      unlockedNow.push(m);
    }
  }
  return unlockedNow;
}

