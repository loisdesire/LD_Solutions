"""One-off script: generate PWA icon files from public/logo.png.
Not part of the build - run manually if the source logo ever changes.
"""
from PIL import Image
import os

SRC = os.path.join('public', 'logo.png')
OUT_DIR = 'public'

logo = Image.open(SRC).convert('RGBA')

def square_canvas(size, bg, pad_frac):
    """Paste logo centered on a size x size canvas of `bg`, with padding
    on each side equal to pad_frac * size."""
    canvas = Image.new('RGBA', (size, size), bg)
    inner = int(size * (1 - 2 * pad_frac))
    # logo is not perfectly square (559x568) - scale to fit inner box
    lw, lh = logo.size
    scale = inner / max(lw, lh)
    resized = logo.resize((max(1, round(lw * scale)), max(1, round(lh * scale))), Image.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

WHITE = (255, 255, 255, 255)

# "any" purpose icons - standard app icon, modest padding, white ground
for size in (192, 512):
    square_canvas(size, WHITE, 0.12).save(os.path.join(OUT_DIR, f'icon-{size}.png'))

# "maskable" icons - OS may crop to a circle/squircle, so keep the mark
# well inside the safe zone (bigger padding)
for size in (192, 512):
    square_canvas(size, WHITE, 0.28).save(os.path.join(OUT_DIR, f'icon-maskable-{size}.png'))

# iOS home screen icon - must be fully opaque, no alpha
apple = square_canvas(180, WHITE, 0.14).convert('RGB')
apple.save(os.path.join(OUT_DIR, 'apple-touch-icon.png'))

print('done')
