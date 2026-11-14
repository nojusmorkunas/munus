# Munus logo

<img src="munus-logo-horizontal.svg" height="64" alt="Munus logo" />

A present whose bow is a lowercase m. At a glance it's a gift; look again and it's Munus.

## Files

| File | Use it for |
|---|---|
| `munus-logo-horizontal.svg` | Default logo on light backgrounds |
| `munus-logo-horizontal-on-dark.svg` | Default logo on dark backgrounds |
| `munus-logo-stacked.svg`, `munus-logo-stacked-on-dark.svg` | Narrow or square spaces (login card, social posts) |
| `munus-symbol.svg` | The mark alone, where the name is already nearby |
| `munus-app-icon.svg` | Rose tile with the cream mark (README, avatars) |
| `munus-wordmark.svg`, `munus-wordmark-white.svg` | The name alone |
| `*-black.svg`, `*-white.svg` | One-colour printing, engraving, stamps |

The app's own icons live in `frontend/public`:

| File | What it is |
|---|---|
| `favicon.svg`, `favicon.ico` | 16 px cut, drawn on a 16-pixel grid so it stays sharp in a browser tab (`.ico` holds 16, 32 and 48 px) |
| `apple-touch-icon.png` | 180 px, full bleed (iOS rounds the corners) |
| `icon-192.png`, `icon-512.png` | Rounded tile with transparent corners (manifest `any`) |
| `icon-maskable-192.png`, `icon-maskable-512.png` | Full bleed, mark inside the 80 % safe circle (manifest `maskable`) |

In the app, use `MunusLogo` and `MunusMark` from `frontend/src/components/MunusLogo.tsx`. The symbol stays rose and the wordmark follows the text colour, so both themes work.

## Colours

| Name | HEX | RGB | Role |
|---|---|---|---|
| Rose | `#E11D48` | 225, 29, 72 | The symbol, app tile |
| Cream | `#FFF7ED` | 255, 247, 237 | Mark on the rose tile, app background colour |
| Ink | `#1C1917` | 28, 25, 23 | Wordmark on light backgrounds |

Cream on rose is 4.4 : 1, rose on white is 4.7 : 1. Both are above the 3 : 1 needed for graphics.

## Spacing and size

- **Clear space:** keep at least the height of the lid (about a fifth of the symbol's height) free on every side.
- **Minimum size:** symbol 16 px, horizontal logo 24 px tall (about 90 px wide), stacked logo 64 px wide.
- Below 32 px use the favicon cut, not `munus-symbol.svg`: it drops the gap between lid and base and puts every edge on a whole pixel.

## Construction

On a 256 grid: the lid is 184 × 36, the base 156 × 80, both with a corner radius of 10. The gap between lid and base and the gap between the m and the lid are both 10. The ribbon is a vertical gap exactly as wide as the m's stems (22). The m's arches have a centreline radius of 26.

The wordmark is drawn, not typed: geometric lowercase letters with an x-height of 128, a stroke of 28 and arches with a centreline radius of 32. There's no font to license or install.

Lockups:

- **Horizontal:** the wordmark's x-height is 54 % of the symbol's height, centred on the symbol. The gap between them is 0.58 × the x-height.
- **Stacked:** the wordmark is centred under the symbol, its x-height 28 % of the symbol's height, one lid height below the base.

The concept rounds behind this logo are in `docs/munus-logo-concepts-3.png` (round 1) and `docs/munus-logo-concepts-4.png` (round 2, where Gift m was picked).

## Don't

- Use colours other than the ones in the files above, or add gradients, shadows or outlines.
- Put the old bow back on, or set the name in a font next to the symbol instead of the wordmark.
- Stretch, rotate or re-space the lockups.
- Put the rose symbol on red or busy photos. Use the white version or the app tile instead.
- Use the 16 px favicon cut at large sizes.
