"""
Regenerate the web icons in docs/ from the desktop app's launcher icon.

    python3 assets/make_icons.py        # needs Pillow

The site's icons are deliberately the *same artwork* as the macOS launcher
(`Verbos de Español.app`), so the web version looks like the same product when
it's bookmarked, added to a home screen, or shared as a link. `appicon.icns`
here is a copy of that app's icon, kept in the repo so this is reproducible
without the .app being present.

Run this only when the artwork changes — the outputs are committed, and
`artifact/build.py` does not depend on Pillow.

Outputs (all into docs/):
    favicon-16.png, favicon-32.png   browser tab
    apple-touch-icon.png (180px)     iOS home screen / share sheet
    og-image.png (1200x630)          link preview card in Messages, Slack, etc.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
DOCS = HERE.parent / "docs"
ICNS = HERE / "appicon.icns"


def load_source():
    """Extract the largest PNG from the .icns via macOS `iconutil`."""
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "appicon.iconset"
        subprocess.run(
            ["iconutil", "-c", "iconset", str(ICNS), "-o", str(iconset)], check=True
        )
        largest = max(iconset.glob("*.png"), key=lambda p: Image.open(p).width)
        return Image.open(largest).convert("RGBA").copy()


def main():
    if not ICNS.exists():
        sys.exit(f"Missing {ICNS}")
    src = load_source()

    # Sampled from inside the book's spine: the flat dark red the artwork sits
    # on. Used wherever transparency isn't safe, and as the theme colour in
    # artifact/build.py — keep the two in step if the artwork changes.
    bg = src.getpixel((int(src.width * 0.06), int(src.height * 0.5)))[:3]

    # Favicons keep their transparent corners; browsers composite them fine.
    for n in (16, 32):
        src.resize((n, n), Image.LANCZOS).save(DOCS / f"favicon-{n}.png")

    # iOS renders transparent touch-icon pixels as black, so flatten first. The
    # square corners don't show — iOS applies its own rounded mask.
    touch = Image.new("RGB", (180, 180), bg)
    scaled = src.resize((180, 180), Image.LANCZOS)
    touch.paste(scaled, (0, 0), scaled)
    touch.save(DOCS / "apple-touch-icon.png")

    # Link-preview card: the icon centred on the same red, at the 1.91:1 that
    # Messages, Slack and the rest crop to.
    og = Image.new("RGB", (1200, 630), bg)
    side = 480
    icon = src.resize((side, side), Image.LANCZOS)
    og.paste(icon, ((1200 - side) // 2, (630 - side) // 2), icon)
    og.save(DOCS / "og-image.png")

    print(f"background {bg} (#{bg[0]:02x}{bg[1]:02x}{bg[2]:02x})")
    for name in ("favicon-16", "favicon-32", "apple-touch-icon", "og-image"):
        f = DOCS / f"{name}.png"
        print(f"  {f.name:24} {Image.open(f).size}  {f.stat().st_size:>6} bytes")


if __name__ == "__main__":
    main()
