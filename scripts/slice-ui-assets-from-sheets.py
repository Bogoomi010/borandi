from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "src" / "assets" / "ui"
BASE_SIZE = (1774, 887)
LANGUAGES = ("en", "ko", "jp", "cn")
VERTICAL_SCALED_SHEETS = {
    "ui_bottom_actionbar_components.png",
    "ui_core_foundation_components.png",
    "ui_unit_list_components.png",
}
LOCALIZED_OUTPUTS = {
    "battlefield/mini-info-panel.png",
    "battlefield/wave-route-nodes.png",
    "boss/card.png",
    "boss/info-panel.png",
    "boss/reward-preview.png",
    "buttons/actionbar.png",
    "buttons/action-disabled.png",
    "buttons/action-dps-toggle.png",
    "buttons/action-merge.png",
    "buttons/action-relic.png",
    "buttons/action-sell.png",
    "buttons/action-summon.png",
    "buttons/action-upgrade.png",
    "buttons/generic-hover.png",
    "buttons/generic-normal.png",
    "buttons/generic-pressed.png",
    "buttons/label-shortcut.png",
    "buttons/primary.png",
    "buttons/right-tab-normal.png",
    "buttons/right-tab-selected.png",
    "buttons/round-start-hover.png",
    "buttons/round-start-normal.png",
    "buttons/secondary.png",
    "buttons/tab-normal.png",
    "buttons/tab-selected.png",
    "frames/log-entry.png",
    "frames/right-side-panel.png",
    "frames/right-tabs.png",
    "meters/damage-panel.png",
    "meters/damage-row.png",
    "mission/card-active.png",
    "mission/card-completed.png",
    "mission/progress-plate.png",
    "mission/reward-plate.png",
    "popups/boss-warning.png",
    "popups/boss-warning-banner.png",
    "popups/confirm.png",
    "popups/reward.png",
    "popups/settings.png",
    "popups/tooltip.png",
    "unit-detail/attack-type-magic.png",
    "unit-detail/attack-type-physical.png",
    "unit-detail/bonus-tag-strip.png",
    "unit-detail/effect-value-badge.png",
    "unit-detail/panel.png",
    "unit-detail/stat-item.png",
    "unit-detail/tag-badges.png",
    "units/btn-equip-small.png",
    "units/card-legendary.png",
    "units/card-normal.png",
    "units/card-rare.png",
    "units/card-selected.png",
    "units/element-icons.png",
    "units/filter-tabs.png",
    "units/grade-badges.png",
    "units/list-panel.png",
    "units/tag-chip.png",
}


@dataclass(frozen=True)
class Slice:
    sheet: str
    out: str
    box: tuple[int, int, int, int]
    bg: Literal["border", "all"] = "border"


SLICES: list[Slice] = [
    # Sheet D - core foundation / common kit
    Slice("ui_core_foundation_components.png", "frames/panel-main.png", (933, 79, 1382, 289)),
    Slice("ui_core_foundation_components.png", "frames/panel-small.png", (1440, 82, 1681, 286)),
    Slice("ui_core_foundation_components.png", "frames/nineslice-main.png", (951, 355, 1322, 513), "all"),
    Slice("ui_core_foundation_components.png", "frames/nineslice-small.png", (1366, 359, 1558, 509), "all"),
    Slice("ui_core_foundation_components.png", "buttons/generic-normal.png", (905, 587, 1039, 648)),
    Slice("ui_core_foundation_components.png", "buttons/generic-hover.png", (1067, 587, 1200, 648)),
    Slice("ui_core_foundation_components.png", "buttons/generic-pressed.png", (1224, 587, 1354, 648)),
    Slice("ui_core_foundation_components.png", "buttons/tab-normal.png", (1381, 581, 1530, 649)),
    Slice("ui_core_foundation_components.png", "buttons/tab-selected.png", (1553, 579, 1710, 651)),
    Slice("ui_core_foundation_components.png", "frames/badge.png", (913, 727, 1030, 822)),
    Slice("ui_core_foundation_components.png", "frames/divider.png", (1057, 745, 1292, 783)),
    Slice("ui_core_foundation_components.png", "frames/corner.png", (1345, 721, 1416, 801), "all"),
    Slice("ui_core_foundation_components.png", "fx/glow-set.png", (1440, 710, 1750, 820), "all"),

    # Sheet E - top status bar
    Slice("ui_top_status_bar_components.png", "topbar/status-bar.png", (35, 58, 1714, 214)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-map.png", (47, 261, 427, 368)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-round.png", (482, 261, 860, 368)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-enemy.png", (913, 261, 1295, 368)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-gold.png", (1346, 261, 1710, 368)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-difficulty.png", (47, 429, 426, 535)),
    Slice("ui_top_status_bar_components.png", "topbar/badge-next-boss.png", (480, 429, 861, 535)),
    Slice("ui_top_status_bar_components.png", "topbar/speed-group.png", (918, 433, 1286, 537)),
    Slice("ui_top_status_bar_components.png", "topbar/speed-x1.png", (1364, 436, 1472, 512)),
    Slice("ui_top_status_bar_components.png", "topbar/speed-x2.png", (62, 606, 165, 682)),
    Slice("ui_top_status_bar_components.png", "topbar/speed-x3-selected.png", (387, 607, 491, 683)),
    Slice("ui_top_status_bar_components.png", "topbar/btn-pause.png", (777, 604, 870, 694)),
    Slice("ui_top_status_bar_components.png", "topbar/save-indicator.png", (1102, 604, 1180, 687)),
    Slice("ui_top_status_bar_components.png", "topbar/divider-tiny.png", (1500, 611, 1522, 689)),
    Slice("ui_top_status_bar_components.png", "topbar/header-icons.png", (60, 750, 1120, 870), "all"),

    # Sheet C - bottom action bar
    Slice("ui_bottom_actionbar_components.png", "buttons/actionbar.png", (49, 51, 1418, 212)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-summon.png", (71, 283, 263, 445)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-merge.png", (397, 283, 591, 445)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-sell.png", (705, 283, 888, 445)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-upgrade.png", (1001, 283, 1185, 445)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-relic.png", (1287, 284, 1444, 446)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-dps-toggle.png", (1543, 285, 1701, 446)),
    Slice("ui_bottom_actionbar_components.png", "buttons/round-start-normal.png", (47, 518, 325, 629)),
    Slice("ui_bottom_actionbar_components.png", "buttons/round-start-hover.png", (396, 518, 689, 638)),
    Slice("ui_bottom_actionbar_components.png", "popups/boss-warning-banner.png", (787, 526, 1684, 645)),
    Slice("ui_bottom_actionbar_components.png", "buttons/label-shortcut.png", (42, 739, 314, 807)),
    Slice("ui_bottom_actionbar_components.png", "buttons/label-cost.png", (387, 741, 661, 806)),
    Slice("ui_bottom_actionbar_components.png", "buttons/action-disabled.png", (757, 723, 941, 860)),
    Slice("ui_bottom_actionbar_components.png", "buttons/primary.png", (1061, 718, 1375, 843)),
    Slice("ui_bottom_actionbar_components.png", "buttons/secondary.png", (1417, 721, 1715, 845)),

    # Sheet B - battlefield / damage meter
    Slice("ui_battlefield_components.png", "battlefield/frame.png", (31, 75, 549, 449)),
    Slice("ui_battlefield_components.png", "battlefield/road-border.png", (586, 81, 943, 208)),
    Slice("ui_battlefield_components.png", "battlefield/enemy-path-marker.png", (995, 105, 1265, 180), "all"),
    Slice("ui_battlefield_components.png", "battlefield/enemy-marker-normal.png", (1339, 95, 1445, 190)),
    Slice("ui_battlefield_components.png", "battlefield/enemy-marker-elite.png", (1573, 88, 1698, 193)),
    Slice("ui_battlefield_components.png", "battlefield/placement-node.png", (620, 296, 763, 439), "all"),
    Slice("ui_battlefield_components.png", "battlefield/placed-unit-marker.png", (876, 295, 981, 431), "all"),
    Slice("ui_battlefield_components.png", "battlefield/selected-unit-marker.png", (1083, 279, 1230, 450), "all"),
    Slice("ui_battlefield_components.png", "meters/damage-panel.png", (1283, 279, 1736, 450)),
    Slice("ui_battlefield_components.png", "meters/damage-row.png", (30, 522, 564, 590)),
    Slice("ui_battlefield_components.png", "meters/damage-bar-green.png", (616, 528, 945, 588)),
    Slice("ui_battlefield_components.png", "meters/damage-bar-blue.png", (997, 528, 1330, 588)),
    Slice("ui_battlefield_components.png", "meters/damage-bar-orange.png", (1386, 528, 1718, 588)),
    Slice("ui_battlefield_components.png", "battlefield/mini-info-panel.png", (36, 678, 520, 842)),
    Slice("ui_battlefield_components.png", "battlefield/wave-route-nodes.png", (650, 666, 1565, 785), "all"),

    # Sheet G - unit list
    Slice("ui_unit_list_components.png", "units/list-panel.png", (27, 48, 354, 685)),
    Slice("ui_unit_list_components.png", "units/capacity-bar.png", (388, 57, 854, 128)),
    Slice("ui_unit_list_components.png", "units/filter-tabs.png", (387, 182, 1072, 248)),
    Slice("ui_unit_list_components.png", "units/filter-btn-normal.png", (1160, 108, 1265, 203)),
    Slice("ui_unit_list_components.png", "units/filter-btn-selected.png", (1441, 107, 1548, 204)),
    Slice("ui_unit_list_components.png", "units/card-normal.png", (390, 312, 732, 459)),
    Slice("ui_unit_list_components.png", "units/card-selected.png", (777, 305, 1129, 465)),
    Slice("ui_unit_list_components.png", "units/card-rare.png", (388, 517, 735, 672)),
    Slice("ui_unit_list_components.png", "units/card-legendary.png", (780, 517, 1126, 671)),
    Slice("ui_unit_list_components.png", "units/element-icons.png", (1185, 305, 1695, 390), "all"),
    Slice("ui_unit_list_components.png", "units/grade-badges.png", (1185, 480, 1635, 585), "all"),
    Slice("ui_unit_list_components.png", "units/count-badge.png", (1192, 687, 1268, 743)),
    Slice("ui_unit_list_components.png", "units/tag-chip.png", (1438, 684, 1566, 742)),
    Slice("ui_unit_list_components.png", "units/btn-equip-small.png", (41, 752, 209, 811)),
    Slice("ui_unit_list_components.png", "units/selected-card-frame.png", (388, 733, 1007, 862), "all"),

    # Sheet H - selected unit detail
    Slice("ui_selected_unit_panel_components.png", "unit-detail/panel.png", (32, 74, 874, 500)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/portrait-frame.png", (925, 93, 1110, 313), "all"),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/name-plate.png", (1146, 110, 1507, 183)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/grade-frame.png", (1543, 96, 1701, 258), "all"),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/attack-power.png", (927, 358, 1099, 441)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/attack-type-magic.png", (1290, 373, 1376, 423)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/attack-type-physical.png", (1494, 372, 1602, 423)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/stat-grid.png", (921, 494, 1327, 653)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/stat-item.png", (1388, 507, 1492, 586)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/tag-badges.png", (48, 689, 675, 740)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/effect-slot-grid.png", (769, 724, 1086, 819)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/effect-slot.png", (1126, 723, 1223, 820)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/effect-icons.png", (1370, 705, 1760, 785), "all"),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/effect-value-badge.png", (1384, 819, 1492, 864)),
    Slice("ui_selected_unit_panel_components.png", "unit-detail/bonus-tag-strip.png", (41, 806, 668, 837), "all"),

    # Sheet A - right panel / mission / boss
    Slice("ui_right_panel_mission_boss_components.png", "frames/right-side-panel.png", (59, 80, 287, 641)),
    Slice("ui_right_panel_mission_boss_components.png", "frames/right-tabs.png", (332, 86, 698, 170)),
    Slice("ui_right_panel_mission_boss_components.png", "buttons/right-tab-normal.png", (370, 247, 602, 323)),
    Slice("ui_right_panel_mission_boss_components.png", "buttons/right-tab-selected.png", (370, 385, 602, 470)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/card-active.png", (746, 88, 1033, 439)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/card-completed.png", (1070, 88, 1357, 440)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/title-banner.png", (1411, 57, 1723, 126)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/round-limit-badge.png", (1514, 177, 1598, 266), "all"),
    Slice("ui_right_panel_mission_boss_components.png", "mission/progress-plate.png", (1409, 308, 1696, 357)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/reward-plate.png", (1404, 399, 1712, 462)),
    Slice("ui_right_panel_mission_boss_components.png", "mission/completed-badge.png", (1519, 505, 1587, 571), "all"),
    Slice("ui_right_panel_mission_boss_components.png", "boss/info-panel.png", (298, 609, 670, 829)),
    Slice("ui_right_panel_mission_boss_components.png", "boss/card.png", (696, 622, 1022, 787)),
    Slice("ui_right_panel_mission_boss_components.png", "boss/reward-preview.png", (1044, 611, 1284, 756)),
    Slice("ui_right_panel_mission_boss_components.png", "frames/log-entry.png", (1325, 608, 1738, 700)),
    Slice("ui_right_panel_mission_boss_components.png", "slots/relic-panel-small.png", (1326, 748, 1534, 852)),

    # Sheet F - slots / meters / popups / controls
    Slice("ui_slots_meters_popups_controls.png", "slots/skill.png", (39, 65, 175, 196)),
    Slice("ui_slots_meters_popups_controls.png", "slots/skill-selected.png", (230, 52, 378, 207)),
    Slice("ui_slots_meters_popups_controls.png", "slots/cooldown-overlay.png", (453, 65, 591, 196)),
    Slice("ui_slots_meters_popups_controls.png", "slots/item.png", (654, 65, 784, 196)),
    Slice("ui_slots_meters_popups_controls.png", "slots/equipment.png", (837, 65, 969, 197)),
    Slice("ui_slots_meters_popups_controls.png", "slots/relic.png", (1019, 65, 1152, 196)),
    Slice("ui_slots_meters_popups_controls.png", "slots/effect.png", (1195, 65, 1328, 196)),
    Slice("ui_slots_meters_popups_controls.png", "slots/empty.png", (39, 262, 177, 395)),
    Slice("ui_slots_meters_popups_controls.png", "slots/locked.png", (240, 262, 376, 393)),
    Slice("ui_slots_meters_popups_controls.png", "meters/hp-bar.png", (445, 263, 811, 308)),
    Slice("ui_slots_meters_popups_controls.png", "meters/hp-gauge.png", (875, 261, 1165, 309)),
    Slice("ui_slots_meters_popups_controls.png", "meters/mp-bar.png", (445, 358, 811, 404)),
    Slice("ui_slots_meters_popups_controls.png", "meters/dark-energy-bar.png", (860, 356, 1169, 407)),
    Slice("ui_slots_meters_popups_controls.png", "meters/boss-hp-bar.png", (36, 438, 689, 524)),
    Slice("ui_slots_meters_popups_controls.png", "meters/progress-bar.png", (770, 459, 1178, 507)),
    Slice("ui_slots_meters_popups_controls.png", "popups/tooltip.png", (1379, 59, 1748, 369)),
    Slice("ui_slots_meters_popups_controls.png", "popups/confirm.png", (26, 590, 317, 833)),
    Slice("ui_slots_meters_popups_controls.png", "popups/reward.png", (348, 592, 661, 838)),
    Slice("ui_slots_meters_popups_controls.png", "popups/boss-warning.png", (688, 587, 964, 830)),
    Slice("ui_slots_meters_popups_controls.png", "popups/settings.png", (996, 592, 1266, 833)),
    Slice("ui_slots_meters_popups_controls.png", "controls/checkbox-unchecked.png", (1297, 407, 1337, 447), "all"),
    Slice("ui_slots_meters_popups_controls.png", "controls/checkbox-checked.png", (1297, 468, 1337, 508), "all"),
    Slice("ui_slots_meters_popups_controls.png", "controls/toggle-off.png", (1288, 532, 1358, 568), "all"),
    Slice("ui_slots_meters_popups_controls.png", "controls/toggle-on.png", (1288, 587, 1358, 623), "all"),
    Slice("ui_slots_meters_popups_controls.png", "controls/cursor.png", (1641, 570, 1704, 666), "all"),
]


def is_checker_bg(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return max(r, g, b) - min(r, g, b) < 28 and min(r, g, b) > 220


def remove_background(crop: Image.Image, mode: Literal["border", "all"], trim: bool = True) -> Image.Image:
    img = crop.convert("RGBA")
    pix = img.load()
    w, h = img.size

    if mode == "all":
        for y in range(h):
            for x in range(w):
                if is_checker_bg(pix[x, y]):
                    pix[x, y] = (255, 255, 255, 0)
        return trim_alpha(img) if trim else img

    stack: list[tuple[int, int]] = []
    seen = [[False] * w for _ in range(h)]
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        if not is_checker_bg(pix[x, y]):
            continue
        pix[x, y] = (255, 255, 255, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return trim_alpha(img) if trim else img


def padded_box(
    box: tuple[int, int, int, int],
    size: tuple[int, int],
    pad_x: int,
    pad_y: int,
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    return (
        max(0, x0 - pad_x),
        max(0, y0 - pad_y),
        min(size[0], x1 + pad_x),
        min(size[1], y1 + pad_y),
    )


def component_boxes(img: Image.Image) -> list[tuple[int, int, int, int, int]]:
    alpha = img.getchannel("A")
    pix = alpha.load()
    w, h = img.size
    seen = [[False] * w for _ in range(h)]
    boxes: list[tuple[int, int, int, int, int]] = []

    for start_y in range(h):
        for start_x in range(w):
            if seen[start_y][start_x] or pix[start_x, start_y] == 0:
                continue
            stack = [(start_x, start_y)]
            seen[start_y][start_x] = True
            min_x = max_x = start_x
            min_y = max_y = start_y
            area = 0
            while stack:
                x, y = stack.pop()
                area += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or seen[ny][nx]:
                        continue
                    seen[ny][nx] = True
                    if pix[nx, ny] != 0:
                        stack.append((nx, ny))
            boxes.append((min_x, min_y, max_x + 1, max_y + 1, area))
    return boxes


def distance_to_box(point: tuple[float, float], box: tuple[int, int, int, int, int]) -> float:
    px, py = point
    x0, y0, x1, y1, _ = box
    dx = max(x0 - px, 0, px - x1)
    dy = max(y0 - py, 0, py - y1)
    return (dx * dx + dy * dy) ** 0.5


def clean_annotation_components(img: Image.Image, mode: Literal["border", "all"]) -> Image.Image:
    boxes = [box for box in component_boxes(img) if box[4] >= 8]
    if not boxes:
        return trim_alpha(img)

    center = (img.width / 2, img.height / 2)
    near = [box for box in boxes if distance_to_box(center, box) <= max(img.width, img.height) * 0.35]
    anchor_pool = near or boxes
    anchor = max(anchor_pool, key=lambda box: box[4] / (1 + distance_to_box(center, box)))
    ax0, ay0, ax1, ay1, _ = anchor

    keep = Image.new("RGBA", img.size, (255, 255, 255, 0))
    src = img.load()
    dst = keep.load()

    if mode == "all":
        band_pad = 12
        for x0, y0, x1, y1, _ in boxes:
            cy = (y0 + y1) / 2
            if ay0 - band_pad <= cy <= ay1 + band_pad:
                for y in range(y0, y1):
                    for x in range(x0, x1):
                        if src[x, y][3] != 0:
                            dst[x, y] = src[x, y]
        return trim_alpha(keep)

    box_pad = 4
    ex0 = max(0, ax0 - box_pad)
    ey0 = max(0, ay0 - box_pad)
    ex1 = min(img.width, ax1 + box_pad)
    ey1 = min(img.height, ay1 + box_pad)
    for x0, y0, x1, y1, _ in boxes:
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        intersects = x0 < ex1 and x1 > ex0 and y0 < ey1 and y1 > ey0
        centered = ex0 <= cx <= ex1 and ey0 <= cy <= ey1
        if intersects or centered:
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if src[x, y][3] != 0:
                        dst[x, y] = src[x, y]
    return trim_alpha(keep)


def trim_alpha(img: Image.Image, pad: int = 4) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return img
    x0, y0, x1, y1 = bbox
    trimmed = img.crop((x0, y0, x1, y1))
    out = Image.new("RGBA", (trimmed.width + pad * 2, trimmed.height + pad * 2), (255, 255, 255, 0))
    out.alpha_composite(trimmed, (pad, pad))
    return out


def validate_alpha(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    corners = [
        img.getpixel((0, 0))[3],
        img.getpixel((img.width - 1, 0))[3],
        img.getpixel((0, img.height - 1))[3],
        img.getpixel((img.width - 1, img.height - 1))[3],
    ]
    if any(a != 0 for a in corners):
        raise RuntimeError(f"non-transparent corner: {path}")


def scale_box(box: tuple[int, int, int, int], size: tuple[int, int], sheet_name: str) -> tuple[int, int, int, int]:
    if size == BASE_SIZE:
        return box

    sx = size[0] / BASE_SIZE[0]
    sy = size[1] / BASE_SIZE[1] if sheet_name in VERTICAL_SCALED_SHEETS else min(size[1] / BASE_SIZE[1], 1.0)
    x0, y0, x1, y1 = box
    scaled = (
        max(0, round(x0 * sx)),
        max(0, round(y0 * sy)),
        min(size[0], round(x1 * sx)),
        min(size[1], round(y1 * sy)),
    )
    if scaled[0] >= scaled[2] or scaled[1] >= scaled[3]:
        raise RuntimeError(f"invalid scaled box {box} -> {scaled} for image size {size}")
    return scaled


def localized_path(path: str, lang: str) -> Path:
    original = Path(path)
    return original.with_name(f"{original.stem}_{lang}{original.suffix}")


def output_path(path: str, lang: str) -> Path:
    if path in LOCALIZED_OUTPUTS:
        return localized_path(path, lang)
    return Path(path)


def remove_stale_common_localized_files() -> int:
    removed = 0
    for item in SLICES:
        if item.out in LOCALIZED_OUTPUTS:
            continue
        for lang in LANGUAGES:
            path = OUT_ROOT / localized_path(item.out, lang)
            if path.exists():
                path.unlink()
                removed += 1
    return removed


def main() -> None:
    total = 0
    for lang in LANGUAGES:
        source_root = OUT_ROOT / f"ui_overview_{lang}"
        sheet_cache: dict[str, Image.Image] = {}
        for item in SLICES:
            if item.out not in LOCALIZED_OUTPUTS and lang != LANGUAGES[0]:
                continue

            sheet_path = source_root / item.sheet
            if not sheet_path.exists():
                raise FileNotFoundError(sheet_path)
            if item.sheet not in sheet_cache:
                sheet_cache[item.sheet] = Image.open(sheet_path).convert("RGBA")

            sheet = sheet_cache[item.sheet]
            box = scale_box(item.box, sheet.size, item.sheet)
            is_rescaled = sheet.size != BASE_SIZE
            pad_x = 0 if item.bg == "all" else 34
            crop = sheet.crop(padded_box(box, sheet.size, pad_x, 2) if is_rescaled else box)
            out_img = remove_background(crop, item.bg, trim=not is_rescaled)
            if is_rescaled:
                out_img = clean_annotation_components(out_img, item.bg)
            out_path = OUT_ROOT / output_path(item.out, lang)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_img.save(out_path, "PNG", optimize=True, compress_level=9)
            validate_alpha(out_path)
            total += 1

    expected = {s.out for s in SLICES}
    if len(expected) != len(SLICES):
        raise RuntimeError("duplicate output path in slice table")
    removed = remove_stale_common_localized_files()
    print(f"Sliced {total} assets from overview sheets into {OUT_ROOT}")
    print(f"Removed {removed} stale localized copies of common assets")


if __name__ == "__main__":
    main()
