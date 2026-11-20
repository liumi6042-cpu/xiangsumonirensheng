import type { ItemTier } from './economy';

export type PlacementLayer = 'wall' | 'rug' | 'floor' | 'prop';

export type CatalogCategory =
  | '全部'
  | '厨房餐饮'
  | '客厅休闲'
  | '卧室书房'
  | '卫浴萌宠'
  | '墙饰灯具'
  | '桌面摆件';

export interface SurfaceLine {
  y: number;
  x0: number;
  x1: number;
}

export interface SeatConfig {
  dx: number;
  seatY: number;
}

export interface SleepAnchor {
  dx: number;
  dy: number;
}

export interface LightConfig {
  dx: number;
  dy: number;
  radius: number;
}

export interface AtlasVariant {
  index: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterSpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasItemMeta {
  w: number;
  h: number;
  layer: PlacementLayer;
  footDepth?: number;
  anchor?: 'top' | 'ceiling' | 'floor';
  surfaces?: SurfaceLine[];
  seats?: SeatConfig[];
  sleepAnchor?: SleepAnchor;
  light?: LightConfig;
  toggleState?: boolean;
  pairedToggle?: boolean;
  flippable?: boolean;
  isStairs?: boolean;
  glassRect?: { x: number; y: number; w: number; h: number };
  variants: AtlasVariant[];
}

export interface AtlasJson {
  gridSize: number;
  artStyle?: string;
  atlasWidth: number;
  atlasHeight: number;
  items: Record<string, AtlasItemMeta>;
  characters?: Record<string, CharacterSpriteRect>;
}

export interface FurnitureCatalogDef {
  id: string;
  name: string;
  category: Exclude<CatalogCategory, '全部'>;
  tier: ItemTier;
  price: number;
  comfort: number;
  description: string;
}

export const CATALOG_ITEMS: FurnitureCatalogDef[] = [
  // 厨房餐饮
  { id: 'retro_fridge', name: '复古圆角双门冰箱', category: '厨房餐饮', tier: 'T2', price: 420, comfort: 8, description: '贴满便利贴的复古冰箱，顶部可叠放绿植与收纳篮。' },
  { id: 'kitchen_stove_counter', name: '灶台烤箱一体橱柜', category: '厨房餐饮', tier: 'T2', price: 480, comfort: 10, description: '含双灶头、温热烤箱与洗手池，灶台面可放煎锅与餐具。' },
  { id: 'kitchen_island_counter', name: '备菜抽屉岛台', category: '厨房餐饮', tier: 'T2', price: 240, comfort: 6, description: '百搭备餐与收纳台，顶部整条皆可微距摆放小物件。' },
  { id: 'kitchen_wall_cabinet', name: '双门厨房吊柜', category: '墙饰灯具', tier: 'T2', price: 190, comfort: 5, description: '带开放碗碟格与透明玻璃柜门，省下地面空间。' },
  { id: 'dining_table', name: '实木暖意餐桌', category: '厨房餐饮', tier: 'T2', price: 220, comfort: 7, description: '温馨聚餐桌，支持多份料理、蛋糕与马克杯自由叠放。' },
  { id: 'dining_chair', name: '软垫实木餐椅', category: '厨房餐饮', tier: 'T1', price: 75, comfort: 3, description: '可左右翻转朝向，支持小人拖拽或自主落座。' },

  // 客厅休闲 & 阳台户外
  { id: 'plush_sofa', name: '云朵三人布艺沙发', category: '客厅休闲', tier: 'T2', price: 380, comfort: 12, description: '松软三座沙发，支持双人同时就坐，座垫上还能放猫咪！' },
  { id: 'balcony_egg_chair', name: '原木藤编吊篮椅', category: '客厅休闲', tier: 'T2', price: 310, comfort: 11, description: '手工自然藤编镂空吊椅，放阳台或窗边最惬意（可坐人）。' },
  { id: 'patio_lounge_chair', name: '阳台休闲躺椅', category: '客厅休闲', tier: 'T2', price: 260, comfort: 9, description: '配珊瑚抱枕与流苏盖毯的休闲躺椅，支持翻转朝向与落座。' },
  { id: 'street_bench', name: '复古木条长椅', category: '客厅休闲', tier: 'T1', price: 140, comfort: 6, description: '双人庭院木长椅，支持两个小人同时靠坐休息。' },
  { id: 'coffee_table', name: '轻木圆角茶几', category: '客厅休闲', tier: 'T2', price: 150, comfort: 5, description: '温馨圆角茶几，适合摆咖啡杯、草莓蛋糕与花盆。' },
  { id: 'persian_cozy_rug', name: '手工流苏编织地毯', category: '客厅休闲', tier: 'T1', price: 95, comfort: 6, description: '铺在地板最底层，不阻挡任何沙发或茶几摆放。' },
  { id: 'tall_bookshelf', name: '满格木质书架', category: '客厅休闲', tier: 'T2', price: 260, comfort: 9, description: '书架顶面可叠放手办与小绿植！' },
  { id: 'fiddle_leaf_plant', name: '大盆琴叶榕绿植', category: '客厅休闲', tier: 'T1', price: 85, comfort: 6, description: '生机满满的陶土盆绿植，立刻点亮角落。' },
  { id: 'street_bush_flowers', name: '繁花绿篱灌木丛', category: '客厅休闲', tier: 'T1', price: 65, comfort: 5, description: '阳台庭院百搭造景花丛，生机盎然。' },

  // 卧室书房
  { id: 'cozy_patchwork_bed', name: '晴空几何百衲软床', category: '卧室书房', tier: 'T2', price: 460, comfort: 14, description: '好睡眠能恢复精神，支持小人拖拽躺卧小睡与翻转方向。' },
  { id: 'wardrobe', name: '复古双门衣柜', category: '卧室书房', tier: 'T2', price: 340, comfort: 10, description: '带圆拱全身镜的宽大衣柜，顶部还可叠放小物件。' },
  { id: 'bedside_nightstand', name: '双抽床头柜', category: '卧室书房', tier: 'T1', price: 110, comfort: 4, description: '放一盏暖台灯和睡前读物刚刚好。' },
  { id: 'study_desk', name: '三抽实木书桌', category: '卧室书房', tier: 'T2', price: 280, comfort: 8, description: '居家办公学习桌面，台面宽敞可摆满电脑与咖啡。' },

  // 卫浴萌宠
  { id: 'clawfoot_bathtub', name: '复古猫脚白瓷浴缸', category: '卫浴萌宠', tier: 'T3', price: 640, comfort: 14, description: '泡澡最治愈，支持左右翻转龙头方向。' },
  { id: 'bathroom_vanity', name: '圆镜木框洗手台', category: '卫浴萌宠', tier: 'T2', price: 210, comfort: 6, description: '带明镜的洁白瓷盆洗手台，附带香薰蜡烛与洗漱篮。' },
  { id: 'cozy_toilet', name: '陶瓷静音马桶', category: '卫浴萌宠', tier: 'T2', price: 160, comfort: 4, description: '日常起居必备，支持翻转安装方向。' },
  { id: 'bath_checkered_mat', name: '棋盘格浴室防滑垫', category: '卫浴萌宠', tier: 'T1', price: 45, comfort: 3, description: '软绵绵的格子吸水地垫，可垫在浴缸或洗手台前。' },
  { id: 'cat_tree_condo', name: '多层剑麻猫爬架', category: '卫浴萌宠', tier: 'T2', price: 290, comfort: 9, description: '上下两层平台都能摆小猫咪或小摆件，自带吊球！' },
  { id: 'plush_pet_bed', name: '云朵宠物软窝', category: '卫浴萌宠', tier: 'T1', price: 80, comfort: 5, description: '圆滚滚的宠物小窝，可以把猫咪小可爱抱进去午睡。' },

  // 墙饰灯具与隔断
  { id: 'sunset_window', name: '全景木框布帘窗', category: '墙饰灯具', tier: 'T2', price: 180, comfort: 8, description: '透过玻璃实时看见屋外晴云/晚霞/星空，点击即可拉合窗帘！' },
  { id: 'wall_shelf_wide', name: '一字挂钩实木壁架', category: '墙饰灯具', tier: 'T1', price: 65, comfort: 4, description: '高精细桌面摆件的最佳展示舞台，支持 2px 自由挪动。' },
  { id: 'framed_landscape_art', name: '手账风景装裱画', category: '墙饰灯具', tier: 'T1', price: 55, comfort: 5, description: '含落日、海空、森林 3 款治愈系挂画配色可切换。' },
  { id: 'wall_clock', name: '胡桃木圆挂钟', category: '墙饰灯具', tier: 'T1', price: 40, comfort: 2, description: '精致的复古圆钟，给墙面添一点时间气息。' },
  { id: 'pendant_ceiling_lamp', name: '薄荷暖光吊灯', category: '墙饰灯具', tier: 'T1', price: 95, comfort: 6, description: '悬挂于天花板，入夜后洒下一片柔和暖黄光晕（可点击开关）。' },
  { id: 'wall_sconce_lamp', name: '百褶床头壁灯', category: '墙饰灯具', tier: 'T1', price: 70, comfort: 5, description: '不占桌面空间的小巧壁灯，点击可切换开关。' },
  { id: 'floor_standing_lamp', name: '彩绘玻璃落地灯', category: '墙饰灯具', tier: 'T2', price: 165, comfort: 7, description: '放在沙发旁最有电影氛围，支持随时开关灯。' },
  { id: 'street_lamp_post', name: '铁艺暖光街灯', category: '墙饰灯具', tier: 'T2', price: 195, comfort: 7, description: '庭院与阳台夜景必备，夜晚自动融入暖光灯池，支持点击开关。' },
  { id: 'balcony_railing_lights', name: '星光串灯玻璃护栏', category: '墙饰灯具', tier: 'T2', price: 240, comfort: 8, description: '自带暖黄小灯串的玻璃阳台护栏，夜晚点亮超浪漫！' },
  { id: 'room_door', name: '暖木玻璃木门', category: '墙饰灯具', tier: 'T1', price: 160, comfort: 4, description: '经典磨砂斜光玻璃室内门，适合分隔卧室与卫浴间。' },
  { id: 'room_divider_pillar', name: '顶天立地木隔断', category: '墙饰灯具', tier: 'T1', price: 90, comfort: 3, description: '用来划分厨房、卧室与浴室边界的实木结构柱。' },
  { id: 'stairwell_door_1f', name: '上下楼木楼梯门', category: '墙饰灯具', tier: 'T2', price: 320, comfort: 4, description: '连接 1F 与 2F 的温馨木楼梯，点击可快速切换楼层。' },

  // 桌面摆件 (2px micro-stacking!)
  { id: 'desktop_pc_set', name: '温馨笔记本工作台', category: '桌面摆件', tier: 'T3', price: 780, comfort: 10, description: '生产力神器：含手绘贴纸、台灯与桌面主机外设套装！' },
  { id: 'table_lamp_warm', name: '奶油磨菇小台灯', category: '桌面摆件', tier: 'T1', price: 60, comfort: 5, description: '3种灯罩色+亮灭切换，晚上亮灯超治愈。' },
  { id: 'frying_pan_simmer', name: '滋滋煎蛋培根锅', category: '桌面摆件', tier: 'T1', price: 48, comfort: 3, description: '热气腾腾的铸铁平底锅，可放在灶台或餐桌上。' },
  { id: 'plate_omurice', name: '热腾腾家常料理盘', category: '桌面摆件', tier: 'T1', price: 35, comfort: 4, description: '精致日式蛋包饭/草莓特饮，桌面摆拍百搭。' },
  { id: 'strawberry_cake', name: '双层草莓奶油蛋糕', category: '桌面摆件', tier: 'T1', price: 58, comfort: 5, description: '下午茶主角！放在餐桌、岛台或茶几上立刻甜蜜升级。' },
  { id: 'coffee_mug_steaming', name: '手冲拉花咖啡杯', category: '桌面摆件', tier: 'T1', price: 25, comfort: 2, description: '只要 25G 的每日小确幸，随时摆在桌角或茶几上。' },
  { id: 'potted_succulent', name: '迷你多肉盆栽', category: '桌面摆件', tier: 'T1', price: 38, comfort: 4, description: '软萌肉嘟嘟小盆栽，壁架与书桌都能稳稳叠放。' },
  { id: 'chibi_figurine_trio', name: '小岛限定手办盲盒', category: '桌面摆件', tier: 'T1', price: 95, comfort: 6, description: '日系手账主角同款微缩手办（3款配色），收藏控最爱！' },
  { id: 'book_stack', name: '蝴蝶结精装书堆', category: '桌面摆件', tier: 'T1', price: 30, comfort: 3, description: '带着红色书签的精装书堆，桌面瞬间有书卷气。' },
  { id: 'sleeping_ginger_cat_prop', name: '午睡橘猫团子', category: '桌面摆件', tier: 'T1', price: 120, comfort: 10, description: '可放在地毯、沙发、猫爬架、床尾甚至宠物窝里打盹！' },
];

export interface WallStyleDef {
  id: string;
  name: string;
  pricePerGrid: number;
  baseColor: string;
  stripeColor: string;
  wainscotColor: string;
  wainscotTrim: string;
  textureUrl: string;
  tileGrid?: boolean;
  brickPattern?: boolean;
}

export const WALL_STYLES: WallStyleDef[] = [
  {
    id: 'warm_stripe',
    name: '暖阳条纹奶油墙',
    pricePerGrid: 15,
    baseColor: '#fdecc6',
    stripeColor: '#f7e2b5',
    wainscotColor: '#dac098',
    wainscotTrim: '#ebd4ae',
    textureUrl: './assets/surfaces/wall_warm_cream.png',
  },
  {
    id: 'sage_botanical',
    name: '鼠尾草护墙绿',
    pricePerGrid: 15,
    baseColor: '#aed6ce',
    stripeColor: '#baded8',
    wainscotColor: '#f2e8d6',
    wainscotTrim: '#fff8ec',
    textureUrl: './assets/surfaces/wall_sage_mint.png',
  },
  {
    id: 'peach_gingham',
    name: '蜜桃波点甜梦墙',
    pricePerGrid: 15,
    baseColor: '#f6d6d6',
    stripeColor: '#fce8e8',
    wainscotColor: '#d8baaa',
    wainscotTrim: '#ead0c2',
    textureUrl: './assets/surfaces/wall_peach_blossom.png',
  },
  {
    id: 'aqua_bath_tile',
    name: '水蓝格纹瓷砖',
    pricePerGrid: 15,
    baseColor: '#daeef2',
    stripeColor: '#cce8ee',
    wainscotColor: '#84a8b2',
    wainscotTrim: '#a8cad4',
    textureUrl: './assets/surfaces/wall_aqua_mosaic.png',
    tileGrid: true,
  },
  {
    id: 'cozy_brick',
    name: '奶油烤砖咖啡墙',
    pricePerGrid: 15,
    baseColor: '#fcf5e6',
    stripeColor: '#f5ecda',
    wainscotColor: '#b07c54',
    wainscotTrim: '#ce986c',
    textureUrl: './assets/surfaces/wall_cozy_brick_cafe.png',
    brickPattern: true,
  },
  {
    id: 'cream_plaster',
    name: '香草奶油护墙(2F)',
    pricePerGrid: 15,
    baseColor: '#fdecc6',
    stripeColor: '#f7e2b5',
    wainscotColor: '#dac098',
    wainscotTrim: '#ebd4ae',
    textureUrl: './assets/surfaces/wall_warm_cream.png',
  },
];

export interface FloorStyleDef {
  id: string;
  name: string;
  pricePerGrid: number;
  plankA: string;
  plankB: string;
  groutColor: string;
  textureUrl: string;
  tileMode?: boolean;
}

export const FLOOR_STYLES: FloorStyleDef[] = [
  {
    id: 'warm_oak',
    name: '暖橡木长条地板',
    pricePerGrid: 15,
    plankA: '#d49a5e',
    plankB: '#ca9056',
    groutColor: '#925e30',
    textureUrl: './assets/surfaces/floor_honey_oak.png',
  },
  {
    id: 'birch_light',
    name: '日系浅桦木板',
    pricePerGrid: 15,
    plankA: '#ead2ac',
    plankB: '#e1c69e',
    groutColor: '#b69872',
    textureUrl: './assets/surfaces/floor_light_birch.png',
  },
  {
    id: 'dark_walnut',
    name: '深胡桃实木板',
    pricePerGrid: 15,
    plankA: '#9c6642',
    plankB: '#905c3a',
    groutColor: '#5c341e',
    textureUrl: './assets/surfaces/floor_warm_walnut.png',
  },
  {
    id: 'aqua_bath_floor',
    name: '水磨石清新浴砖',
    pricePerGrid: 15,
    plankA: '#b8dae2',
    plankB: '#c6e4eb',
    groutColor: '#90b8c4',
    textureUrl: './assets/surfaces/floor_terrazzo_bath.png',
    tileMode: true,
  },
  {
    id: 'cream_tile',
    name: '阳台复古石砖',
    pricePerGrid: 15,
    plankA: '#d8cec0',
    plankB: '#c2b8ac',
    groutColor: '#92887e',
    textureUrl: './assets/surfaces/floor_patio_stone.png',
    tileMode: true,
  },
];

export const CATALOG_MAP = new Map<string, FurnitureCatalogDef>(
  CATALOG_ITEMS.map((item) => [item.id, item])
);
