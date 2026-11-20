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

export interface AtlasItemMeta {
  w: number;
  h: number;
  layer: PlacementLayer;
  footDepth?: number;
  anchor?: 'top' | 'ceiling' | 'floor';
  surfaces?: SurfaceLine[];
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
  atlasWidth: number;
  atlasHeight: number;
  items: Record<string, AtlasItemMeta>;
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
  { id: 'kitchen_stove_counter', name: '灶台烤箱一体橱柜', category: '厨房餐饮', tier: 'T2', price: 480, comfort: 10, description: '含双灶头、温热烤箱与洗手池，台面可放煎锅与餐具。' },
  { id: 'kitchen_island_counter', name: '备菜抽屉岛台', category: '厨房餐饮', tier: 'T2', price: 240, comfort: 6, description: '百搭备餐与收纳台，顶部整条皆可微距摆放小物件。' },
  { id: 'kitchen_wall_cabinet', name: '双门厨房吊柜', category: '墙饰灯具', tier: 'T2', price: 190, comfort: 5, description: '带开放碗碟格与底部挂钩，省下地面空间。' },
  { id: 'dining_table', name: '实木暖意餐桌', category: '厨房餐饮', tier: 'T2', price: 220, comfort: 7, description: '温馨聚餐桌，支持多份料理与马克杯自由叠放。' },
  { id: 'dining_chair', name: '软垫实木餐椅', category: '厨房餐饮', tier: 'T1', price: 75, comfort: 3, description: '可左右翻转朝向，搭配餐桌或书桌使用。' },

  // 客厅休闲
  { id: 'plush_sofa', name: '云朵三人布艺沙发', category: '客厅休闲', tier: 'T2', price: 380, comfort: 12, description: '松软三座沙发，座垫上还能放抱枕或让猫咪打盹。' },
  { id: 'coffee_table', name: '双层实木茶几', category: '客厅休闲', tier: 'T2', price: 150, comfort: 5, description: '下层可放书刊的温馨茶几，桌面适合摆咖啡杯和花盆。' },
  { id: 'persian_cozy_rug', name: '手工流苏编织地毯', category: '客厅休闲', tier: 'T1', price: 95, comfort: 6, description: '铺在地板最底层，不阻挡任何沙发或茶几摆放。' },
  { id: 'tall_bookshelf', name: '满格木质书架', category: '客厅休闲', tier: 'T2', price: 260, comfort: 9, description: '书架顶与中层空格均可叠放手办与小绿植！' },
  { id: 'fiddle_leaf_plant', name: '大盆琴叶榕绿植', category: '客厅休闲', tier: 'T1', price: 85, comfort: 6, description: '生机满满的陶土盆绿植，立刻点亮角落。' },

  // 卧室书房
  { id: 'cozy_patchwork_bed', name: '田园百衲软床', category: '卧室书房', tier: 'T2', price: 460, comfort: 14, description: '好睡眠能省下大把白天时间，支持翻转床头朝向。' },
  { id: 'bedside_nightstand', name: '双抽床头柜', category: '卧室书房', tier: 'T1', price: 110, comfort: 4, description: '放一盏暖台灯和睡前读物刚刚好。' },
  { id: 'study_desk', name: '三抽实木书桌', category: '卧室书房', tier: 'T2', price: 280, comfort: 8, description: 'Phase 4 居家接单必备工作台，台面宽敞可摆满外设。' },

  // 卫浴萌宠
  { id: 'clawfoot_bathtub', name: '复古猫脚白瓷浴缸', category: '卫浴萌宠', tier: 'T3', price: 640, comfort: 14, description: '泡澡能大幅恢复卫生与心情，支持左右翻转龙头方向。' },
  { id: 'bathroom_vanity', name: '立柱洗手台带镜', category: '卫浴萌宠', tier: 'T2', price: 210, comfort: 6, description: '带明镜的洁白瓷盆洗手台，洗漱效率满分。' },
  { id: 'cozy_toilet', name: '陶瓷静音马桶', category: '卫浴萌宠', tier: 'T2', price: 160, comfort: 4, description: '日常起居必备，支持翻转安装方向。' },
  { id: 'bath_checkered_mat', name: '格纹浴室防滑垫', category: '卫浴萌宠', tier: 'T1', price: 45, comfort: 3, description: '软绵绵的格子吸水地垫，可垫在浴缸或洗手台前。' },
  { id: 'cat_tree_condo', name: '多层剑麻猫爬架', category: '卫浴萌宠', tier: 'T2', price: 290, comfort: 9, description: '上下两层平台都能摆小猫咪或猫玩具，自带吊球！' },
  { id: 'plush_pet_bed', name: '云朵宠物软窝', category: '卫浴萌宠', tier: 'T1', price: 80, comfort: 5, description: '圆滚滚的宠物小窝，可以把毛孩子抱进去午睡。' },

  // 墙饰灯具
  { id: 'sunset_window', name: '全景木框布帘窗', category: '墙饰灯具', tier: 'T2', price: 180, comfort: 8, description: '实时映出屋外晴云/晚霞/星空，点击即可拉合窗帘！' },
  { id: 'wall_shelf_wide', name: '一字实木壁架', category: '墙饰灯具', tier: 'T1', price: 65, comfort: 4, description: '高精细桌面摆件的最佳展示舞台，支持2px自由挪动。' },
  { id: 'framed_landscape_art', name: '像素风景装裱画', category: '墙饰灯具', tier: 'T1', price: 55, comfort: 5, description: '含落日、帆船、森林 3 款画作配色可切换。' },
  { id: 'wall_clock', name: '胡桃木圆挂钟', category: '墙饰灯具', tier: 'T1', price: 40, comfort: 2, description: '精致的复古圆钟，给墙面添一点时间气息。' },
  { id: 'pendant_ceiling_lamp', name: '暖光复古吊灯', category: '墙饰灯具', tier: 'T1', price: 95, comfort: 6, description: '悬挂于天花板，入夜后洒下一片柔和暖黄光晕（可点击开关）。' },
  { id: 'wall_sconce_lamp', name: '床头温馨壁灯', category: '墙饰灯具', tier: 'T1', price: 70, comfort: 5, description: '不占桌面空间的小巧壁灯，点击可切换开关。' },
  { id: 'floor_standing_lamp', name: '暖阳布罩落地灯', category: '墙饰灯具', tier: 'T2', price: 165, comfort: 7, description: '放在沙发旁最有电影氛围，支持随时开关灯。' },
  { id: 'room_divider_pillar', name: '顶天立地木隔断', category: '墙饰灯具', tier: 'T1', price: 90, comfort: 3, description: '用来划分厨房、卧室与浴室边界的实木结构柱。' },
  { id: 'stairwell_door_1f', name: '上下楼木楼梯门', category: '墙饰灯具', tier: 'T2', price: 320, comfort: 4, description: '连接 1F 与 2F 的温馨木楼梯，点击可快速切换楼层。' },

  // 桌面摆件 (2px micro-stacking!)
  { id: 'desktop_pc_set', name: '像素码农台式电脑', category: '桌面摆件', tier: 'T3', price: 780, comfort: 10, description: 'T3 生产力神器：Phase 4 可用来写代码、接单做独立游戏！' },
  { id: 'table_lamp_warm', name: '陶瓷暖光小台灯', category: '桌面摆件', tier: 'T1', price: 60, comfort: 5, description: '3种灯罩色+亮灭切换，晚上亮灯超治愈。' },
  { id: 'frying_pan_simmer', name: '滋滋煎蛋培根锅', category: '桌面摆件', tier: 'T1', price: 48, comfort: 3, description: '热气腾腾的铸铁平底锅，可放在灶台或餐桌上。' },
  { id: 'plate_omurice', name: '热腾腾家常料理盘', category: '桌面摆件', tier: 'T1', price: 35, comfort: 4, description: '含蛋包饭、草莓松饼、意面 3 款精致食物样式。' },
  { id: 'coffee_mug_steaming', name: '手冲热咖啡马克杯', category: '桌面摆件', tier: 'T1', price: 25, comfort: 2, description: '只要 25G 的每日小确幸，随时摆在桌角或茶几上。' },
  { id: 'potted_succulent', name: '迷你多肉/仙人掌盆栽', category: '桌面摆件', tier: 'T1', price: 38, comfort: 4, description: '多肉、开花仙人掌与常春藤 3 款造型，壁架桌面百搭。' },
  { id: 'chibi_figurine_trio', name: '小岛限定手办盲盒', category: '桌面摆件', tier: 'T1', price: 95, comfort: 6, description: '高精细二头身微缩手办（4款造型），收藏控最爱！' },
  { id: 'book_stack', name: '彩色精装书堆', category: '桌面摆件', tier: 'T1', price: 30, comfort: 3, description: '带着红色书签的厚书堆，桌面瞬间有书卷气。' },
  { id: 'sleeping_ginger_cat_prop', name: '午睡小猫咪摆件(预览)', category: '桌面摆件', tier: 'T1', price: 120, comfort: 10, description: '可放在地毯、沙发、床尾甚至宠物窝里打盹（Phase 5 将变成真·活体多宠物AI）。' },
];

export interface WallStyleDef {
  id: string;
  name: string;
  pricePerGrid: number;
  baseColor: string;
  stripeColor: string;
  wainscotColor: string;
  wainscotTrim: string;
  tileGrid?: boolean;
  brickPattern?: boolean;
}

export const WALL_STYLES: WallStyleDef[] = [
  { id: 'warm_stripe', name: '暖木竖纹墙纸', pricePerGrid: 15, baseColor: '#e9c793', stripeColor: '#dfba80', wainscotColor: '#8d5736', wainscotTrim: '#b47a4c' },
  { id: 'cream_plaster', name: '奶油杏暖白墙', pricePerGrid: 15, baseColor: '#f3e5cb', stripeColor: '#ead9b9', wainscotColor: '#a87049', wainscotTrim: '#cb9064' },
  { id: 'sage_botanical', name: '鼠尾草森系绿', pricePerGrid: 15, baseColor: '#b7cfb3', stripeColor: '#a8c2a4', wainscotColor: '#765038', wainscotTrim: '#9e6e4e' },
  { id: 'peach_gingham', name: '蜜桃粉格子纸', pricePerGrid: 15, baseColor: '#f2c8be', stripeColor: '#e7b5a9', wainscotColor: '#9b6447', wainscotTrim: '#c28864' },
  { id: 'aqua_bath_tile', name: '水蓝格纹瓷砖', pricePerGrid: 15, baseColor: '#d9eff2', stripeColor: '#a6dbe3', wainscotColor: '#7bbccc', wainscotTrim: '#eef9fa', tileGrid: true },
  { id: 'cozy_brick', name: '复古暖红砖墙', pricePerGrid: 15, baseColor: '#b56c54', stripeColor: '#95523d', wainscotColor: '#673d28', wainscotTrim: '#8b573b', brickPattern: true },
];

export interface FloorStyleDef {
  id: string;
  name: string;
  pricePerGrid: number;
  plankA: string;
  plankB: string;
  groutColor: string;
  tileMode?: boolean;
}

export const FLOOR_STYLES: FloorStyleDef[] = [
  { id: 'warm_oak', name: '暖橡木长条地板', pricePerGrid: 15, plankA: '#c17f48', plankB: '#b06f3b', groutColor: '#724221' },
  { id: 'dark_walnut', name: '深胡桃木地板', pricePerGrid: 15, plankA: '#7d4d2e', plankB: '#6d4125', groutColor: '#412312' },
  { id: 'birch_light', name: '日系浅原木板', pricePerGrid: 15, plankA: '#dec294', plankB: '#cfb181', groutColor: '#98774b' },
  { id: 'aqua_bath_floor', name: '防滑水蓝方砖', pricePerGrid: 15, plankA: '#b8e2e8', plankB: '#91ccd6', groutColor: '#6da5b0', tileMode: true },
  { id: 'cream_tile', name: '奶油格纹地砖', pricePerGrid: 15, plankA: '#efe2c7', plankB: '#dfd0b0', groutColor: '#b59d78', tileMode: true },
];

export const CATALOG_MAP = new Map<string, FurnitureCatalogDef>(
  CATALOG_ITEMS.map((item) => [item.id, item])
);
