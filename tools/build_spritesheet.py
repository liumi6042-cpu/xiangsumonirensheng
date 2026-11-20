"""
HD 2D Pixel Art Sprite Extraction, Purification & Packing Pipeline.
Processes the 4 illustrated 3x3 HD pixel-art source sheets in tools/hd_sources/
at our 960x540 (1 grid = 60px) HD standard, adds 2.5D architectural sprites,
generates color/state variants, packs into public/assets/furniture_atlas.png + .json,
and outputs tools/debug_extracted_preview.png for visual QA on a dark background.
"""

from __future__ import annotations

import colorsys
import json
from collections import deque
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "tools" / "hd_sources"
OUT_DIR = ROOT / "public" / "assets"
RAW_DIR = ROOT / "tools" / "assets_raw"

RGBA = Tuple[int, int, int, int]
OUTLINE = (43, 24, 16, 255)  # #2b1810 crisp warm dark umber

# Sheet slot definitions: (sheet_filename, row, col, item_id, target_w_or_none, target_h_or_none, meta)
SLOT_SPECS = [
    # Sheet 1: Kitchen & Dining
    ("sheet1_kitchen.jpg", 0, 0, "retro_fridge", None, 144, {
        "layer": "floor", "footDepth": 26, "surfaceRatio": (0.09, 0.14, 0.84), "variantType": "fridge",
    }),
    ("sheet1_kitchen.jpg", 0, 1, "kitchen_stove_counter", 142, None, {
        "layer": "floor", "footDepth": 22, "surfaceRatio": (0.25, 0.06, 0.94), "variantType": "wood_dark",
    }),
    ("sheet1_kitchen.jpg", 0, 2, "kitchen_island_counter", 98, None, {
        "layer": "floor", "footDepth": 20, "surfaceRatio": (0.16, 0.06, 0.94), "variantType": "wood_teal",
    }),
    ("sheet1_kitchen.jpg", 1, 0, "kitchen_wall_cabinet", 118, None, {
        "layer": "wall", "variantType": "wood_birch",
    }),
    ("sheet1_kitchen.jpg", 1, 1, "dining_table", 122, None, {
        "layer": "floor", "footDepth": 26, "surfaceRatio": (0.19, 0.06, 0.94), "variantType": "wood_dark",
    }),
    ("sheet1_kitchen.jpg", 1, 2, "dining_chair", None, 78, {
        "layer": "floor", "footDepth": 16, "flippable": True, "variantType": "chair",
    }),
    ("sheet1_kitchen.jpg", 2, 0, "frying_pan_simmer", 44, None, {
        "layer": "prop",
    }),
    ("sheet1_kitchen.jpg", 2, 1, "plate_omurice", 38, None, {
        "layer": "prop", "variantType": "omurice",
    }),
    ("sheet1_kitchen.jpg", 2, 2, "coffee_mug_steaming", None, 28, {
        "layer": "prop", "variantType": "mug",
    }),

    # Sheet 2: Living & Bedroom
    ("sheet2_living_bed.jpg", 0, 0, "plush_sofa", 172, None, {
        "layer": "floor", "footDepth": 22, "surfaceRatio": (0.58, 0.14, 0.86), "variantType": "sofa",
    }),
    ("sheet2_living_bed.jpg", 0, 1, "coffee_table", 94, None, {
        "layer": "floor", "footDepth": 18, "surfaceRatio": (0.20, 0.06, 0.94), "variantType": "wood_dark",
    }),
    ("sheet2_living_bed.jpg", 0, 2, "tall_bookshelf", None, 152, {
        "layer": "floor", "footDepth": 22, "surfaceRatio": (0.06, 0.08, 0.92), "variantType": "wood_dark",
    }),
    ("sheet2_living_bed.jpg", 1, 0, "cozy_patchwork_bed", 184, None, {
        "layer": "floor", "footDepth": 28, "flippable": True, "surfaceRatio": (0.52, 0.34, 0.86), "variantType": "bed",
    }),
    ("sheet2_living_bed.jpg", 1, 1, "bedside_nightstand", None, 62, {
        "layer": "floor", "footDepth": 18, "surfaceRatio": (0.16, 0.08, 0.92), "variantType": "wood_dark",
    }),
    ("sheet2_living_bed.jpg", 1, 2, "study_desk", 124, None, {
        "layer": "floor", "footDepth": 22, "surfaceRatio": (0.18, 0.06, 0.94), "variantType": "wood_dark",
    }),
    ("sheet2_living_bed.jpg", 2, 0, "persian_cozy_rug", 196, None, {
        "layer": "rug", "surfaceRatio": (0.55, 0.10, 0.90), "variantType": "rug",
    }),
    ("sheet2_living_bed.jpg", 2, 1, "floor_standing_lamp", None, 128, {
        "layer": "floor", "footDepth": 16, "lightRatio": (0.50, 0.16, 175), "toggleLamp": True,
    }),
    ("sheet2_living_bed.jpg", 2, 2, "fiddle_leaf_plant", None, 114, {
        "layer": "floor", "footDepth": 18,
    }),

    # Sheet 3: Bath, Pets & Architectural Wall
    ("sheet3_bath_pet_wall.jpg", 0, 0, "clawfoot_bathtub", 128, None, {
        "layer": "floor", "footDepth": 24, "flippable": True,
    }),
    ("sheet3_bath_pet_wall.jpg", 0, 1, "bathroom_vanity", None, 134, {
        "layer": "floor", "footDepth": 18,
    }),
    ("sheet3_bath_pet_wall.jpg", 0, 2, "cozy_toilet", None, 78, {
        "layer": "floor", "footDepth": 20, "flippable": True,
    }),
    ("sheet3_bath_pet_wall.jpg", 1, 0, "cat_tree_condo", None, 126, {
        "layer": "floor", "footDepth": 22, "surfaceRatio": (0.08, 0.08, 0.44),
    }),
    ("sheet3_bath_pet_wall.jpg", 1, 1, "plush_pet_bed", 68, None, {
        "layer": "floor", "footDepth": 20, "surfaceRatio": (0.56, 0.22, 0.78), "variantType": "petbed",
    }),
    ("sheet3_bath_pet_wall.jpg", 1, 2, "sleeping_ginger_cat_prop", 52, None, {
        "layer": "prop", "variantType": "cat",
    }),
    ("sheet3_bath_pet_wall.jpg", 2, 0, "sunset_window", 104, None, {
        "layer": "wall", "toggleState": True, "isWindow": True,
    }),
    ("sheet3_bath_pet_wall.jpg", 2, 1, "stairwell_door_1f", None, 172, {
        "layer": "wall", "anchor": "floor", "isStairs": True,
    }),
    ("sheet3_bath_pet_wall.jpg", 2, 2, "pendant_ceiling_lamp", None, 58, {
        "layer": "wall", "anchor": "ceiling", "lightRatio": (0.50, 0.88, 190), "toggleLamp": True,
    }),

    # Sheet 4: Props & Wall Accents
    ("sheet4_props.jpg", 0, 0, "desktop_pc_set", 58, None, {
        "layer": "prop",
    }),
    ("sheet4_props.jpg", 0, 1, "table_lamp_warm", None, 44, {
        "layer": "prop", "lightRatio": (0.50, 0.36, 135), "variantType": "tablelamp",
    }),
    ("sheet4_props.jpg", 0, 2, "wall_shelf_wide", 92, None, {
        "layer": "wall", "surfaceRatio": (0.36, 0.06, 0.94), "variantType": "wood_dark",
    }),
    ("sheet4_props.jpg", 1, 0, "framed_landscape_art", 64, None, {
        "layer": "wall", "variantType": "art",
    }),
    ("sheet4_props.jpg", 1, 1, "wall_clock", 36, None, {
        "layer": "wall",
    }),
    ("sheet4_props.jpg", 1, 2, "wall_sconce_lamp", None, 44, {
        "layer": "wall", "lightRatio": (0.50, 0.30, 125), "toggleLamp": True,
    }),
    ("sheet4_props.jpg", 2, 0, "potted_succulent", None, 34, {
        "layer": "prop", "variantType": "succulent",
    }),
    ("sheet4_props.jpg", 2, 1, "chibi_figurine_trio", None, 40, {
        "layer": "prop", "variantType": "figurine",
    }),
    ("sheet4_props.jpg", 2, 2, "book_stack", 32, None, {
        "layer": "prop",
    }),
]

HOLE_PUNCH_ITEMS: Set[str] = {
    "dining_table",
    "dining_chair",
    "coffee_table",
    "study_desk",
    "cat_tree_condo",
    "fiddle_leaf_plant",
    "coffee_mug_steaming",
    "floor_standing_lamp",
    "wall_shelf_wide",
    "kitchen_wall_cabinet",
    "retro_fridge",
    "kitchen_stove_counter",
}


def find_3x3_cells(img: Image.Image) -> Dict[Tuple[int, int], Tuple[int, int, int, int]]:
    """Robustly split a 3x3 white-background sprite sheet even when rows overlap globally."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def is_dark(r: int, g: int, b: int) -> bool:
        return min(r, g, b) < 222

    # 1. Global row gap candidates
    row_dark = [sum(1 for x in range(w) if is_dark(*px[x, y])) for y in range(h)]
    r1 = min(range(int(h * 0.25), int(h * 0.43)), key=lambda i: row_dark[i])
    r2 = min(range(int(h * 0.56), int(h * 0.74)), key=lambda i: row_dark[i])
    row_ranges = [(0, r1), (r1, r2), (r2, h)]

    # 2. Per-row column cuts: locate the 3 actual object X-bands cleanly (merge internal gaps < 28px)
    cells: Dict[Tuple[int, int], Tuple[int, int, int, int]] = {}
    col_bounds: Dict[Tuple[int, int], Tuple[int, int]] = {}
    for ri, (y0, y1) in enumerate(row_ranges):
        cd = [sum(1 for y in range(y0, y1) if is_dark(*px[x, y])) for x in range(w)]
        raw_bands: List[Tuple[int, int]] = []
        in_b = False
        b_start = 0
        for x, cnt in enumerate(cd):
            if cnt > 0 and not in_b:
                in_b = True
                b_start = x
            elif cnt == 0 and in_b:
                in_b = False
                raw_bands.append((b_start, x))
        if in_b:
            raw_bands.append((b_start, w))

        # Merge bands separated by small gaps (< 26px) until at most 3 objects remain
        merged = list(raw_bands)
        while len(merged) > 3:
            # Merge the pair with the smallest gap
            best_i = min(range(len(merged) - 1), key=lambda i: merged[i + 1][0] - merged[i][1])
            merged[best_i : best_i + 2] = [(merged[best_i][0], merged[best_i + 1][1])]

        if len(merged) == 3:
            c1 = (merged[0][1] + merged[1][0]) // 2
            c2 = (merged[1][1] + merged[2][0]) // 2
        else:
            c1 = w // 3
            c2 = (2 * w) // 3
        col_bounds[(ri, 0)] = (0, c1)
        col_bounds[(ri, 1)] = (c1, c2)
        col_bounds[(ri, 2)] = (c2, w)

    # 3. Refine row cuts per-column so tall items in one column never clip neighbors
    for ri in range(3):
        for ci in range(3):
            x0, x1 = col_bounds[(ri, ci)]
            y0, y1 = row_ranges[ri]
            if ri > 0:
                px0 = min(x0, col_bounds[(ri - 1, ci)][0])
                px1 = max(x1, col_bounds[(ri - 1, ci)][1])
                lo = max(0, y0 - 48)
                hi = min(h - 1, y0 + 48)
                y0 = min(
                    range(lo, hi + 1),
                    key=lambda yy: sum(1 for x in range(px0, px1) if is_dark(*px[x, yy])),
                )
            if ri < 2:
                nx0 = min(x0, col_bounds[(ri + 1, ci)][0])
                nx1 = max(x1, col_bounds[(ri + 1, ci)][1])
                lo = max(0, y1 - 48)
                hi = min(h - 1, y1 + 48)
                y1 = min(
                    range(lo, hi + 1),
                    key=lambda yy: sum(1 for x in range(nx0, nx1) if is_dark(*px[x, yy])),
                )
            cells[(ri, ci)] = (x0, y0, x1, y1)

    return cells


def is_bg_pixel(r: int, g: int, b: int) -> bool:
    mn = min(r, g, b)
    mx = max(r, g, b)
    return mn > 224 and (mx - mn) < 24


def extract_clean_cell(cell_img: Image.Image, item_id: str) -> Tuple[Image.Image, Optional[Tuple[int, int, int, int]]]:
    """Border BFS background removal + targeted hole punch + 1px anti-halo defringe."""
    rgba = cell_img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    visited = bytearray(w * h)
    q = deque()

    def push(x: int, y: int) -> None:
        idx = y * w + x
        if not visited[idx]:
            r, g, b, _ = px[x, y]
            if is_bg_pixel(r, g, b):
                visited[idx] = 1
                q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    # Targeted interior white hole punch for open-frame furniture or bathtub pipe gap
    if item_id in HOLE_PUNCH_ITEMS or item_id == "clawfoot_bathtub":
        max_x = int(w * 0.28) if item_id == "clawfoot_bathtub" else w
        for y in range(1, h - 1):
            for x in range(1, max_x - 1):
                r, g, b, a = px[x, y]
                if a > 0 and min(r, g, b) > 240 and (max(r, g, b) - min(r, g, b)) < 14:
                    px[x, y] = (0, 0, 0, 0)

    glass_rect_raw: Optional[Tuple[int, int, int, int]] = None
    if item_id == "sunset_window":
        # Find the 4 enclosed white glass panes -> convert to translucent sky glass + record bounds
        pane_vis = bytearray(w * h)
        g_min_x, g_min_y, g_max_x, g_max_y = w, h, 0, 0
        found_panes = False
        for sy in range(h):
            for sx in range(w):
                idx = sy * w + sx
                if pane_vis[idx]:
                    continue
                r, g, b, a = px[sx, sy]
                if a > 0 and min(r, g, b) > 235 and (max(r, g, b) - min(r, g, b)) < 20:
                    comp = []
                    cq = deque([(sx, sy)])
                    pane_vis[idx] = 1
                    while cq:
                        cx, cy = cq.popleft()
                        comp.append((cx, cy))
                        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                            if 0 <= nx < w and 0 <= ny < h:
                                nidx = ny * w + nx
                                if not pane_vis[nidx]:
                                    nr, ng, nb, na = px[nx, ny]
                                    if na > 0 and min(nr, ng, nb) > 232 and (max(nr, ng, nb) - min(nr, ng, nb)) < 24:
                                        pane_vis[nidx] = 1
                                        cq.append((nx, ny))
                    if len(comp) > 150:
                        found_panes = True
                        for cx, cy in comp:
                            px[cx, cy] = (218, 238, 255, 34)
                            g_min_x = min(g_min_x, cx)
                            g_min_y = min(g_min_y, cy)
                            g_max_x = max(g_max_x, cx)
                            g_max_y = max(g_max_y, cy)
        if found_panes:
            glass_rect_raw = (g_min_x, g_min_y, g_max_x - g_min_x + 1, g_max_y - g_min_y + 1)

    # 1px anti-halo edge defringe: strip near-white fringe touching alpha==0
    for _pass in range(2):
        to_clear = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 255:
                    touches_trans = False
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                            touches_trans = True
                            break
                    if touches_trans and min(r, g, b) > 188 and (max(r, g, b) - min(r, g, b)) < 30:
                        to_clear.append((x, y))
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)

    # Remove tiny isolated 1-2px noise specks
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if px[x, y][3] > 0:
                nbrs = sum(
                    1
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                    if px[nx, ny][3] > 0
                )
                if nbrs == 0:
                    px[x, y] = (0, 0, 0, 0)

    bbox = rgba.getbbox()
    if not bbox:
        return rgba, None
    cropped = rgba.crop(bbox)
    if glass_rect_raw:
        gx, gy, gw, gh = glass_rect_raw
        glass_rect_raw = (gx - bbox[0], gy - bbox[1], gw, gh)
    return cropped, glass_rect_raw


def scale_hd_pixel(
    img: Image.Image,
    target_w: Optional[int],
    target_h: Optional[int],
    glass_rect: Optional[Tuple[int, int, int, int]] = None,
) -> Tuple[Image.Image, Optional[Tuple[int, int, int, int]]]:
    """Scale proportionally to crisp HD pixel art preserving dark outlines and clean edges."""
    sw, sh = img.size
    if target_w is not None:
        nw = target_w
        nh = max(8, round(sh * (target_w / sw)))
    elif target_h is not None:
        nh = target_h
        nw = max(8, round(sw * (target_h / sh)))
    else:
        nw, nh = sw, sh

    # Split RGB & Alpha: downscale RGB with BOX (no color halo bleeding from transparent pixels!)
    # Replace alpha==0 RGB with nearest opaque neighbor average before scaling to prevent dark/light halos
    src_px = img.load()
    padded = img.copy()
    p_px = padded.load()
    for y in range(sh):
        for x in range(sw):
            if src_px[x, y][3] == 0:
                # Sample nearby opaque color if any
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (0, 2)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < sw and 0 <= ny < sh and src_px[nx, ny][3] > 0:
                        nr, ng, nb, _ = src_px[nx, ny]
                        p_px[x, y] = (nr, ng, nb, 0)
                        break

    rgb_scaled = padded.convert("RGB").resize((nw, nh), Image.Resampling.BOX)
    alpha_scaled = img.split()[3].resize((nw, nh), Image.Resampling.BILINEAR)

    out = Image.new("RGBA", (nw, nh), (0, 0, 0, 0))
    r_px = rgb_scaled.load()
    a_px = alpha_scaled.load()
    o_px = out.load()

    for y in range(nh):
        for x in range(nw):
            a = a_px[x, y]
            r, g, b = r_px[x, y]
            if glass_rect is not None and 15 <= a < 96:
                o_px[x, y] = (218, 238, 255, 34)
            elif a >= 104:
                o_px[x, y] = (r, g, b, 255)

    # Quantize opaque colors cleanly to <= 72 palette tones for crisp pixel clustering
    quant_rgb = out.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT).convert("RGB")
    q_px = quant_rgb.load()
    for y in range(nh):
        for x in range(nw):
            if o_px[x, y][3] == 255:
                r, g, b = q_px[x, y]
                o_px[x, y] = (r, g, b, 255)

    scaled_glass = None
    if glass_rect is not None:
        sx = nw / sw
        sy = nh / sh
        gx, gy, gw, gh = glass_rect
        scaled_glass = (
            max(0, round(gx * sx)),
            max(0, round(gy * sy)),
            max(4, round(gw * sx)),
            max(4, round(gh * sy)),
        )

    return out, scaled_glass


# ==============================================================================
# Selective HSV Palette Variants & State Variants
# ==============================================================================

def shift_hsv_selective(
    img: Image.Image,
    hue_shift: float = 0.0,
    sat_mult: float = 1.0,
    val_mult: float = 1.0,
    hue_range: Optional[Tuple[float, float]] = None,
    min_sat: float = 0.14,
    min_val: float = 0.25,
) -> Image.Image:
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if v < min_val or s < min_sat:
                continue
            if hue_range is not None:
                lo, hi = hue_range
                if lo <= hi:
                    if not (lo <= h <= hi):
                        continue
                else:
                    if not (h >= lo or h <= hi):
                        continue
            nh = (h + hue_shift) % 1.0
            ns = max(0.0, min(1.0, s * sat_mult))
            nv = max(0.0, min(1.0, v * val_mult))
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def make_dimmed_lamp(img: Image.Image) -> Image.Image:
    """Turn warm lit shade into unlit muted cream/grey shade."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if v > 0.65 and 0.08 <= h <= 0.19:
                px[x, y] = (int(r * 0.72), int(g * 0.70), int(b * 0.72), a)
    return out


def make_window_closed_curtains(
    img: Image.Image, glass_rect: Optional[Tuple[int, int, int, int]]
) -> Image.Image:
    out = img.copy()
    if not glass_rect:
        return out
    gx, gy, gw, gh = glass_rect
    px = out.load()
    # Coral pleated curtain colors matching the side drapes
    shades = [
        (212, 118, 102, 255),
        (234, 152, 134, 255),
        (182, 92, 80, 255),
        (234, 152, 134, 255),
    ]
    mid_x = gx + gw // 2
    for y in range(gy, min(out.height - 2, gy + gh)):
        for x in range(gx, min(out.width - 2, gx + gw)):
            if x == mid_x:
                px[x, y] = OUTLINE
            else:
                px[x, y] = shades[abs(x - gx) % len(shades)]
    return out


def make_stairs_2f(img: Image.Image) -> Image.Image:
    """Copy stairwell_door_1f and replace the '1F' plaque text with crisp '2F'."""
    out = img.copy()
    px = out.load()
    # Find light tan/cream plaque near top center (y < 0.18 * h)
    top_lim = int(out.height * 0.16)
    xs = [
        x
        for y in range(2, top_lim)
        for x in range(int(out.width * 0.25), int(out.width * 0.75))
        if px[x, y][3] == 255 and min(px[x, y][:3]) > 140
    ]
    ys = [
        y
        for y in range(2, top_lim)
        for x in range(int(out.width * 0.25), int(out.width * 0.75))
        if px[x, y][3] == 255 and min(px[x, y][:3]) > 140
    ]
    if xs and ys:
        bx0, bx1 = min(xs), max(xs)
        by0, by1 = min(ys), max(ys)
        draw = ImageDraw.Draw(out)
        # Fill plaque interior cleanly with dark plaque wood and draw crisp 2F
        draw.rectangle([bx0 + 1, by0 + 1, bx1 - 1, by1 - 1], fill=(92, 56, 38, 255))
        cx = (bx0 + bx1) // 2
        cy = (by0 + by1) // 2
        ink = (248, 232, 202, 255)
        # Draw '2'
        draw.line([cx - 6, cy - 3, cx - 3, cy - 3], fill=ink)
        draw.line([cx - 3, cy - 3, cx - 3, cy], fill=ink)
        draw.line([cx - 6, cy, cx - 3, cy], fill=ink)
        draw.line([cx - 6, cy, cx - 6, cy + 3], fill=ink)
        draw.line([cx - 6, cy + 3, cx - 3, cy + 3], fill=ink)
        # Draw 'F'
        draw.line([cx + 1, cy - 3, cx + 1, cy + 3], fill=ink)
        draw.line([cx + 1, cy - 3, cx + 5, cy - 3], fill=ink)
        draw.line([cx + 1, cy, cx + 4, cy], fill=ink)
    return out


def build_variants(
    item_id: str,
    base: Image.Image,
    meta: dict,
    glass_rect: Optional[Tuple[int, int, int, int]],
) -> List[Tuple[str, Image.Image]]:
    vt = meta.get("variantType")

    if meta.get("isWindow"):
        return [
            ("拉开窗帘", base),
            ("拉上窗帘", make_window_closed_curtains(base, glass_rect)),
        ]
    if meta.get("isStairs"):
        return [("1F楼梯口", base), ("2F楼梯口", make_stairs_2f(base))]
    if meta.get("toggleLamp"):
        return [("开灯", base), ("关灯", make_dimmed_lamp(base))]

    if vt == "fridge":
        return [
            ("复古薄荷绿", base),
            ("奶油香草白", shift_hsv_selective(base, hue_shift=-0.34, sat_mult=0.22, val_mult=1.18, hue_range=(0.35, 0.56))),
            ("樱花草莓粉", shift_hsv_selective(base, hue_shift=0.49, sat_mult=0.95, val_mult=1.08, hue_range=(0.35, 0.56))),
            ("焦糖奶黄", shift_hsv_selective(base, hue_shift=-0.34, sat_mult=1.05, val_mult=1.12, hue_range=(0.35, 0.56))),
        ]
    if vt == "sofa":
        return [
            ("海盐雾霾蓝", base),
            ("暖燕麦奶茶", shift_hsv_selective(base, hue_shift=-0.43, sat_mult=0.38, val_mult=1.22, hue_range=(0.45, 0.62))),
            ("焦糖莓果粉", shift_hsv_selective(base, hue_shift=0.45, sat_mult=0.95, val_mult=1.1, hue_range=(0.45, 0.62))),
            ("森系橄榄绿", shift_hsv_selective(base, hue_shift=-0.20, sat_mult=0.82, val_mult=1.02, hue_range=(0.45, 0.62))),
        ]
    if vt == "bed":
        return [
            ("暖阳百衲被", base),
            ("星空靛蓝被", shift_hsv_selective(base, hue_shift=0.58, sat_mult=1.1, val_mult=0.96, hue_range=(0.90, 0.08))),
            ("森系绿格被", shift_hsv_selective(base, hue_shift=0.28, sat_mult=0.95, val_mult=1.0, hue_range=(0.90, 0.08))),
        ]
    if vt == "rug":
        return [
            ("暖红波斯毯", base),
            ("海盐蓝纹毯", shift_hsv_selective(base, hue_shift=0.50, sat_mult=0.85, val_mult=1.02, hue_range=(0.95, 0.09))),
            ("森系橄榄毯", shift_hsv_selective(base, hue_shift=0.25, sat_mult=0.78, val_mult=0.96, hue_range=(0.95, 0.09))),
        ]
    if vt == "wood_dark":
        return [
            ("暖橡木", base),
            ("深胡桃", shift_hsv_selective(base, hue_shift=-0.01, sat_mult=0.92, val_mult=0.74, hue_range=(0.04, 0.14))),
        ]
    if vt == "wood_teal":
        return [
            ("暖橡木", base),
            ("薄荷绿漆", shift_hsv_selective(base, hue_shift=0.40, sat_mult=0.85, val_mult=1.04, hue_range=(0.04, 0.14))),
            ("奶油白木", shift_hsv_selective(base, hue_shift=0.02, sat_mult=0.28, val_mult=1.24, hue_range=(0.04, 0.14))),
        ]
    if vt == "wood_birch":
        return [
            ("暖橡木", base),
            ("奶油白木", shift_hsv_selective(base, hue_shift=0.02, sat_mult=0.30, val_mult=1.24, hue_range=(0.04, 0.14))),
        ]
    if vt == "chair":
        return [
            ("燕麦软垫", base),
            ("深胡桃木", shift_hsv_selective(base, hue_shift=-0.01, sat_mult=0.9, val_mult=0.72, hue_range=(0.04, 0.14))),
        ]
    if vt == "petbed":
        return [
            ("焦糖南瓜窝", base),
            ("薄荷云朵窝", shift_hsv_selective(base, hue_shift=0.42, sat_mult=0.85, val_mult=1.04, hue_range=(0.02, 0.13))),
            ("樱花软垫窝", shift_hsv_selective(base, hue_shift=-0.07, sat_mult=0.95, val_mult=1.04, hue_range=(0.02, 0.13))),
        ]
    if vt == "cat":
        return [
            ("橘猫团团", base),
            ("奶牛花花", shift_hsv_selective(base, hue_shift=0.0, sat_mult=0.08, val_mult=1.08, hue_range=(0.02, 0.14))),
            ("银渐层点点", shift_hsv_selective(base, hue_shift=0.50, sat_mult=0.18, val_mult=0.96, hue_range=(0.02, 0.14))),
        ]
    if vt == "omurice":
        return [
            ("日式蛋包饭", base),
            ("草莓鲜果派", shift_hsv_selective(base, hue_shift=-0.10, sat_mult=0.95, val_mult=0.95, hue_range=(0.06, 0.18))),
        ]
    if vt == "mug":
        return [
            ("奶油焦糖杯", base),
            ("薄荷马克杯", shift_hsv_selective(base, hue_shift=0.38, sat_mult=1.4, val_mult=0.96, hue_range=(0.04, 0.16))),
            ("草莓粉杯", shift_hsv_selective(base, hue_shift=-0.11, sat_mult=1.5, val_mult=0.98, hue_range=(0.04, 0.16))),
        ]
    if vt == "tablelamp":
        pink = shift_hsv_selective(base, hue_shift=-0.14, sat_mult=1.4, val_mult=0.96, hue_range=(0.06, 0.18))
        green = shift_hsv_selective(base, hue_shift=0.18, sat_mult=1.35, val_mult=0.95, hue_range=(0.06, 0.18))
        return [
            ("奶油暖灯(亮)", base),
            ("奶油暖灯(灭)", make_dimmed_lamp(base)),
            ("樱花粉灯(亮)", pink),
            ("樱花粉灯(灭)", make_dimmed_lamp(pink)),
            ("抹茶绿灯(亮)", green),
            ("抹茶绿灯(灭)", make_dimmed_lamp(green)),
        ]
    if vt == "art":
        return [
            ("落日余晖", base),
            ("海风晴空", shift_hsv_selective(base, hue_shift=0.48, sat_mult=0.95, val_mult=1.0, hue_range=(0.05, 0.18))),
            ("森林翠绿", shift_hsv_selective(base, hue_shift=0.24, sat_mult=0.9, val_mult=0.94, hue_range=(0.05, 0.18))),
        ]
    if vt == "succulent":
        return [
            ("圆润多肉", base),
            ("粉紫法师", shift_hsv_selective(base, hue_shift=0.45, sat_mult=0.82, val_mult=1.0, hue_range=(0.20, 0.45))),
        ]
    if vt == "figurine":
        return [
            ("栗发毛衣款", base),
            ("珊瑚红发款", shift_hsv_selective(base, hue_shift=-0.06, sat_mult=1.3, val_mult=1.08)),
            ("海盐蓝发款", shift_hsv_selective(base, hue_shift=0.48, sat_mult=1.25, val_mult=1.08)),
        ]
    return [("默认", base)]


# ==============================================================================
# HD Architectural Procedural Assets (2.5D Bath Checkered Mat & Wood Divider)
# ==============================================================================

def build_hd_bath_mat() -> Tuple[List[Tuple[str, Image.Image]], dict]:
    """2.5D perspective trapezoidal woven bath mat matching the Persian rug angle."""
    w, h = 98, 42
    base_colors = [
        ("水蓝格纹垫", (152, 214, 224, 255), (242, 248, 252, 255), (108, 174, 188, 255)),
        ("蜜桃粉格垫", (238, 166, 178, 255), (252, 242, 244, 255), (196, 122, 138, 255)),
        ("奶油鹅黄垫", (242, 210, 132, 255), (252, 246, 228, 255), (198, 164, 88, 255)),
    ]
    variants = []
    for name, c1, c2, rim in base_colors:
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        px = im.load()
        for y in range(2, h - 2):
            t = (y - 2) / max(1, h - 5)
            inset = int((1.0 - t) * 10)
            lx = inset + 2
            rx = w - inset - 3
            for x in range(lx, rx + 1):
                if y in (2, 3, h - 4, h - 3) or x in (lx, rx):
                    px[x, y] = OUTLINE
                elif y in (4, h - 5) or x in (lx + 1, rx - 1):
                    px[x, y] = rim
                else:
                    tx = (x - lx) // 9
                    ty = (y - 4) // 6
                    px[x, y] = c1 if (tx + ty) % 2 == 0 else c2
            # Woven fringe dots on left & right
            if y % 2 == 0 and 4 <= y <= h - 6:
                px[lx - 2, y] = OUTLINE
                px[lx - 1, y] = (244, 236, 218, 255)
                px[rx + 1, y] = (244, 236, 218, 255)
                px[rx + 2, y] = OUTLINE
        variants.append((name, im))
    return variants, {"layer": "rug", "surfaces": [{"y": 22, "x0": 14, "x1": 84}]}


def build_hd_room_divider() -> Tuple[List[Tuple[str, Image.Image]], dict]:
    """Richly wood-grained 2.5D floor-to-ceiling wooden divider beam (46..312 = 266px)."""
    w, h = 22, 266
    themes = [
        ("暖橡木隔断", (102, 60, 35, 255), (148, 92, 54, 255), (186, 128, 80, 255), (214, 160, 108, 255)),
        ("深胡桃隔断", (64, 38, 24, 255), (96, 58, 38, 255), (128, 82, 54, 255), (156, 106, 74, 255)),
        ("奶油白木柱", (162, 134, 98, 255), (206, 178, 138, 255), (232, 208, 170, 255), (246, 230, 202, 255)),
    ]
    variants = []
    for name, d, m, l, hi in themes:
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        px = im.load()
        for y in range(h):
            for x in range(2, w - 2):
                if x == 2 or x == w - 3 or y == 0 or y == h - 1:
                    px[x, y] = OUTLINE
                elif x in (3, 4):
                    px[x, y] = hi if x == 3 else l
                elif x >= w - 5:
                    px[x, y] = d
                else:
                    px[x, y] = l if (x == 8 and (y % 13) < 5) else (d if (x == 12 and (y % 17) < 6) else m)
        # Top decorative corbel & bottom plinth block
        for yy in list(range(1, 14)) + list(range(h - 16, h - 1)):
            for xx in range(0, w):
                if xx in (0, w - 1) or yy in (1, 13, h - 16, h - 2):
                    px[xx, yy] = OUTLINE
                else:
                    px[xx, yy] = hi if yy in (2, h - 15) else (d if xx > w - 5 else l)
        variants.append((name, im))
    return variants, {"layer": "wall", "anchor": "floor"}


# ==============================================================================
# Atlas Packing + Debug Preview Sheet
# ==============================================================================

def pack_atlas(
    items: List[Tuple[str, List[Tuple[str, Image.Image]], dict]],
    max_width: int = 2048,
    padding: int = 2,
) -> Tuple[Image.Image, dict]:
    entries = []
    for item_id, variants, meta in items:
        for v_idx, (v_name, img) in enumerate(variants):
            entries.append((item_id, v_idx, v_name, img, meta))

    entries.sort(key=lambda e: (-e[3].height, e[0], e[1]))
    x, y, row_h = padding, padding, 0
    placements = []
    used_w = 0
    for item_id, v_idx, v_name, img, meta in entries:
        w, h = img.size
        if x + w + padding > max_width:
            x = padding
            y += row_h + padding
            row_h = 0
        placements.append((item_id, v_idx, v_name, img, meta, x, y, w, h))
        x += w + padding
        used_w = max(used_w, x)
        row_h = max(row_h, h)

    atlas_h = y + row_h + padding
    atlas_w = max(512, used_w)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    items_meta: Dict[str, dict] = {}
    for item_id, v_idx, v_name, img, meta, px_x, px_y, w, h in placements:
        atlas.paste(img, (px_x, px_y))
        if item_id not in items_meta:
            clean_meta = {
                k: v
                for k, v in meta.items()
                if k not in ("surfaceRatio", "lightRatio", "variantType", "toggleLamp", "isWindow")
            }
            items_meta[item_id] = {"w": w, "h": h, **clean_meta, "variants": []}
        items_meta[item_id]["variants"].append({
            "index": v_idx,
            "name": v_name,
            "x": px_x,
            "y": px_y,
            "w": w,
            "h": h,
        })
        items_meta[item_id]["variants"].sort(key=lambda v: v["index"])

    return atlas, {
        "gridSize": 60,
        "atlasWidth": atlas_w,
        "atlasHeight": atlas_h,
        "items": items_meta,
    }


def save_debug_preview(items: List[Tuple[str, List[Tuple[str, Image.Image]], dict]]) -> None:
    cols = 6
    cell_w, cell_h = 220, 290
    rows = (len(items) + cols - 1) // cols
    canvas = Image.new("RGBA", (cols * cell_w, rows * cell_h), (43, 24, 16, 255))
    draw = ImageDraw.Draw(canvas)
    for idx, (item_id, variants, meta) in enumerate(items):
        r, c = divmod(idx, cols)
        ox, oy = c * cell_w, r * cell_h
        draw.rectangle([ox + 2, oy + 2, ox + cell_w - 3, oy + cell_h - 3], outline=(102, 62, 38, 255))
        spr = variants[0][1]
        sx = ox + (cell_w - spr.width) // 2
        sy = oy + cell_h - 24 - spr.height
        canvas.paste(spr, (sx, sy), spr)
        for s in meta.get("surfaces", []):
            draw.line([sx + s["x0"], sy + s["y"], sx + s["x1"], sy + s["y"]], fill=(93, 242, 255, 255), width=2)
        draw.text((ox + 8, oy + cell_h - 18), f"{item_id} ({spr.width}x{spr.height})", fill=(255, 232, 180, 255))
    canvas.save(ROOT / "tools" / "debug_extracted_preview.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load and split all 4 sheets
    sheet_cache: Dict[str, Tuple[Image.Image, Dict[Tuple[int, int], Tuple[int, int, int, int]]]] = {}
    for sheet_name in {s[0] for s in SLOT_SPECS}:
        im = Image.open(SRC_DIR / sheet_name).convert("RGBA")
        sheet_cache[sheet_name] = (im, find_3x3_cells(im))

    built: List[Tuple[str, List[Tuple[str, Image.Image]], dict]] = []

    for sheet_name, row, col, item_id, tw, th, raw_meta in SLOT_SPECS:
        sheet_im, cells = sheet_cache[sheet_name]
        crop_box = cells[(row, col)]
        cell_im = sheet_im.crop(crop_box)
        clean_im, glass_raw = extract_clean_cell(cell_im, item_id)
        scaled_im, scaled_glass = scale_hd_pixel(clean_im, tw, th, glass_raw)

        meta = dict(raw_meta)
        w, h = scaled_im.size
        if "surfaceRatio" in meta:
            ry, rx0, rx1 = meta["surfaceRatio"]
            meta["surfaces"] = [{
                "y": round(h * ry),
                "x0": round(w * rx0),
                "x1": round(w * rx1),
            }]
        if "lightRatio" in meta:
            lx, ly, lr = meta["lightRatio"]
            meta["light"] = {
                "dx": round(w * lx),
                "dy": round(h * ly),
                "radius": lr,
            }
        if meta.get("toggleLamp"):
            meta["toggleState"] = True
        if meta.get("isWindow"):
            meta["toggleState"] = True
            if scaled_glass:
                meta["glassRect"] = {
                    "x": scaled_glass[0],
                    "y": scaled_glass[1],
                    "w": scaled_glass[2],
                    "h": scaled_glass[3],
                }

        variants = build_variants(item_id, scaled_im, meta, scaled_glass)
        built.append((item_id, variants, meta))

    # Add 2.5D HD architectural sprites
    mat_vars, mat_meta = build_hd_bath_mat()
    built.append(("bath_checkered_mat", mat_vars, mat_meta))
    div_vars, div_meta = build_hd_room_divider()
    built.append(("room_divider_pillar", div_vars, div_meta))

    save_debug_preview(built)

    atlas_img, atlas_json = pack_atlas(built)
    png_out = OUT_DIR / "furniture_atlas.png"
    json_out = OUT_DIR / "furniture_atlas.json"

    # Save crisp RGBA atlas (quantize gently to 256 palette with alpha preserved via PNG-8? Keep RGBA optimize=True for crisp translucent glass)
    atlas_img.save(png_out, format="PNG", optimize=True)
    json_out.write_text(json.dumps(atlas_json, ensure_ascii=False, indent=2), encoding="utf-8")

    kb = png_out.stat().st_size / 1024.0
    print(f"Packed {len(built)} HD items ({sum(len(v) for _, v, _ in built)} variants)")
    print(f"Atlas: {png_out} ({atlas_img.width}x{atlas_img.height}, {kb:.1f} KB)")


if __name__ == "__main__":
    main()
