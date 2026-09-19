#!/usr/bin/env python3
import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "social" / "rendered"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080
INK = "#150d1e"
PANEL = "#251834"
VIOLET = "#8c72bd"
GOLD = "#e8bd69"
PAPER = "#f7f2fb"
MUTED = "#b9acc8"
WHITE = "#ffffff"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def load_logo():
    raw = (ROOT / "assets" / "digital-compass-logo.svg").read_text()
    payload = re.search(r"base64,([^\"]+)", raw).group(1)
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")


LOGO = load_logo()


def rounded(draw, box, radius=24, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def ar(draw, xy, text, size, fill=WHITE, bold=True, anchor="ra", spacing=18):
    draw.multiline_text(
        xy,
        text,
        font=font(size, bold),
        fill=fill,
        anchor=anchor,
        align="right",
        direction="rtl",
        language="ar",
        spacing=spacing,
    )


def en(draw, xy, text, size, fill=GOLD, bold=True, anchor="la"):
    draw.text(xy, text, font=font(size, bold), fill=fill, anchor=anchor)


def base(number):
    image = Image.new("RGB", (W, H), INK)
    draw = ImageDraw.Draw(image, "RGBA")
    for y in range(H):
        t = y / (H - 1)
        a = (21, 13, 30)
        b = (37, 24, 52)
        color = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
        draw.line((0, y, W, y), fill=color)
    draw.ellipse((-310, -330, 430, 410), outline=(255, 255, 255, 25), width=2)
    draw.ellipse((-120, -140, 250, 230), outline=(232, 189, 105, 75), width=2)
    draw.line((76, 930, 1004, 930), fill=(255, 255, 255, 35), width=2)
    logo = LOGO.copy()
    logo.thumbnail((205, 92), Image.Resampling.LANCZOS)
    image.paste(logo, (76, 58), logo)
    en(draw, (1004, 87), f"DIGITAL COMPASS / {number}", 19, GOLD, True, "ra")
    return image, draw


def footer(draw, right_text):
    ar(draw, (1004, 984), right_text, 20, WHITE, True, "ra")
    en(draw, (76, 984), "DIGITAL-COMPASS-SITE", 15, MUTED, True, "la")


def card_1():
    image, draw = base("01")
    en(draw, (1004, 190), "THE METHOD", 21, GOLD, True, "ra")
    ar(draw, (1004, 255), "اكتشف. شخّص.", 74, WHITE)
    ar(draw, (1004, 360), "ابنِ. قِس.", 74, GOLD)
    labels = [("اكتشف الفرصة", "01"), ("شخّص المشكلة", "02"), ("ابنِ الحل", "03"), ("قِس التحسّن", "04")]
    boxes = [(550, 490, 1004, 655), (76, 490, 530, 655), (550, 680, 1004, 845), (76, 680, 530, 845)]
    for (label, number), box in zip(labels, boxes):
        rounded(draw, box, fill=(255, 255, 255, 12), outline=(255, 255, 255, 35), width=2)
        ar(draw, (box[2] - 28, box[3] - 34), label, 30, WHITE, True, "rs")
        en(draw, (box[0] + 28, box[1] + 28), number, 28, GOLD, True)
    footer(draw, "بوصلتك نحو النمو الرقمي")
    return image


def card_2():
    image, draw = base("02")
    en(draw, (1004, 190), "DIGITAL PRESENCE", 21, GOLD, True, "ra")
    ar(draw, (1004, 255), "هل السوشيال", 72, WHITE)
    ar(draw, (1004, 355), "وحده يكفي؟", 72, GOLD)
    labels = ["ماذا تقدم بوضوح؟", "لماذا يثق بك العميل؟", "كيف يتواصل أو يطلب؟", "أين يجد معلوماتك الرسمية؟"]
    boxes = [(550, 485, 1004, 640), (76, 485, 530, 640), (550, 665, 1004, 820), (76, 665, 530, 820)]
    for label, box in zip(labels, boxes):
        rounded(draw, box, fill=PAPER)
        ar(draw, (box[2] - 25, (box[1] + box[3]) // 2), label, 27, PANEL, True, "rm")
    footer(draw, "الموقع نقطة تجمع للثقة والتحويل")
    return image


def card_3():
    image, draw = base("03")
    en(draw, (1004, 190), "DIGITAL AUDIT", 21, GOLD, True, "ra")
    ar(draw, (1004, 255), "أين تضيع", 72, WHITE)
    ar(draw, (1004, 355), "فرص النمو؟", 72, GOLD)
    y = 600
    draw.line((115, y, 965, y), fill=VIOLET, width=5)
    labels = ["الوضوح", "الثقة", "التواصل", "السرعة", "المتابعة"]
    xs = [940, 735, 530, 325, 120]
    for i, (x, label) in enumerate(zip(xs, labels), 1):
        draw.ellipse((x - 34, y - 34, x + 34, y + 34), fill=PANEL, outline=GOLD, width=4)
        en(draw, (x, y), f"{i:02d}", 18, WHITE, True, "mm")
        ar(draw, (x, y + 72), label, 23, MUTED, True, "ma")
    ar(draw, (1004, 800), "التدقيق الحقيقي يبحث عن نقاط تسريب العميل،\nلا عن العيوب الشكلية فقط.", 30, WHITE, False)
    footer(draw, "اكتب «تدقيق» في رسالة")
    return image


def card_4():
    image, draw = base("04")
    en(draw, (1004, 190), "AI BUSINESS AGENTS", 21, GOLD, True, "ra")
    ar(draw, (1004, 255), "ذكاء اصطناعي", 68, WHITE)
    ar(draw, (1004, 350), "تحت السيطرة.", 68, GOLD)
    labels = [("رسالة واردة", "01"), ("تصنيف النية", "02"), ("مسودة رد", "03"), ("موافقة بشرية", "04")]
    boxes = [(784, 500, 1004, 720), (548, 500, 768, 720), (312, 500, 532, 720), (76, 500, 296, 720)]
    for index, ((label, number), box) in enumerate(zip(labels, boxes)):
        active = index == 3
        rounded(draw, box, fill=GOLD if active else (255, 255, 255, 12), outline=GOLD if active else (255, 255, 255, 35), width=2)
        en(draw, (box[0] + 22, box[1] + 24), number, 27, INK if active else GOLD, True)
        ar(draw, ((box[0] + box[2]) // 2, box[3] - 48), label, 24, INK if active else WHITE, True, "ms")
    ar(draw, (1004, 810), "أتمتة ضمن قواعد واضحة، وتحوّل إلى إنسان\nعندما يصبح القرار حساسًا.", 29, WHITE, False)
    footer(draw, "الأتمتة المفيدة تبدأ من سير العمل")
    return image


def card_5():
    image, draw = base("05")
    en(draw, (1004, 190), "BEFORE YOU SCALE", 21, GOLD, True, "ra")
    ar(draw, (1004, 255), "قبل الإعلان…", 70, WHITE)
    ar(draw, (1004, 350), "أصلح المسار.", 70, GOLD)
    labels = ["العرض واضح", "زر التواصل يعمل", "الرد سريع ومنظم", "يوجد دليل ثقة", "يمكن متابعة مصدر العميل"]
    y = 490
    for label in labels:
        draw.ellipse((940, y, 988, y + 48), fill=GOLD)
        en(draw, (964, y + 24), "✓", 25, INK, True, "mm")
        ar(draw, (915, y + 24), label, 29, WHITE, True, "rm")
        draw.line((76, y + 68, 1004, y + 68), fill=(255, 255, 255, 28), width=2)
        y += 82
    footer(draw, "أصلح التسريب، ثم وسّع الوصول")
    return image


CARDS = [
    ("01-growth-method.png", card_1),
    ("02-social-vs-website.png", card_2),
    ("03-growth-leaks.png", card_3),
    ("04-controlled-ai.png", card_4),
    ("05-before-ads.png", card_5),
]

for filename, renderer in CARDS:
    renderer().save(OUT / filename, "PNG", optimize=True)
    print(OUT / filename)
