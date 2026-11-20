"""Build the HD 2D Cartoon Sprite Atlas, Furniture Metadata, Seamless Surfaces & Character Registry."""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC_ASSETS = ROOT / "assets_cartoon"
SRC_TRANS = SRC_ASSETS / "transparent"
OUT_ASSETS = ROOT / "public" / "assets"
OUT_SURFACES = OUT_ASSETS / "surfaces"
OUT_BACKDROPS = OUT_ASSETS / "backdrops"

SCALE = 0.82
OUTLINE = (43, 24, 16, 255)  # #2b1810
WALL_HEIGHT = 322  # CEILING_BOTTOM_Y (16) .. WALL_FLOOR_Y (338)


def load_scaled(name: str, scale: float = SCALE, target_size: tuple[int, int] | None = None) -> Image.Image:
    im = Image.open(SRC_TRANS / f"{name}.png").convert("RGBA")
    if target_size is not None:
        return im.resize(target_size, Image.Resampling.LANCZOS)
    nw = max(1, round(im.width * scale))
    nh = max(1, round(im.height * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def recolor_hsv_shift(
    im: Image.Image,
    hue_shift_deg: float = 0.0,
    sat_mult: float = 1.0,
    val_mult: float = 1.0,
    protect_neutrals: bool = True,
    warm_wood_only: bool = False,
) -> Image.Image:
    """Shift hue/sat/val smoothly while preserving dark outlines (#2b1810) and near-white highlights."""
    arr = np.array(im.convert("RGBA"), dtype=np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    lum = (r + g + b) / 3.0
    chroma = mx - mn

    # Do not mutate outlines, shadows, or crisp neutral highlights
    mask = (a > 40) & (lum > 72)
    if protect_neutrals:
        mask &= (chroma > 16)
    if warm_wood_only:
        # Target warm golden/brown wood hues cleanly while keeping cool plates/glass intact
        mask &= (r > g) & (g > b - 10)

    # RGB -> HSV on masked pixels
    rgb_norm = arr[..., :3] / 255.0
    rn, gn, bn = rgb_norm[..., 0], rgb_norm[..., 1], rgb_norm[..., 2]
    cmax = np.maximum(np.maximum(rn, gn), bn)
    cmin = np.minimum(np.minimum(rn, gn), bn)
    delta = cmax - cmin

    h = np.zeros_like(cmax)
    nz = delta > 1e-5
    r_dom = nz & (cmax == rn)
    g_dom = nz & (cmax == gn)
    b_dom = nz & (cmax == bn)
    h[r_dom] = ((gn[r_dom] - bn[r_dom]) / delta[r_dom]) % 6.0
    h[g_dom] = ((bn[g_dom] - rn[g_dom]) / delta[g_dom]) + 2.0
    h[b_dom] = ((rn[b_dom] - gn[b_dom]) / delta[b_dom]) + 4.0
    h = (h * 60.0 + hue_shift_deg) % 360.0

    s = np.where(cmax > 1e-5, delta / np.maximum(cmax, 1e-5), 0.0)
    v = cmax

    s = np.clip(s * sat_mult, 0.0, 1.0)
    v = np.clip(v * val_mult, 0.0, 1.0)

    # HSV -> RGB
    c = v * s
    x = c * (1.0 - np.abs((h / 60.0) % 2.0 - 1.0))
    m = v - c
    ro = np.zeros_like(h)
    go = np.zeros_like(h)
    bo = np.zeros_like(h)
    sec = (h // 60).astype(int)
    for sec_i, (ra, ga, ba) in enumerate([(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)]):
        sm = sec == sec_i
        ro[sm] = ra[sm] if isinstance(ra, np.ndarray) else ra
        go[sm] = ga[sm] if isinstance(ga, np.ndarray) else ga
        bo[sm] = ba[sm] if isinstance(ba, np.ndarray) else ba

    out = arr.copy()
    out[mask, 0] = np.clip((ro[mask] + m[mask]) * 255.0, 0, 255)
    out[mask, 1] = np.clip((go[mask] + m[mask]) * 255.0, 0, 255)
    out[mask, 2] = np.clip((bo[mask] + m[mask]) * 255.0, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def make_unlit_lamp(im: Image.Image) -> Image.Image:
    """Cool & dim a lit lamp sprite into a cozy unlit OFF variant while keeping #2b1810 outlines crisp."""
    return recolor_hsv_shift(im, hue_shift_deg=-15, sat_mult=0.35, val_mult=0.76, protect_neutrals=False)


def build_cartoon_divider_pillars() -> list[tuple[str, Image.Image]]:
    """Create sleek #2b1810-outlined smooth 2D cartoon timber room pillars (28 x 322 px)."""
    W, H = 28, WALL_HEIGHT
    specs = [
        ("暖橡木隔断", (196, 134, 78, 255), (218, 158, 102, 255), (154, 96, 52, 255)),
        ("深胡桃隔断", (128, 82, 54, 255), (154, 104, 70, 255), (96, 56, 36, 255)),
        ("奶油白木柱", (242, 232, 212, 255), (252, 246, 232, 255), (210, 196, 174, 255)),
    ]
    out: list[tuple[str, Image.Image]] = []
    S = 2
    for label, main_col, hi_col, sh_col in specs:
        im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        # Main column body + top/bottom molding caps
        d.rectangle([4 * S, 0, (W - 4) * S, H * S], fill=main_col, outline=OUTLINE, width=2 * S)
        d.rectangle([7 * S, 6 * S, 11 * S, (H - 6) * S], fill=hi_col)
        d.rectangle([(W - 9) * S, 6 * S, (W - 6) * S, (H - 6) * S], fill=sh_col)
        d.rounded_rectangle([1 * S, 0, (W - 1) * S, 18 * S], radius=3 * S, fill=main_col, outline=OUTLINE, width=2 * S)
        d.rounded_rectangle([1 * S, (H - 18) * S, (W - 1) * S, H * S], radius=3 * S, fill=main_col, outline=OUTLINE, width=2 * S)
        out.append((label, im.resize((W, H), Image.Resampling.LANCZOS)))
    return out


def build_sunset_window_variants() -> tuple[Image.Image, Image.Image, dict]:
    """Punch the 4 sky glass panes transparent for live dynamic sky, and draw a closed-curtain variant."""
    open_im = load_scaled("sunset_window")
    w, h = open_im.size
    arr = np.array(open_im)
    r, g, b, a = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int), arr[..., 3]

    # Inner glass region strictly inside wood window frame and between curtains
    glass_rect = {"x": 34, "y": 14, "w": 76, "h": 110}
    yy, xx = np.mgrid[0:h, 0:w]
    in_glass = (xx >= 32) & (xx <= w - 32) & (yy >= 12) & (yy <= h - 18)
    # Sky blue (b >= r + 6) OR white/light clouds inside glass, plus 1px AA cloud fringe next to mullions
    is_sky = in_glass & (a > 200) & ((b >= r + 4) | ((r > 205) & (g > 212) & (b > 212) & (b >= r - 4)))
    arr_open = arr.copy()
    arr_open[is_sky, 3] = 0
    open_punched = Image.fromarray(arr_open, "RGBA")

    # Closed curtains variant: draw warm cozy pleated curtains meeting in center over glass panes
    closed_im = open_punched.copy()
    cd = ImageDraw.Draw(closed_im)
    cx = w // 2
    cd.rectangle([28, 12, cx - 1, h - 18], fill=(250, 224, 192, 255), outline=(43, 24, 16, 255), width=2)
    cd.rectangle([cx, 12, w - 28, h - 18], fill=(246, 216, 182, 255), outline=(43, 24, 16, 255), width=2)
    for fx in range(38, cx - 4, 10):
        cd.line([fx, 14, fx - 1, h - 20], fill=(224, 186, 148, 255), width=2)
    for fx in range(cx + 10, w - 34, 10):
        cd.line([fx, 14, fx + 1, h - 20], fill=(220, 180, 142, 255), width=2)
    # Re-composite top rod & bottom window sill from original sprite so trim stays crisp
    closed_im.paste(open_im.crop((0, 0, w, 12)), (0, 0), open_im.crop((0, 0, w, 12)))
    closed_im.paste(open_im.crop((0, h - 18, w, h)), (0, h - 18), open_im.crop((0, h - 18, w, h)))
    return open_punched, closed_im, glass_rect


def build_chibi_figurine_variants() -> list[tuple[str, Image.Image]]:
    """Build 3 crisp miniature shelf figurine standees from our JP journal char sprites."""
    base_girl = Image.open(SRC_TRANS / "char_girl_basic.png").convert("RGBA").resize((30, 52), Image.Resampling.LANCZOS)
    specs = [
        ("栗发毛衣款", base_girl),
        ("海盐薄荷款", recolor_hsv_shift(base_girl, hue_shift_deg=110, sat_mult=1.05)),
        ("樱花草莓款", recolor_hsv_shift(base_girl, hue_shift_deg=-25, sat_mult=1.15)),
    ]
    out: list[tuple[str, Image.Image]] = []
    for label, fig in specs:
        canvas = Image.new("RGBA", (34, 56), (0, 0, 0, 0))
        d = ImageDraw.Draw(canvas)
        d.rounded_rectangle([3, 47, 31, 55], radius=3, fill=(176, 118, 72, 255), outline=OUTLINE, width=2)
        canvas.paste(fig, (2, 0), fig)
        out.append((label, canvas))
    return out


def pack_atlas(entries: list[tuple[str, str, int, Image.Image]]) -> tuple[Image.Image, dict]:
    """Pack (item_id, variant_name, variant_index, rgba) cleanly with 4px transparent gutter."""
    pad = 4
    max_w = 2048
    sorted_entries = sorted(entries, key=lambda e: (-e[3].height, -e[3].width))

    x, y, row_h = pad, pad, 0
    placements: list[tuple[str, str, int, int, int, Image.Image]] = []
    for item_id, v_name, v_idx, im in sorted_entries:
        w, h = im.size
        if x + w + pad > max_w:
            x = pad
            y += row_h + pad
            row_h = 0
        placements.append((item_id, v_name, v_idx, x, y, im))
        x += w + pad
        row_h = max(row_h, h)

    total_h = y + row_h + pad
    atlas = Image.new("RGBA", (max_w, total_h), (0, 0, 0, 0))
    for _, _, _, px, py, im in placements:
        atlas.paste(im, (px, py), im)

    return atlas, {
        "placements": [
            (item_id, v_name, v_idx, px, py, im.width, im.height)
            for item_id, v_name, v_idx, px, py, im in placements
        ]
    }


def main() -> None:
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    OUT_SURFACES.mkdir(parents=True, exist_ok=True)
    OUT_BACKDROPS.mkdir(parents=True, exist_ok=True)

    # 1. Copy seamless wallpapers, floors, and 960x540 backdrops into public/assets/
    for p in sorted((SRC_ASSETS / "wallpapers").glob("*.png")):
        shutil.copy2(p, OUT_SURFACES / p.name)
    for p in sorted((SRC_ASSETS / "floors").glob("*.png")):
        shutil.copy2(p, OUT_SURFACES / p.name)
    for p in sorted((SRC_ASSETS / "backdrops").glob("*.png")):
        shutil.copy2(p, OUT_BACKDROPS / p.name)

    entries: list[tuple[str, str, int, Image.Image]] = []
    item_meta: dict[str, dict] = {}
    char_frames: dict[str, dict] = {}

    def register_item(item_id: str, meta: dict, variants: list[tuple[str, Image.Image]]) -> None:
        w, h = variants[0][1].size
        item_meta[item_id] = {**meta, "w": w, "h": h, "variants": []}
        for idx, (vname, im) in enumerate(variants):
            if im.size != (w, h):
                im = im.resize((w, h), Image.Resampling.LANCZOS)
            entries.append((item_id, vname, idx, im))

    # --- Structural & Wall Items ---
    pillars = build_cartoon_divider_pillars()
    register_item("room_divider_pillar", {"layer": "wall", "anchor": "floor"}, pillars)

    stairs_1 = load_scaled("stairwell_door")
    stairs_2 = recolor_hsv_shift(stairs_1, hue_shift_deg=-10, sat_mult=0.9, val_mult=0.92, warm_wood_only=True)
    register_item(
        "stairwell_door_1f",
        {"layer": "wall", "anchor": "floor", "isStairs": True},
        [("1F楼梯口", stairs_1), ("2F楼梯口", stairs_2)],
    )

    door_1 = load_scaled("room_door")
    door_2 = recolor_hsv_shift(door_1, hue_shift_deg=-14, val_mult=0.88, warm_wood_only=True)
    register_item("room_door", {"layer": "wall", "anchor": "floor"}, [("暖木玻璃门", door_1), ("胡桃玻璃门", door_2)])

    win_open, win_closed, glass_rect = build_sunset_window_variants()
    register_item(
        "sunset_window",
        {"layer": "wall", "toggleState": True, "glassRect": glass_rect},
        [("拉开窗帘", win_open), ("拉上窗帘", win_closed)],
    )

    kcab_1 = load_scaled("kitchen_wall_cabinet")
    kcab_2 = recolor_hsv_shift(kcab_1, hue_shift_deg=18, sat_mult=0.35, val_mult=1.08, warm_wood_only=True)
    register_item("kitchen_wall_cabinet", {"layer": "wall"}, [("暖橡木", kcab_1), ("奶油白木", kcab_2)])

    shelf_1 = load_scaled("wall_shelf_wide")
    shelf_2 = recolor_hsv_shift(shelf_1, hue_shift_deg=-8, val_mult=0.72, warm_wood_only=True)
    register_item(
        "wall_shelf_wide",
        {"layer": "wall", "surfaces": [{"y": 11, "x0": 14, "x1": 119}]},
        [("暖橡木", shelf_1), ("深胡桃", shelf_2)],
    )

    art_1 = load_scaled("framed_landscape_art")
    art_2 = recolor_hsv_shift(art_1, hue_shift_deg=140, sat_mult=1.05)
    art_3 = recolor_hsv_shift(art_1, hue_shift_deg=65, sat_mult=0.95)
    register_item("framed_landscape_art", {"layer": "wall"}, [("落日余晖", art_1), ("海风晴空", art_2), ("森林翠绿", art_3)])

    register_item("wall_clock", {"layer": "wall"}, [("默认", load_scaled("wall_clock"))])

    pendant_on = load_scaled("pendant_ceiling_lamp")
    register_item(
        "pendant_ceiling_lamp",
        {"layer": "wall", "anchor": "ceiling", "light": {"dx": pendant_on.width // 2, "dy": round(pendant_on.height * 0.78), "radius": 215}, "toggleState": True},
        [("开灯", pendant_on), ("关灯", make_unlit_lamp(pendant_on))],
    )

    sconce_on = load_scaled("wall_sconce_lamp")
    register_item(
        "wall_sconce_lamp",
        {"layer": "wall", "light": {"dx": sconce_on.width // 2, "dy": round(sconce_on.height * 0.38), "radius": 145}, "toggleState": True},
        [("开灯", sconce_on), ("关灯", make_unlit_lamp(sconce_on))],
    )

    rail_on = load_scaled("balcony_railing_lights", scale=0.80)
    register_item(
        "balcony_railing_lights",
        {"layer": "wall", "anchor": "floor", "light": {"dx": rail_on.width // 2, "dy": 14, "radius": 200}, "toggleState": True},
        [("暖灯亮", rail_on), ("暖灯灭", make_unlit_lamp(rail_on))],
    )

    # --- Floor Furniture ---
    fridge_1 = load_scaled("retro_fridge")
    fridge_2 = recolor_hsv_shift(fridge_1, hue_shift_deg=0, sat_mult=0.18, val_mult=1.08)
    fridge_3 = recolor_hsv_shift(fridge_1, hue_shift_deg=185, sat_mult=1.1, val_mult=1.02)
    fridge_4 = recolor_hsv_shift(fridge_1, hue_shift_deg=-105, sat_mult=1.25, val_mult=1.05)
    register_item(
        "retro_fridge",
        {"layer": "floor", "footDepth": 30, "surfaces": [{"y": 14, "x0": 16, "x1": 100}]},
        [("复古薄荷绿", fridge_1), ("奶油香草白", fridge_2), ("樱花草莓粉", fridge_3), ("焦糖奶黄", fridge_4)],
    )

    bs_1 = load_scaled("tall_bookshelf")
    bs_2 = recolor_hsv_shift(bs_1, hue_shift_deg=-8, val_mult=0.72, warm_wood_only=True)
    register_item(
        "tall_bookshelf",
        {"layer": "floor", "footDepth": 26, "surfaces": [{"y": 8, "x0": 12, "x1": 148}]},
        [("暖橡木", bs_1), ("深胡桃", bs_2)],
    )

    wd_1 = load_scaled("wardrobe")
    wd_2 = recolor_hsv_shift(wd_1, hue_shift_deg=-10, val_mult=0.76, warm_wood_only=True)
    register_item(
        "wardrobe",
        {"layer": "floor", "footDepth": 30, "surfaces": [{"y": 8, "x0": 12, "x1": 158}]},
        [("奶油撞木", wd_1), ("胡桃复古", wd_2)],
    )

    stove_1 = load_scaled("kitchen_stove_counter")
    stove_2 = recolor_hsv_shift(stove_1, hue_shift_deg=-10, val_mult=0.74, warm_wood_only=True)
    register_item(
        "kitchen_stove_counter",
        {"layer": "floor", "footDepth": 28, "surfaces": [{"y": 40, "x0": 76, "x1": 144}]},
        [("暖橡木", stove_1), ("深胡桃", stove_2)],
    )

    island_1 = load_scaled("kitchen_island_counter")
    island_2 = recolor_hsv_shift(island_1, hue_shift_deg=-10, val_mult=0.78, warm_wood_only=True)
    register_item(
        "kitchen_island_counter",
        {"layer": "floor", "footDepth": 28, "surfaces": [{"y": 22, "x0": 12, "x1": 150}]},
        [("鼠尾草木柜", island_1), ("焦糖胡桃", island_2)],
    )

    dt_1 = load_scaled("dining_table")
    dt_2 = recolor_hsv_shift(dt_1, hue_shift_deg=-10, val_mult=0.72, warm_wood_only=True)
    register_item(
        "dining_table",
        {"layer": "floor", "footDepth": 32, "surfaces": [{"y": 28, "x0": 12, "x1": 162}]},
        [("暖橡木", dt_1), ("深胡桃", dt_2)],
    )

    dc_1 = load_scaled("dining_chair")
    dc_2 = recolor_hsv_shift(dc_1, hue_shift_deg=-10, val_mult=0.72, warm_wood_only=True)
    register_item(
        "dining_chair",
        {"layer": "floor", "footDepth": 24, "flippable": True, "seats": [{"dx": dc_1.width // 2, "seatY": 64}]},
        [("暖橡木椅", dc_1), ("深胡桃椅", dc_2)],
    )

    desk_1 = load_scaled("study_desk")
    desk_2 = recolor_hsv_shift(desk_1, hue_shift_deg=-10, val_mult=0.74, warm_wood_only=True)
    register_item(
        "study_desk",
        {"layer": "floor", "footDepth": 28, "surfaces": [{"y": 20, "x0": 12, "x1": 153}]},
        [("暖橡木", desk_1), ("深胡桃", desk_2)],
    )

    sofa_1 = load_scaled("plush_sofa")
    sofa_2 = recolor_hsv_shift(sofa_1, hue_shift_deg=65, sat_mult=1.05)
    sofa_3 = recolor_hsv_shift(sofa_1, hue_shift_deg=-115, sat_mult=0.55, val_mult=1.06)
    sofa_4 = recolor_hsv_shift(sofa_1, hue_shift_deg=195, sat_mult=0.95)
    register_item(
        "plush_sofa",
        {
            "layer": "floor",
            "footDepth": 28,
            "surfaces": [{"y": 66, "x0": 36, "x1": 206}],
            "seats": [
                {"dx": 84, "seatY": 78},
                {"dx": 158, "seatY": 78},
            ],
        },
        [("森系鼠尾草绿", sofa_1), ("海盐雾霾蓝", sofa_2), ("暖燕麦奶茶", sofa_3), ("莓果豆沙粉", sofa_4)],
    )

    ct_1 = load_scaled("coffee_table")
    ct_2 = recolor_hsv_shift(ct_1, hue_shift_deg=-8, val_mult=0.74, warm_wood_only=True)
    register_item(
        "coffee_table",
        {"layer": "floor", "footDepth": 24, "surfaces": [{"y": 20, "x0": 18, "x1": 121}]},
        [("暖橡木", ct_1), ("深胡桃", ct_2)],
    )

    flamp_on = load_scaled("floor_standing_lamp")
    register_item(
        "floor_standing_lamp",
        {"layer": "floor", "footDepth": 22, "light": {"dx": flamp_on.width // 2, "dy": 42, "radius": 195}, "toggleState": True},
        [("开灯", flamp_on), ("关灯", make_unlit_lamp(flamp_on))],
    )

    bed_1 = load_scaled("cozy_patchwork_bed")
    bed_2 = recolor_hsv_shift(bed_1, hue_shift_deg=25, sat_mult=1.1)
    bed_3 = recolor_hsv_shift(bed_1, hue_shift_deg=-55, sat_mult=0.95)
    register_item(
        "cozy_patchwork_bed",
        {
            "layer": "floor",
            "footDepth": 36,
            "flippable": True,
            "surfaces": [{"y": 104, "x0": 34, "x1": 212}],
            "sleepAnchor": {"dx": 123, "dy": 122},
        },
        [("晴空几何拼被", bed_1), ("深蓝星空被", bed_2), ("暖樱桃格被", bed_3)],
    )

    ns_1 = load_scaled("bedside_nightstand")
    ns_2 = recolor_hsv_shift(ns_1, hue_shift_deg=-8, val_mult=0.74, warm_wood_only=True)
    register_item(
        "bedside_nightstand",
        {"layer": "floor", "footDepth": 24, "surfaces": [{"y": 20, "x0": 10, "x1": 68}]},
        [("鼠尾草木柜", ns_1), ("深胡桃木柜", ns_2)],
    )

    register_item("fiddle_leaf_plant", {"layer": "floor", "footDepth": 26}, [("默认", load_scaled("fiddle_leaf_plant"))])
    register_item("clawfoot_bathtub", {"layer": "floor", "footDepth": 30, "flippable": True}, [("默认", load_scaled("clawfoot_bathtub"))])
    register_item("bathroom_vanity", {"layer": "floor", "footDepth": 26}, [("默认", load_scaled("bathroom_vanity"))])
    register_item("cozy_toilet", {"layer": "floor", "footDepth": 24, "flippable": True}, [("默认", load_scaled("cozy_toilet"))])

    cat_tree = load_scaled("cat_tree_condo")
    register_item(
        "cat_tree_condo",
        {"layer": "floor", "footDepth": 28, "surfaces": [{"y": 11, "x0": 12, "x1": 70}, {"y": 78, "x0": 66, "x1": 122}]},
        [("默认", cat_tree)],
    )

    pb_1 = load_scaled("plush_pet_bed")
    pb_2 = recolor_hsv_shift(pb_1, hue_shift_deg=135, sat_mult=0.85)
    pb_3 = recolor_hsv_shift(pb_1, hue_shift_deg=35, sat_mult=1.0)
    register_item(
        "plush_pet_bed",
        {"layer": "floor", "footDepth": 24, "surfaces": [{"y": 38, "x0": 22, "x1": 75}]},
        [("莓果软垫窝", pb_1), ("薄荷云朵窝", pb_2), ("焦糖南瓜窝", pb_3)],
    )

    # Wave 2 Furniture / Balcony / Street Props in Catalog
    egg = load_scaled("balcony_egg_chair")
    register_item(
        "balcony_egg_chair",
        {"layer": "floor", "footDepth": 26, "seats": [{"dx": egg.width // 2, "seatY": 146}]},
        [("原木藤编款", egg)],
    )
    patio = load_scaled("patio_lounge_chair")
    register_item(
        "patio_lounge_chair",
        {"layer": "floor", "footDepth": 28, "flippable": True, "seats": [{"dx": round(patio.width * 0.44), "seatY": 70}]},
        [("岩灰休闲椅", patio)],
    )
    bench = load_scaled("street_bench")
    register_item(
        "street_bench",
        {"layer": "floor", "footDepth": 26, "seats": [{"dx": 56, "seatY": 64}, {"dx": 116, "seatY": 64}]},
        [("实木长椅", bench)],
    )
    slamp_on = load_scaled("street_lamp_post")
    register_item(
        "street_lamp_post",
        {"layer": "floor", "footDepth": 22, "light": {"dx": slamp_on.width // 2, "dy": 36, "radius": 215}, "toggleState": True},
        [("开灯", slamp_on), ("关灯", make_unlit_lamp(slamp_on))],
    )
    register_item("street_bush_flowers", {"layer": "floor", "footDepth": 26}, [("花丛灌木", load_scaled("street_bush_flowers"))])

    # --- Rugs ---
    rug_1 = load_scaled("persian_cozy_rug")
    rug_2 = recolor_hsv_shift(rug_1, hue_shift_deg=180, sat_mult=0.82)
    rug_3 = recolor_hsv_shift(rug_1, hue_shift_deg=90, sat_mult=0.80)
    register_item(
        "persian_cozy_rug",
        {"layer": "rug", "surfaces": [{"y": 62, "x0": 38, "x1": 238}]},
        [("暖橘菱格毯", rug_1), ("海盐蓝纹毯", rug_2), ("森系橄榄毯", rug_3)],
    )

    mat_1 = load_scaled("bath_checkered_mat")
    mat_2 = recolor_hsv_shift(mat_1, hue_shift_deg=190, sat_mult=0.95)
    mat_3 = recolor_hsv_shift(mat_1, hue_shift_deg=45, sat_mult=1.05)
    register_item(
        "bath_checkered_mat",
        {"layer": "rug", "surfaces": [{"y": 32, "x0": 22, "x1": 116}]},
        [("蜜桃粉格垫", mat_1), ("水蓝格纹垫", mat_2), ("奶油鹅黄垫", mat_3)],
    )

    # --- Tabletop Props ---
    register_item("desktop_pc_set", {"layer": "prop"}, [("默认", load_scaled("desktop_pc_set"))])

    tl_cream = load_scaled("table_lamp_warm", scale=0.78)
    tl_pink = recolor_hsv_shift(tl_cream, hue_shift_deg=-40, sat_mult=1.35)
    tl_green = recolor_hsv_shift(tl_cream, hue_shift_deg=65, sat_mult=1.2)
    register_item(
        "table_lamp_warm",
        {"layer": "prop", "light": {"dx": tl_cream.width // 2, "dy": 22, "radius": 150}},
        [
            ("奶油暖灯(亮)", tl_cream),
            ("奶油暖灯(灭)", make_unlit_lamp(tl_cream)),
            ("樱花粉灯(亮)", tl_pink),
            ("樱花粉灯(灭)", make_unlit_lamp(tl_pink)),
            ("抹茶绿灯(亮)", tl_green),
            ("抹茶绿灯(灭)", make_unlit_lamp(tl_green)),
        ],
    )

    register_item("frying_pan_simmer", {"layer": "prop"}, [("默认", load_scaled("frying_pan_simmer"))])

    omurice_1 = load_scaled("plate_omurice")
    omurice_2 = recolor_hsv_shift(omurice_1, hue_shift_deg=-30, sat_mult=1.05)
    register_item("plate_omurice", {"layer": "prop"}, [("日式蛋包饭", omurice_1), ("草莓特饮拼盘", omurice_2)])

    mug_1 = load_scaled("coffee_mug_steaming")
    mug_2 = recolor_hsv_shift(mug_1, hue_shift_deg=110, sat_mult=1.05)
    mug_3 = recolor_hsv_shift(mug_1, hue_shift_deg=-35, sat_mult=1.15)
    register_item("coffee_mug_steaming", {"layer": "prop"}, [("焦糖咖啡杯", mug_1), ("薄荷马克杯", mug_2), ("草莓粉杯", mug_3)])

    suc_1 = load_scaled("potted_succulent")
    suc_2 = recolor_hsv_shift(suc_1, hue_shift_deg=-70, sat_mult=1.15)
    register_item("potted_succulent", {"layer": "prop"}, [("圆润多肉", suc_1), ("紫霞多肉", suc_2)])

    register_item("chibi_figurine_trio", {"layer": "prop"}, build_chibi_figurine_variants())
    register_item("book_stack", {"layer": "prop"}, [("默认", load_scaled("book_stack"))])
    register_item("strawberry_cake", {"layer": "prop"}, [("草莓奶油蛋糕", load_scaled("strawberry_cake"))])

    cat_1 = load_scaled("sleeping_ginger_cat")
    cat_2 = recolor_hsv_shift(cat_1, hue_shift_deg=0, sat_mult=0.15, val_mult=0.88)
    cat_3 = recolor_hsv_shift(cat_1, hue_shift_deg=180, sat_mult=0.25, val_mult=1.02)
    register_item("sleeping_ginger_cat_prop", {"layer": "prop"}, [("橘猫团团", cat_1), ("奶牛黑灰", cat_2), ("银渐层点点", cat_3)])

    # --- Phase 2: All Original Japanese Journal Character Sprites + Shiba Inu ---
    character_sprite_keys = [
        "char_girl_basic",
        "char_girl_walk_1",
        "char_girl_walk_2",
        "char_girl_sit",
        "char_girl_happy_wave",
        "char_girl_sleep",
        "char_girl_outfit_pajama",
        "char_girl_outfit_summer",
        "char_girl_outfit_coat",
        "char_boy_basic",
        "char_boy_walk_1",
        "char_boy_walk_2",
        "char_boy_sit",
        "char_boy_happy_wave",
        "char_boy_sleep",
        "char_boy_outfit_pajama",
        "char_boy_outfit_summer",
        "char_boy_outfit_sport",
        "char_grandpa",
        "char_florist_girl",
        "char_chef_barista",
        "char_toddler_kid",
        "shiba_dog_pet",
    ]
    for ck in character_sprite_keys:
        cim = load_scaled(ck)
        entries.append((f"__char__:{ck}", ck, 0, cim))
        char_frames[ck] = {"w": cim.width, "h": cim.height}

    atlas_img, packed = pack_atlas(entries)

    for item_id, v_name, v_idx, px, py, pw, ph in packed["placements"]:
        if item_id.startswith("__char__:"):
            ck = item_id.split(":", 1)[1]
            char_frames[ck].update({"x": px, "y": py, "w": pw, "h": ph})
        else:
            item_meta[item_id]["variants"].append({"index": v_idx, "name": v_name, "x": px, "y": py, "w": pw, "h": ph})

    # Sort variants by index cleanly
    for meta in item_meta.values():
        meta["variants"].sort(key=lambda v: v["index"])

    atlas_json = {
        "gridSize": 60,
        "artStyle": "cartoon_jp_journal",
        "atlasWidth": atlas_img.width,
        "atlasHeight": atlas_img.height,
        "items": item_meta,
        "characters": char_frames,
    }

    atlas_img.save(OUT_ASSETS / "furniture_atlas.png", "PNG", optimize=True)
    (OUT_ASSETS / "furniture_atlas.json").write_text(
        json.dumps(atlas_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"Atlas built: {atlas_img.size}, {len(item_meta)} furniture items, "
        f"{len(char_frames)} character sprites, {len(list(OUT_SURFACES.glob('*.png')))} surface tiles"
    )

    # Generate visual surface & seat check sheet for human/agent verification
    dbg_items = [
        "plush_sofa", "dining_table", "kitchen_stove_counter", "study_desk",
        "cozy_patchwork_bed", "cat_tree_condo", "retro_fridge", "sunset_window",
        "table_lamp_warm", "balcony_egg_chair", "patio_lounge_chair", "street_bench",
        "persian_cozy_rug", "wall_shelf_wide",
    ]
    dw, dh = 1320, 740
    dbg = Image.new("RGB", (dw, dh), (235, 238, 244))
    dd = ImageDraw.Draw(dbg)
    dx, dy, rh = 16, 16, 0
    for k in dbg_items:
        m = item_meta[k]
        v = m["variants"][0]
        crop = atlas_img.crop((v["x"], v["y"], v["x"] + v["w"], v["y"] + v["h"]))
        if dx + v["w"] + 20 > dw:
            dx = 16; dy += rh + 32; rh = 0
        # Behind window, draw blue sunset sample so punched glass proves transparent!
        if k == "sunset_window":
            dd.rectangle([dx, dy, dx + v["w"], dy + v["h"]], fill=(246, 152, 118))
        dbg.paste(crop, (dx, dy), crop)
        dd.rectangle([dx, dy, dx + v["w"], dy + v["h"]], outline=(160, 165, 180))
        for s in m.get("surfaces", []):
            dd.line([dx + s["x0"], dy + s["y"], dx + s["x1"], dy + s["y"]], fill=(0, 225, 255), width=3)
        for st in m.get("seats", []):
            dd.ellipse([dx + st["dx"] - 5, dy + st["seatY"] - 5, dx + st["dx"] + 5, dy + st["seatY"] + 5], fill=(255, 60, 140))
        dd.text((dx, dy + v["h"] + 4), k, fill=(30, 30, 30))
        dx += v["w"] + 20
        rh = max(rh, v["h"])
    dbg.save(ROOT / "tools" / "debug_cartoon_atlas_check.png", "PNG")


if __name__ == "__main__":
    main()
