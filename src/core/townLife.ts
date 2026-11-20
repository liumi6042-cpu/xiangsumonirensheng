import { CATALOG_ITEMS, type AtlasJson } from '../data/catalog';
import { CAREER_WAGE_TABLE, ECONOMY } from '../data/economy';
import type { GameSaveState } from './roomState';

export type SceneMode = 'map' | 'home' | 'street' | 'market';
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
  targetScene: Exclude<SceneMode, 'map'> | 'pet';
  targetSpot?: Exclude<StreetSpotId, 'home' | 'market'>;
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
    tag: '打工/盲盒',
    actionHint: '进入海风商业街造型店，体验助理兼职与饰品街区',
    nx: 0.02,
    ny: 0.58,
    nw: 0.20,
    nh: 0.29,
    pinX: 0.125,
    pinY: 0.855,
    accentColor: '#75A5CE',
    targetScene: 'street',
    targetSpot: 'salon',
  },
  {
    id: 'bakery',
    name: '晨光面包房',
    tag: '烘焙/可颂',
    actionHint: '进入烘焙街区帮忙出炉可颂（+160~320G）或买面包回体力',
    nx: 0.26,
    ny: 0.14,
    nw: 0.18,
    nh: 0.25,
    pinX: 0.35,
    pinY: 0.40,
    accentColor: '#DF9F42',
    targetScene: 'street',
    targetSpot: 'bakery',
  },
  {
    id: 'store',
    name: '手作杂货百货',
    tag: '180G扭蛋',
    actionHint: '前往街区扭蛋屋，-180G 抽取精选 T1/T2 家具直接进仓库',
    nx: 0.25,
    ny: 0.60,
    nw: 0.20,
    nh: 0.27,
    pinX: 0.355,
    pinY: 0.86,
    accentColor: '#699F78',
    targetScene: 'street',
    targetSpot: 'salon',
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
    tag: '打工/拿铁',
    actionHint: '进入玻璃花房咖啡馆兼职赚金币或喝拿铁提神',
    nx: 0.56,
    ny: 0.14,
    nw: 0.28,
    nh: 0.27,
    pinX: 0.705,
    pinY: 0.40,
    accentColor: '#5B9A77',
    targetScene: 'street',
    targetSpot: 'cafe',
  },
  {
    id: 'pet',
    name: '萌宠护理小屋',
    tag: '撸狗+心情',
    actionHint: '摸摸豆包并做暖心顺毛护理（心情大涨）',
    nx: 0.52,
    ny: 0.60,
    nw: 0.28,
    nh: 0.29,
    pinX: 0.66,
    pinY: 0.88,
    accentColor: '#C9894C',
    targetScene: 'pet',
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
  return { level: 4, title: '小岛口碑大师', multiplier: 1.5, nextXp: null };
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
    if (a.speed <= 0) continue;

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
    const raw = randomRange(
      CAREER_WAGE_TABLE.midFreelanceAndMarket.min,
      CAREER_WAGE_TABLE.midFreelanceAndMarket.max
    );
    const comfortBoost = 1 + Math.min(0.25, comfortScore / 800);
    return Math.round(raw * tier.multiplier * comfortBoost);
  }
  const raw = randomRange(CAREER_WAGE_TABLE.sideGig.min, CAREER_WAGE_TABLE.sideGig.max);
  return Math.round(raw * tier.multiplier);
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
