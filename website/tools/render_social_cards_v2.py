#!/usr/bin/env python3
"""Render the creative v2 social cards over supplied image backgrounds.

The backgrounds are intentionally text-free. Arabic copy is typeset here so it
stays accurate, editable, and consistent across the campaign.
"""

import argparse
import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
W = H = 1080
WHITE = "#fffaf2"
GOLD = "#f6c76a"
MUTED = "#d8cedf"
INK = (17, 9, 27)


CARDS = [
    {
        "filename": "01-right-solution.png",
        "side": "right",
        "number": "01 / 05",
        "tag": "حل يناسب شغلك",
        "title": [("مو كل مشروع", WHITE), ("يحتاج نفس الحل.", GOLD)],
        "subtitle": "نبدأ من المشكلة، مو من قائمة خدمات.",
    },
    {
        "filename": "02-social-needs-home.png",
        "side": "right",
        "number": "02 / 05",
        "tag": "حضور رقمي أوضح",
        "title": [("السوشيال مهم…", WHITE), ("بس مو كافي وحده.", GOLD)],
        "subtitle": "خلي الزبون يعرفك، يثق بيك، ويوصل لك بسهولة.",
    },
    {
        "filename": "03-customer-journey.png",
        "side": "left",
        "number": "03 / 05",
        "tag": "تدقيق رقمي",
        "title": [("وين تتعطّل", WHITE), ("رحلة الزبون؟", GOLD)],
        "subtitle": "من أول مشاهدة… لحد الرسالة والطلب.",
    },
    {
        "filename": "04-ai-with-you.png",
        "side": "right",
        "number": "04 / 05",
        "tag": "ذكاء تحت السيطرة",
        "title": [
            ("الذكاء الاصطناعي", WHITE),
            ("يشتغل وياك…", WHITE),
            ("مو بدالك.", GOLD),
        ],
        "subtitle": "يفهم الطلب، يرتّب الرد، ويرجعلك بالحالات المهمة.",
    },
    {
        "filename": "05-before-your-ad.png",
        "side": "left",
        "number": "05 / 05",
        "tag": "قبل حملتك الجاية",
        "title": [("قبل لا تصرف", WHITE), ("على إعلان…", GOLD)],
        "subtitle": "رتّب الطريق للزبون: عرض واضح، تواصل سهل، ومتابعة ما تضيع.",
    },
]


def font(path: Path, size: int, weight: int = 500) -> ImageFont.FreeTypeFont:
    face = ImageFont.truetype(
        str(path), size, layout_engine=ImageFont.Layout.RAQM
    )
    try:
        face.set_variation_by_axes([weight])
    except (AttributeError, OSError, TypeError):
        pass
    return face


def load_logo() -> Image.Image:
    raw = (ROOT / "assets" / "digital-compass-logo.svg").read_text()
    payload = re.search(r"base64,([^\"]+)", raw).group(1)
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")


def fit_square(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    edge = min(image.size)
    x = (image.width - edge) // 2
    y = (image.height - edge) // 2
    image = image.crop((x, y, x + edge, y + edge))
    return image.resize((W, H), Image.Resampling.LANCZOS)


def directional_overlay(side: str) -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pixels = overlay.load()
    for x in range(W):
        distance = x / (W - 1) if side == "right" else 1 - x / (W - 1)
        alpha = int(max(0, min(1, (distance - 0.30) / 0.56)) ** 1.55 * 224)
        for y in range(H):
            vertical = 1.0 if y < 850 else 1.0 - ((y - 850) / 230) * 0.32
            pixels[x, y] = (*INK, int(alpha * vertical))
    return overlay.filter(ImageFilter.GaussianBlur(10))


def bottom_overlay() -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(850, H):
        alpha = int(190 * ((y - 850) / 230) ** 1.4)
        draw.line((0, y, W, y), fill=(*INK, alpha))
    return overlay


def wrap_arabic(draw, text, face, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        box = draw.textbbox(
            (0, 0), candidate, font=face, direction="rtl", language="ar"
        )
        if current and box[2] - box[0] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def render(background: Path, spec: dict, font_path: Path, output: Path, logo):
    base = fit_square(background)
    base = ImageEnhance.Contrast(base).enhance(1.04).convert("RGBA")
    base = Image.alpha_composite(base, directional_overlay(spec["side"]))
    base = Image.alpha_composite(base, bottom_overlay())
    draw = ImageDraw.Draw(base, "RGBA")

    on_right = spec["side"] == "right"
    x = 1000 if on_right else 570
    anchor = "ra"
    tag_y = 145
    tag_face = font(font_path, 23, 600)
    title_face = font(font_path, 66 if len(spec["title"]) < 3 else 57, 800)
    subtitle_face = font(font_path, 27, 500)

    tag_box = draw.textbbox(
        (0, 0), spec["tag"], font=tag_face, direction="rtl", language="ar"
    )
    tag_w = tag_box[2] - tag_box[0] + 42
    draw.rounded_rectangle(
        (x - tag_w, tag_y - 14, x, tag_y + 34),
        radius=24,
        fill=(24, 14, 36, 232),
        outline=(246, 199, 106, 190),
        width=2,
    )
    draw.text(
        (x - 21, tag_y + 8),
        spec["tag"],
        font=tag_face,
        fill=GOLD,
        anchor="rm",
        direction="rtl",
        language="ar",
    )

    y = 232
    line_gap = 18
    for line, color in spec["title"]:
        draw.text(
            (x + 3, y + 5),
            line,
            font=title_face,
            fill=(0, 0, 0, 150),
            anchor=anchor,
            direction="rtl",
            language="ar",
        )
        draw.text(
            (x, y),
            line,
            font=title_face,
            fill=color,
            anchor=anchor,
            direction="rtl",
            language="ar",
            stroke_width=1,
            stroke_fill=(255, 255, 255, 20),
        )
        line_box = draw.textbbox(
            (0, 0), line, font=title_face, direction="rtl", language="ar"
        )
        y += line_box[3] - line_box[1] + line_gap

    draw.rounded_rectangle(
        (x - 82, y + 14, x, y + 19), radius=3, fill=GOLD
    )
    y += 52
    subtitle_width = 475
    for line in wrap_arabic(draw, spec["subtitle"], subtitle_face, subtitle_width):
        draw.text(
            (x, y),
            line,
            font=subtitle_face,
            fill=MUTED,
            anchor="ra",
            direction="rtl",
            language="ar",
        )
        y += 44

    mark = logo.copy()
    mark.thumbnail((180, 80), Image.Resampling.LANCZOS)
    mark_x = W - mark.width - 62
    mark_y = H - mark.height - 28
    base.alpha_composite(mark, (mark_x, mark_y))

    number_face = font(font_path, 20, 600)
    draw.text(
        (62, 1025),
        spec["number"],
        font=number_face,
        fill=(255, 255, 255, 150),
        anchor="lm",
    )
    draw.line((62, 980, 200, 980), fill=(246, 199, 106, 150), width=3)

    output.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(output, "PNG", compress_level=6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("backgrounds", nargs=5, type=Path)
    args = parser.parse_args()

    logo = load_logo()
    for background, spec in zip(args.backgrounds, CARDS):
        output = args.output_dir / spec["filename"]
        render(background, spec, args.font, output, logo)
        print(output)


if __name__ == "__main__":
    main()
