from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent / "screenshots"
OUT = ROOT / "contact-sheets"
OUT.mkdir(exist_ok=True)
ROUTES = [
    "dashboard", "admin-users", "contract-create", "contract-detail",
    "contract-edit", "contract-cover", "work-package", "contract-report",
    "reference-data", "station-list", "station-detail", "station-new",
    "inspection-list", "inspection-new", "inspection-quick", "checklist-no-round",
    "vehicle-api-no-round", "history-list", "history-detail-no-round",
    "history-vehicle-no-round", "history-revise-no-round",
]
EXTRA = ["station-new", "station-detail", "inspection-new", "checklist-no-round", "vehicle-api-no-round", "contract-report"]
SIZES = ["390", "768", "1440", "320", "375", "1024"]
FONT = ImageFont.load_default()

for size in SIZES:
    routes = ROUTES if size in {"390", "768", "1440"} else EXTRA
    tiles = []
    for route in routes:
        path = ROOT / f"{route}-{size}.png"
        if not path.exists():
            continue
        im = Image.open(path).convert("RGB")
        target_w = 180 if size in {"390", "320", "375"} else 210
        scale = target_w / im.width
        im = im.resize((target_w, round(im.height * scale)), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (target_w, im.height + 24), "white")
        tile.paste(im, (0, 24))
        ImageDraw.Draw(tile).text((4, 5), f"{route} · {size}px", fill="#172033", font=FONT)
        tiles.append(tile)
    columns = 4 if size in {"390", "320", "375"} else 5
    gap = 12
    rows = (len(tiles) + columns - 1) // columns
    cell_w = max(tile.width for tile in tiles)
    cell_h = max(tile.height for tile in tiles)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#e9edf3")
    for index, tile in enumerate(tiles):
        x = gap + (index % columns) * (cell_w + gap)
        y = gap + (index // columns) * (cell_h + gap)
        sheet.paste(tile, (x, y))
    sheet.save(OUT / f"routes-{size}.jpg", quality=90)
