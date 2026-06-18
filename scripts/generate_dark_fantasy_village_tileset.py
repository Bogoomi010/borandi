#!/usr/bin/env python3
"""Generate a deterministic dark fantasy village pixel-art tileset sheet."""

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path


W, H = 2048, 1536
OUT = Path("src/assets/tilesets/dark-fantasy-village-tileset.png")
MANIFEST = Path("src/assets/tilesets/dark-fantasy-village-tileset.json")

WHITE = (255, 255, 255, 255)
INK = (22, 18, 24, 255)
STONE = (67, 68, 75, 255)
DARK_STONE = (42, 43, 50, 255)
LIGHT_STONE = (93, 93, 99, 255)
WOOD = (83, 54, 39, 255)
DARK_WOOD = (48, 31, 25, 255)
WOOD_HI = (119, 78, 49, 255)
ROTTEN = (60, 69, 48, 255)
DIRT = (61, 43, 34, 255)
ASH = (82, 78, 75, 255)
DEAD_GRASS = (92, 91, 56, 255)
PURPLE = (130, 64, 204, 255)
PURPLE_DARK = (75, 34, 125, 255)
PURPLE_GLOW = (181, 111, 255, 255)
ORANGE = (229, 116, 46, 255)
ORANGE_GLOW = (255, 180, 75, 255)
RED = (150, 35, 35, 255)
GREEN_DARK = (35, 69, 42, 255)
GREEN_POISON = (88, 147, 55, 255)
BONE = (177, 165, 135, 255)
PALE = (205, 198, 180, 255)
BLACK = (11, 10, 13, 255)


FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "&": ["01000", "10100", "10100", "01000", "10101", "10010", "01101"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.px = bytearray(WHITE * (w * h))

    def set(self, x: int, y: int, c: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            i = (y * self.w + x) * 4
            self.px[i : i + 4] = bytes(c)

    def rect(self, x: int, y: int, w: int, h: int, c: tuple[int, int, int, int]) -> None:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        for yy in range(y0, y1):
            row = (yy * self.w + x0) * 4
            self.px[row : row + (x1 - x0) * 4] = bytes(c) * (x1 - x0)

    def outline_rect(self, x: int, y: int, w: int, h: int, fill: tuple[int, int, int, int], outline=INK) -> None:
        self.rect(x, y, w, h, outline)
        self.rect(x + 4, y + 4, w - 8, h - 8, fill)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int, int], t: int = 4) -> None:
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.rect(x0 - t // 2, y0 - t // 2, t, t, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def poly(self, pts: list[tuple[int, int]], c: tuple[int, int, int, int]) -> None:
        ys = [p[1] for p in pts]
        for y in range(max(0, min(ys)), min(self.h, max(ys) + 1)):
            xs = []
            for i, (x1, y1) in enumerate(pts):
                x2, y2 = pts[(i + 1) % len(pts)]
                if y1 == y2:
                    continue
                if min(y1, y2) <= y < max(y1, y2):
                    xs.append(int(x1 + (y - y1) * (x2 - x1) / (y2 - y1)))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                self.rect(a, y, b - a + 1, 1, c)

    def circle(self, cx: int, cy: int, r: int, c: tuple[int, int, int, int]) -> None:
        for y in range(-r, r + 1):
            span = int((r * r - y * y) ** 0.5)
            self.rect(cx - span, cy + y, span * 2 + 1, 1, c)

    def save_png(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = bytearray()
        stride = self.w * 4
        for y in range(self.h):
            raw.append(0)
            raw.extend(self.px[y * stride : (y + 1) * stride])

        def chunk(kind: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        path.write_bytes(png)


c = Canvas(W, H)


def text(s: str, x: int, y: int, scale: int = 3, color=INK) -> None:
    cx = x
    for ch in s.upper():
        glyph = FONT.get(ch, FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "1":
                    c.rect(cx + gx * scale, y + gy * scale, scale, scale, color)
        cx += 6 * scale


def rune(x: int, y: int) -> None:
    c.poly([(x + 8, y), (x + 16, y + 8), (x + 8, y + 16), (x, y + 8)], PURPLE_DARK)
    c.poly([(x + 8, y + 3), (x + 13, y + 8), (x + 8, y + 13), (x + 3, y + 8)], PURPLE_GLOW)
    c.rect(x + 7, y + 5, 3, 7, PURPLE_DARK)


def label(name: str, x: int, y: int) -> None:
    rune(x, y + 1)
    text(name, x + 24, y, 3, INK)


def crack(x: int, y: int, length: int = 34) -> None:
    c.line(x, y, x + length // 3, y + 9, INK, 3)
    c.line(x + length // 3, y + 9, x + length, y - 3, INK, 3)


def draw_roof(x: int, y: int, w: int, h: int, fill=WOOD) -> None:
    c.poly([(x, y + h), (x + w // 2, y), (x + w, y + h)], INK)
    c.poly([(x + 8, y + h - 4), (x + w // 2, y + 8), (x + w - 8, y + h - 4)], fill)


def blocks(x: int, y: int, w: int, h: int) -> None:
    for yy in range(y + 10, y + h - 8, 18):
        off = 0 if (yy // 18) % 2 == 0 else 16
        for xx in range(x + 8 - off, x + w - 10, 32):
            c.rect(xx, yy, 22, 3, LIGHT_STONE)


def window(x: int, y: int, glow=PURPLE_GLOW) -> None:
    c.outline_rect(x, y, 22, 28, BLACK)
    c.rect(x + 6, y + 7, 10, 14, glow)
    c.rect(x + 10, y + 4, 4, 20, INK)


def house(kind: str, x: int, y: int) -> None:
    if kind == "cottage":
        draw_roof(x + 12, y + 8, 126, 58, DARK_WOOD)
        c.outline_rect(x + 24, y + 62, 102, 92, WOOD)
        for i in range(4):
            c.line(x + 34 + i * 24, y + 68, x + 22 + i * 25, y + 148, DARK_WOOD, 5)
        c.outline_rect(x + 64, y + 104, 30, 50, BLACK)
        window(x + 34, y + 84, ORANGE_GLOW)
        c.line(x + 105, y + 26, x + 132, y + 4, INK, 7)
        c.line(x + 113, y + 40, x + 145, y + 22, WOOD_HI, 5)
    elif kind == "stone":
        draw_roof(x + 6, y + 18, 132, 44, DARK_STONE)
        c.outline_rect(x + 20, y + 58, 112, 98, STONE)
        blocks(x + 20, y + 58, 112, 98)
        c.outline_rect(x + 68, y + 102, 34, 54, BLACK)
        window(x + 34, y + 82, PURPLE)
        crack(x + 94, y + 72)
    elif kind == "witch":
        c.outline_rect(x + 42, y + 74, 88, 76, DARK_WOOD)
        c.poly([(x + 18, y + 78), (x + 74, y + 4), (x + 150, y + 78)], INK)
        c.poly([(x + 30, y + 70), (x + 76, y + 14), (x + 138, y + 70)], (53, 37, 73, 255))
        c.rect(x + 66, y + 112, 32, 38, BLACK)
        window(x + 46, y + 88, PURPLE_GLOW)
        window(x + 104, y + 90, PURPLE_GLOW)
        lantern(x + 28, y + 130, PURPLE_GLOW)
        lantern(x + 138, y + 130, PURPLE_GLOW)
    elif kind == "rooted":
        draw_roof(x + 6, y + 10, 132, 52, (62, 45, 38, 255))
        c.outline_rect(x + 18, y + 60, 116, 92, (70, 59, 49, 255))
        c.outline_rect(x + 68, y + 104, 32, 48, BLACK)
        window(x + 34, y + 82, PURPLE_GLOW)
        for dx in [0, 18, 48, 85, 112]:
            c.line(x + dx, y + 154, x + 56 + dx // 3, y + 50 + dx // 4, DARK_WOOD, 6)
        c.circle(x + 116, y + 72, 10, GREEN_POISON)
    else:
        c.outline_rect(x + 6, y + 58, 142, 98, STONE)
        draw_roof(x, y + 12, 154, 52, DARK_STONE)
        c.outline_rect(x + 56, y + 92, 40, 64, BLACK)
        for dx in [22, 112]:
            c.rect(x + dx, y + 72, 14, 84, INK)
            c.rect(x + dx + 4, y + 76, 6, 76, LIGHT_STONE)
        window(x + 28, y + 86, ORANGE_GLOW)
        window(x + 110, y + 86, PURPLE_GLOW)
        crack(x + 100, y + 44, 48)


def lantern(x: int, y: int, glow=ORANGE_GLOW) -> None:
    c.line(x + 8, y - 18, x + 8, y, INK, 3)
    c.outline_rect(x, y, 18, 26, DARK_WOOD)
    c.rect(x + 5, y + 6, 8, 12, glow)


def forge(x: int, y: int) -> None:
    c.outline_rect(x + 8, y + 54, 154, 104, DARK_STONE)
    draw_roof(x, y + 12, 172, 50, BLACK)
    blocks(x + 8, y + 54, 154, 104)
    c.outline_rect(x + 58, y + 94, 56, 64, BLACK)
    c.rect(x + 67, y + 112, 38, 31, ORANGE)
    c.rect(x + 76, y + 119, 20, 17, ORANGE_GLOW)
    c.outline_rect(x + 122, y + 78, 30, 44, DARK_WOOD)
    c.line(x + 128, y + 84, x + 148, y + 110, LIGHT_STONE, 4)
    c.line(x + 148, y + 84, x + 128, y + 112, LIGHT_STONE, 4)
    c.rect(x + 72, y + 20, 26, 34, INK)
    c.rect(x + 78, y + 8, 14, 16, DARK_STONE)
    hanging_sign(x + 6, y + 88)


def crypt(x: int, y: int) -> None:
    c.outline_rect(x + 30, y + 42, 132, 112, STONE)
    c.poly([(x + 22, y + 52), (x + 96, y + 4), (x + 172, y + 52)], INK)
    c.poly([(x + 38, y + 48), (x + 96, y + 13), (x + 156, y + 48)], LIGHT_STONE)
    c.outline_rect(x + 76, y + 84, 42, 70, BLACK)
    for dx in [42, 136]:
        c.rect(x + dx, y + 62, 14, 92, INK)
        c.rect(x + dx + 4, y + 66, 6, 82, LIGHT_STONE)
    crack(x + 122, y + 68)
    brazier(x + 12, y + 132)
    brazier(x + 174, y + 132)


def brazier(x: int, y: int) -> None:
    c.rect(x, y + 18, 24, 8, INK)
    c.rect(x + 5, y + 24, 14, 14, DARK_STONE)
    c.poly([(x + 6, y + 18), (x + 12, y), (x + 20, y + 18)], ORANGE)
    c.poly([(x + 10, y + 15), (x + 14, y + 6), (x + 18, y + 15)], ORANGE_GLOW)


def farmland(kind: str, x: int, y: int) -> None:
    c.outline_rect(x, y, 106, 72, DIRT)
    for yy in range(y + 14, y + 58, 16):
        c.line(x + 10, yy, x + 96, yy - 3, (83, 58, 42, 255), 3)
    if kind == "dead":
        for i in range(7):
            sprig(x + 12 + i * 13, y + 46 - (i % 2) * 8, DEAD_GRASS)
    elif kind == "sprouts":
        for i in range(8):
            sprig(x + 10 + i * 11, y + 50 - (i % 3) * 7, PURPLE_GLOW)
    else:
        for i in range(6):
            crack(x + 12 + i * 14, y + 24 + (i % 2) * 13, 18)
        c.circle(x + 76, y + 42, 8, PURPLE_DARK)


def sprig(x: int, y: int, col=DEAD_GRASS) -> None:
    c.line(x, y, x, y - 16, col, 3)
    c.line(x, y - 8, x - 7, y - 15, col, 3)
    c.line(x, y - 10, x + 7, y - 17, col, 3)


def ground(kind: str, x: int, y: int) -> None:
    palette = {
        "dirt": DIRT,
        "ash": ASH,
        "grass": DEAD_GRASS,
        "stone": STONE,
        "corrupt": (51, 34, 54, 255),
        "blood": DIRT,
        "rune": DARK_STONE,
        "transition": DIRT,
    }
    c.outline_rect(x, y, 64, 64, palette[kind])
    if kind == "stone":
        for i in range(4):
            c.line(x + 12 + i * 10, y + 14, x + 30 + i * 7, y + 52, DARK_STONE, 3)
    elif kind == "grass":
        for i in range(9):
            sprig(x + 7 + i * 6, y + 54 - (i % 3) * 4, (124, 120, 65, 255))
    elif kind == "blood":
        c.circle(x + 25, y + 34, 10, RED)
        c.rect(x + 34, y + 42, 14, 6, RED)
    elif kind == "rune":
        rune(x + 24, y + 24)
    elif kind == "transition":
        for xx in range(8, 62, 10):
            sprig(x + xx, y + 52, DEAD_GRASS)
        c.rect(x + 4, y + 4, 56, 28, DIRT)
    elif kind == "corrupt":
        for i in range(4):
            c.line(x + 12 + i * 12, y + 50, x + 20 + i * 11, y + 12, PURPLE_DARK, 3)
    else:
        for i in range(10):
            c.rect(x + 7 + (i * 17) % 52, y + 10 + (i * 23) % 45, 7, 4, DARK_STONE if kind == "ash" else WOOD_HI)


def tree(kind: str, x: int, y: int, large: bool = False) -> None:
    trunk_w = 30 if not large else 48
    trunk_h = 96 if not large else 154
    base = y + (150 if not large else 220)
    c.rect(x + 60, base - trunk_h, trunk_w, trunk_h, INK)
    c.rect(x + 66, base - trunk_h + 4, trunk_w - 10, trunk_h - 6, DARK_WOOD)
    for pts in [
        ((x + 70, base - 76), (x + 30, base - 126)),
        ((x + 82, base - 98), (x + 122, base - 154)),
        ((x + 69, base - 50), (x + 22, base - 74)),
        ((x + 86, base - 58), (x + 134, base - 78)),
    ]:
        c.line(*pts[0], *pts[1], INK, 9 if not large else 12)
        c.line(*pts[0], *pts[1], DARK_WOOD, 5 if not large else 7)
    if kind in {"oak", "soul"}:
        for dx, dy, r in [(52, 34, 34), (92, 28, 40), (118, 56, 34), (70, 62, 38)]:
            c.circle(x + dx, y + dy, r, INK)
            c.circle(x + dx, y + dy, r - 7, GREEN_DARK if kind == "oak" else (49, 63, 57, 255))
        if kind == "soul":
            for dx, dy in [(58, 44), (94, 58), (122, 48), (76, 78)]:
                c.circle(x + dx, y + dy, 6, PURPLE_GLOW)
    if kind == "rotten":
        c.circle(x + 78, base - 68, 11, BLACK)
    if large:
        for dx in [18, 45, 105, 135]:
            c.line(x + 80, base - 10, x + dx, base + 20, INK, 10)
        for dx, dy in [(48, 92), (94, 70), (118, 118)]:
            rune(x + dx, y + dy)


def bush(kind: str, x: int, y: int) -> None:
    for dx, dy, r in [(15, 30, 18), (40, 22, 24), (68, 32, 18)]:
        c.circle(x + dx, y + dy, r, INK)
        c.circle(x + dx, y + dy, r - 5, GREEN_DARK)
    if kind == "thorn":
        for i in range(5):
            c.line(x + 14 + i * 13, y + 22, x + 4 + i * 17, y + 2, LIGHT_STONE, 3)
    elif kind == "poison":
        for i in range(4):
            flower(x + 22 + i * 12, y + 28 - (i % 2) * 8, GREEN_POISON)
    else:
        for i in range(6):
            c.circle(x + 14 + i * 10, y + 30 + (i % 2) * 8, 5, RED)


def log_item(kind: str, x: int, y: int) -> None:
    c.outline_rect(x + 6, y + 26, 78, 30, DARK_WOOD)
    c.circle(x + 10, y + 41, 17, INK)
    c.circle(x + 10, y + 41, 10, WOOD_HI)
    c.line(x + 26, y + 36, x + 78, y + 34, WOOD_HI, 3)
    if "broken" in kind:
        c.line(x + 48, y + 22, x + 44, y + 60, INK, 5)
    if "hollow" in kind:
        c.circle(x + 11, y + 41, 8, BLACK)
        rune(x + 52, y + 31)
    if "stump" in kind:
        c.outline_rect(x + 22, y + 18, 42, 52, DARK_WOOD)
        c.circle(x + 43, y + 18, 24, INK)
        c.circle(x + 43, y + 18, 16, WOOD_HI)
        if "glowing" in kind:
            c.circle(x + 44, y + 44, 8, PURPLE_GLOW)


def tombstone(x: int, y: int, broken: bool = False) -> None:
    c.outline_rect(x + 18, y + 18, 48, 70, STONE)
    c.circle(x + 42, y + 18, 25, INK)
    c.circle(x + 42, y + 20, 17, STONE)
    c.rect(x + 30, y + 48, 24, 5, DARK_STONE)
    if broken:
        c.line(x + 38, y + 8, x + 64, y + 36, INK, 6)


def coffin(x: int, y: int) -> None:
    c.poly([(x + 24, y), (x + 70, y), (x + 86, y + 28), (x + 74, y + 88), (x + 20, y + 88), (x + 8, y + 28)], INK)
    c.poly([(x + 29, y + 8), (x + 65, y + 8), (x + 77, y + 30), (x + 68, y + 80), (x + 26, y + 80), (x + 16, y + 30)], DARK_WOOD)
    c.rect(x + 45, y + 26, 5, 32, BONE)
    c.rect(x + 34, y + 39, 27, 5, BONE)


def candle_shrine(x: int, y: int) -> None:
    c.outline_rect(x + 8, y + 46, 74, 20, STONE)
    for dx in [18, 36, 56]:
        c.rect(x + dx, y + 24, 10, 24, PALE)
        c.poly([(x + dx, y + 24), (x + dx + 5, y + 10), (x + dx + 10, y + 24)], ORANGE_GLOW)
    rune(x + 34, y + 48)


def skull_pile(x: int, y: int) -> None:
    for dx, dy in [(14, 28), (42, 22), (62, 34), (32, 48)]:
        skull(x + dx, y + dy)


def skull(x: int, y: int) -> None:
    c.circle(x, y, 15, INK)
    c.circle(x, y, 11, BONE)
    c.rect(x - 7, y + 7, 14, 9, BONE)
    c.rect(x - 6, y - 1, 5, 5, BLACK)
    c.rect(x + 3, y - 1, 5, 5, BLACK)


def flower(x: int, y: int, col: tuple[int, int, int, int]) -> None:
    c.line(x, y + 22, x, y + 5, GREEN_DARK, 3)
    for dx, dy in [(0, 0), (-6, 4), (6, 4), (-3, -6), (3, -6)]:
        c.circle(x + dx, y + dy, 5, col)
    c.circle(x, y + 1, 3, ORANGE_GLOW)


def hanging_sign(x: int, y: int) -> None:
    c.line(x + 8, y - 20, x + 8, y + 14, INK, 4)
    c.outline_rect(x, y + 12, 48, 26, WOOD)


def prop(name: str, x: int, y: int) -> None:
    if name == "signpost":
        c.rect(x + 28, y + 20, 8, 62, DARK_WOOD)
        c.outline_rect(x + 8, y + 28, 52, 24, WOOD)
        c.line(x + 17, y + 40, x + 50, y + 40, INK, 3)
    elif name == "lantern":
        c.line(x + 30, y + 8, x + 30, y + 84, INK, 5)
        c.line(x + 30, y + 10, x + 56, y + 18, INK, 4)
        lantern(x + 52, y + 18)
    elif name == "mailbox":
        c.rect(x + 32, y + 40, 8, 38, DARK_WOOD)
        c.outline_rect(x + 10, y + 24, 48, 28, DARK_WOOD)
        c.circle(x + 52, y + 18, 9, BLACK)
    elif name == "notice":
        c.outline_rect(x + 8, y + 18, 64, 48, DARK_WOOD)
        for i in range(3):
            c.rect(x + 18, y + 28 + i * 11, 42, 4, PALE)
    elif name == "crate":
        c.outline_rect(x + 12, y + 28, 52, 52, WOOD)
        c.line(x + 16, y + 32, x + 60, y + 76, DARK_WOOD, 4)
        c.line(x + 60, y + 32, x + 16, y + 76, DARK_WOOD, 4)
    elif name == "barrel":
        c.outline_rect(x + 20, y + 20, 38, 60, WOOD)
        c.rect(x + 20, y + 34, 38, 5, DARK_STONE)
        c.rect(x + 20, y + 61, 38, 5, DARK_STONE)
    elif name == "sack":
        c.circle(x + 38, y + 50, 28, INK)
        c.circle(x + 38, y + 52, 22, (119, 102, 73, 255))
        c.rect(x + 26, y + 20, 22, 12, INK)
    elif name == "potionjar":
        c.outline_rect(x + 26, y + 28, 30, 42, PURPLE_DARK)
        c.rect(x + 31, y + 38, 20, 22, PURPLE_GLOW)
        c.rect(x + 32, y + 18, 18, 14, INK)
    elif name == "bench":
        c.rect(x + 8, y + 42, 64, 10, DARK_WOOD)
        c.rect(x + 12, y + 60, 58, 9, DARK_WOOD)
        c.line(x + 18, y + 52, x + 18, y + 78, INK, 4)
        c.line(x + 62, y + 52, x + 62, y + 78, INK, 4)
    elif name == "well":
        c.outline_rect(x + 10, y + 38, 64, 42, STONE)
        c.poly([(x + 4, y + 38), (x + 42, y + 8), (x + 82, y + 38)], INK)
        c.poly([(x + 15, y + 34), (x + 42, y + 16), (x + 72, y + 34)], DARK_WOOD)
    elif name == "bucket":
        c.outline_rect(x + 24, y + 40, 32, 34, DARK_WOOD)
        c.line(x + 24, y + 42, x + 40, y + 24, LIGHT_STONE, 3)
        c.line(x + 56, y + 42, x + 40, y + 24, LIGHT_STONE, 3)
    elif name == "cart":
        c.outline_rect(x + 8, y + 38, 64, 34, WOOD)
        c.circle(x + 20, y + 76, 10, INK)
        c.circle(x + 60, y + 76, 10, INK)
        c.line(x + 72, y + 44, x + 88, y + 26, DARK_WOOD, 5)
    elif name == "urn":
        c.circle(x + 40, y + 48, 28, INK)
        c.circle(x + 40, y + 50, 21, (102, 75, 55, 255))
        c.rect(x + 30, y + 18, 20, 12, INK)
    elif name in {"ritualplanter", "stoneplanter"}:
        c.outline_rect(x + 10, y + 46, 64, 26, DARK_STONE if name == "stoneplanter" else DARK_WOOD)
        for dx in [23, 40, 57]:
            sprig(x + dx, y + 48, PURPLE_GLOW if name == "ritualplanter" else DEAD_GRASS)
    elif name == "stall":
        c.outline_rect(x + 8, y + 40, 72, 36, DARK_WOOD)
        c.poly([(x + 2, y + 40), (x + 44, y + 12), (x + 86, y + 40)], INK)
        c.poly([(x + 12, y + 36), (x + 44, y + 20), (x + 76, y + 36)], (72, 30, 48, 255))
    elif name == "table":
        c.outline_rect(x + 6, y + 42, 74, 24, DARK_WOOD)
        rune(x + 34, y + 45)
        c.line(x + 18, y + 66, x + 18, y + 84, INK, 5)
        c.line(x + 66, y + 66, x + 66, y + 84, INK, 5)


def adventurer(name: str, x: int, y: int) -> None:
    if name == "weaponrack":
        c.rect(x + 12, y + 34, 60, 8, DARK_WOOD)
        c.line(x + 18, y + 20, x + 18, y + 82, INK, 4)
        c.line(x + 66, y + 20, x + 66, y + 82, INK, 4)
        c.line(x + 28, y + 18, x + 48, y + 70, LIGHT_STONE, 4)
        c.line(x + 56, y + 18, x + 40, y + 70, LIGHT_STONE, 4)
    elif name == "armor":
        c.circle(x + 42, y + 22, 14, LIGHT_STONE)
        c.outline_rect(x + 24, y + 38, 36, 42, DARK_STONE)
        c.line(x + 42, y + 80, x + 42, y + 96, INK, 5)
    elif name == "supplycart":
        prop("cart", x, y)
        c.rect(x + 26, y + 24, 18, 18, (119, 102, 73, 255))
    elif name == "barricade":
        for i in range(3):
            c.line(x + 12, y + 28 + i * 17, x + 76, y + 18 + i * 19, DARK_WOOD, 9)
        c.line(x + 18, y + 14, x + 64, y + 82, INK, 5)
    elif name == "potion":
        prop("potionjar", x, y)
    elif name == "pickaxe":
        c.line(x + 20, y + 78, x + 64, y + 22, DARK_WOOD, 6)
        c.line(x + 42, y + 22, x + 78, y + 20, LIGHT_STONE, 5)
        c.line(x + 42, y + 22, x + 30, y + 38, LIGHT_STONE, 5)
    elif name == "shovel":
        c.line(x + 42, y + 18, x + 42, y + 70, DARK_WOOD, 6)
        c.poly([(x + 28, y + 70), (x + 56, y + 70), (x + 42, y + 94)], LIGHT_STONE)
    elif name == "oillantern":
        lantern(x + 32, y + 34, ORANGE_GLOW)
    elif name == "woodencoffin":
        coffin(x, y)


def small(name: str, x: int, y: int) -> None:
    if name == "rocks":
        for dx, dy, r in [(6, 28, 8), (24, 22, 10), (44, 30, 7), (58, 20, 9)]:
            c.circle(x + dx, y + dy, r, DARK_STONE)
    elif name == "sprout":
        sprig(x + 28, y + 50, PURPLE_GLOW)
    elif name == "reeds":
        for i in range(5):
            c.line(x + 16 + i * 7, y + 52, x + 13 + i * 8, y + 18, DEAD_GRASS, 3)
    elif name == "grass":
        for i in range(6):
            sprig(x + 10 + i * 8, y + 54, DEAD_GRASS)
    elif name == "mushrooms":
        for i in range(4):
            c.rect(x + 18 + i * 10, y + 34, 5, 16, PALE)
            c.circle(x + 20 + i * 10, y + 32, 8, RED)
    elif name == "bones":
        c.line(x + 14, y + 42, x + 54, y + 28, BONE, 5)
        c.line(x + 18, y + 24, x + 48, y + 50, BONE, 5)
    elif name == "skull":
        skull(x + 34, y + 32)
    elif name == "candle":
        c.rect(x + 30, y + 26, 10, 24, PALE)
        c.poly([(x + 28, y + 26), (x + 35, y + 10), (x + 42, y + 26)], ORANGE_GLOW)
    elif name == "runestone":
        c.outline_rect(x + 24, y + 12, 28, 48, STONE)
        rune(x + 30, y + 26)
    elif name == "bat":
        c.circle(x + 38, y + 34, 5, BLACK)
        c.poly([(x + 36, y + 34), (x + 6, y + 18), (x + 20, y + 42)], BLACK)
        c.poly([(x + 40, y + 34), (x + 70, y + 18), (x + 56, y + 42)], BLACK)
    elif name == "feather":
        c.line(x + 20, y + 50, x + 58, y + 16, BLACK, 3)
        c.line(x + 28, y + 42, x + 18, y + 34, DARK_STONE, 3)
        c.line(x + 38, y + 34, x + 28, y + 25, DARK_STONE, 3)
    elif name == "web":
        for a in [(14, 14, 60, 14), (14, 14, 14, 60), (14, 14, 60, 60), (14, 38, 60, 18), (38, 14, 18, 60)]:
            c.line(x + a[0], y + a[1], x + a[2], y + a[3], LIGHT_STONE, 2)


def fence(kind: str, x: int, y: int) -> None:
    if kind == "wood":
        for px in [10, 38, 66]:
            c.outline_rect(x + px, y + 18, 12, 68, DARK_WOOD)
        c.line(x + 4, y + 38, x + 88, y + 28, DARK_WOOD, 8)
        c.line(x + 4, y + 68, x + 88, y + 58, DARK_WOOD, 8)
    elif kind == "iron":
        for px in [10, 28, 46, 64, 82]:
            c.line(x + px, y + 82, x + px, y + 14, INK, 5)
            c.poly([(x + px - 6, y + 18), (x + px, y), (x + px + 6, y + 18)], INK)
        c.rect(x + 4, y + 42, 88, 5, DARK_STONE)
    elif kind == "chain":
        c.line(x + 8, y + 20, x + 8, y + 86, DARK_STONE, 7)
        c.line(x + 86, y + 20, x + 86, y + 86, DARK_STONE, 7)
        for i in range(6):
            c.line(x + 12 + i * 12, y + 46, x + 24 + i * 12, y + 60, LIGHT_STONE, 3)
    else:
        c.outline_rect(x + 10, y + 18, 78, 78, INK)
        c.rect(x + 45, y + 24, 5, 70, DARK_STONE)
        c.poly([(x + 10, y + 18), (x + 49, y), (x + 88, y + 18)], INK)
        rune(x + 40, y + 46)


def section(items: list[str]) -> list[str]:
    return items


manifest = {
    "RUINED HOUSES": section(["Broken wooden cottage", "Abandoned stone house", "Witch hut with purple lanterns", "Corrupted house covered in roots", "Noble ruined manor"]),
    "BLACKSMITH": section(["Dark stone forge with glowing furnace, weapon rack, hanging sign"]),
    "CRYPT": section(["Ancient mausoleum with large stone entrance, broken pillars, small glowing braziers"]),
    "CORRUPTED FARMLANDS": section(["Dead crops", "Dark sprouts", "Cursed soil"]),
    "GROUND TILES": section(["Dark dirt", "Ash soil", "Dead grass", "Cracked stone", "Corrupted soil", "Blood-stained dirt", "Rune-marked ground", "Dirt-to-dead-grass transition"]),
    "TREES": section(["Twisted dead tree", "Large cursed oak", "Rotten tree", "Soulfruit tree with glowing fruit"]),
    "BUSHES": section(["Thorn bush", "Poison flower bush", "Bloodberry bush"]),
    "SPECIAL TREE": section(["Ancient cursed tree with twisted roots and purple glowing runes"]),
    "LOGS & STUMPS": section(["Rotten log", "Broken log", "Hollow cursed log", "Ancient stump", "Glowing stump"]),
    "GRAVEYARD PROPS": section(["Tombstone", "Broken tombstone", "Skull pile", "Coffin", "Candle shrine"]),
    "DARK PLANTS": section(["Ghost flower", "Poison flower", "Blood rose", "Black lily", "Purple thorn flower", "Pale funeral flower"]),
    "VILLAGE PROPS": section(["Wooden signpost", "Lantern post", "Crow mailbox", "Notice board", "Supply crate", "Barrel", "Sack", "Potion jar", "Wooden bench", "Stone well", "Bucket", "Merchant cart", "Clay urn", "Ritual planter", "Stone planter", "Dark market stall", "Ritual table", "Lantern post"]),
    "ADVENTURER PROPS": section(["Weapon rack", "Armor stand", "Supply cart", "Barricade", "Potion bottle", "Pickaxe", "Shovel", "Oil lantern", "Wooden coffin"]),
    "SMALL DETAILS": section(["4 dark rocks", "Tiny cursed sprout", "Dead reeds", "Dry grass tuft", "Red mushroom cluster", "Bone pile", "Skull", "Small candle", "Rune stone", "Bat", "Crow feather", "Spider web"]),
    "FENCES": section(["Rotten wooden fence", "Iron spike fence", "Chain fence", "Cemetery gate"]),
}


def draw_sheet() -> None:
    label("RUINED HOUSES", 44, 34)
    for i, kind in enumerate(["cottage", "stone", "witch", "rooted", "manor"]):
        house(kind, 42 + i * 170, 80)

    label("BLACKSMITH", 945, 34)
    forge(942, 78)
    label("CRYPT", 1222, 34)
    crypt(1210, 78)

    label("CORRUPTED FARMLANDS", 44, 288)
    for i, kind in enumerate(["dead", "sprouts", "cursed"]):
        farmland(kind, 50 + i * 124, 332)

    label("GROUND TILES", 455, 288)
    kinds = ["dirt", "ash", "grass", "stone", "corrupt", "blood", "rune", "transition"]
    for i, kind in enumerate(kinds):
        ground(kind, 458 + (i % 4) * 78, 330 + (i // 4) * 78)

    label("TREES", 830, 288)
    for i, kind in enumerate(["twisted", "oak", "rotten", "soul"]):
        tree(kind, 812 + i * 136, 318)

    label("BUSHES", 1394, 288)
    for i, kind in enumerate(["thorn", "poison", "berry"]):
        bush(kind, 1398 + i * 100, 350)

    label("SPECIAL TREE", 44, 540)
    tree("ancient", 40, 584, True)

    label("LOGS & STUMPS", 294, 540)
    for i, kind in enumerate(["rotten", "broken", "hollow", "stump", "glowing stump"]):
        log_item(kind, 296 + i * 100, 594)

    label("GRAVEYARD PROPS", 846, 540)
    tombstone(846, 588)
    tombstone(936, 588, True)
    skull_pile(1032, 604)
    coffin(1126, 588)
    candle_shrine(1228, 604)

    label("DARK PLANTS", 1394, 540)
    plant_cols = [PURPLE_GLOW, GREEN_POISON, RED, BLACK, PURPLE, PALE]
    for i, col in enumerate(plant_cols):
        flower(1410 + i * 74, 636, col)

    label("VILLAGE PROPS", 44, 835)
    village = ["signpost", "lantern", "mailbox", "notice", "crate", "barrel", "sack", "potionjar", "bench", "well", "bucket", "cart", "urn", "ritualplanter", "stoneplanter", "stall", "table", "lantern"]
    for i, name in enumerate(village):
        prop(name, 48 + (i % 9) * 104, 880 + (i // 9) * 108)

    label("ADVENTURER PROPS", 1038, 835)
    adv = ["weaponrack", "armor", "supplycart", "barricade", "potion", "pickaxe", "shovel", "oillantern", "woodencoffin"]
    for i, name in enumerate(adv):
        adventurer(name, 1042 + (i % 5) * 110, 880 + (i // 5) * 112)

    label("SMALL DETAILS", 44, 1172)
    smalls = ["rocks", "sprout", "reeds", "grass", "mushrooms", "bones", "skull", "candle", "runestone", "bat", "feather", "web"]
    for i, name in enumerate(smalls):
        small(name, 50 + i * 82, 1222)

    label("FENCES", 1080, 1172)
    for i, kind in enumerate(["wood", "iron", "chain", "gate"]):
        fence(kind, 1084 + i * 120, 1214)


draw_sheet()
c.save_png(OUT)
MANIFEST.write_text(json.dumps({"canvas": {"width": W, "height": H, "aspect_ratio": "4:3"}, "sections": manifest}, indent=2) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({W}x{H})")
print(f"wrote {MANIFEST}")
