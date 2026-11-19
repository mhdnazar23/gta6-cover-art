# Neon Coast — GTA-style Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mhdnazar23/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mhdnazar23/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns any photo and caption into GTA-poster-style
cover art, exported as a PNG to share. Built for the
[make.fun "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Six layouts**: Grid 4, Hero + 3, Full Bleed, Nine Grid (3×3 with a title
  block), Tilted snapshots, and Duo Strip.
- **Six gradient-map grades**: Sunset, Neon, Golden Hour, Vice, Noir, and
  Original — colour is mapped through a sunset/neon ramp so any photo gets
  the Vice City poster look.
- **Any photo**: upload one or many photos, or use the two AI-made sample
  photos. Click a panel to select it, drag it to pan, and tune zoom and
  position per panel.
- **Bold lettering**: an editable Anton title (sunset-gradient, solid white,
  or neon outline), a Pacifico neon-script subtitle, a badge ribbon, and a
  star meter — all on a halftone title block, with grain and vignette.
- **Fast export**: one click writes all three post sizes at once —
  1080×1080, 1080×1350 and 1920×1080 PNGs. Undo and redo included.
- **Private by design**: everything runs in the browser from static files.
  Photos never leave the machine; there are no network requests.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Fonts: Anton and Pacifico, vendored under the SIL Open Font License
(`app/fonts/OFL-Anton.txt`, `app/fonts/OFL-Pacifico.txt`). The sample photos
are AI-made images supplied with the bounty kit, free to use. No Rockstar
Games logo, artwork, or font is used anywhere.
