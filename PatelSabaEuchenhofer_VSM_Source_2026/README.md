# Cities are losing their cool

A single-page scrollytelling site about rising urban temperatures across Europe,
with Frankfurt as a case study.

## Structure
```
site/
├── index.html
├── styles/
│   ├── tokens.css     # design system (fonts, palette, scale) — single source of truth
│   ├── base.css       # reset + shared primitives (content-box, title-box, reveal)
│   └── sections.css   # per-section + the pinned "scene" scroll primitive
├── scripts/
│   └── scroll.js      # Scrollama step controller + reveals + progress
└── assets/            # image/SVG exports from Figma
```

## Fonts
The whole site uses **one** font — **Array** (Fontshare). Array is a pixel/dot-grid
face: at the hero's huge size the dots read as a halftone; at title/body sizes they
merge into a solid bold grotesque.
- **Array 400** — hero display (dotted look)
- **Array 600 (Semibold)** — section titles + body copy
- **Array 700** — inline emphasis

Loaded from the Fontshare CDN in `index.html`.

## Local preview
Any static server, e.g.:
```bash
cd site && python3 -m http.server 8000
```
then open http://localhost:8000

## Deploy (GitHub Pages)
Push the contents of `site/` to the repository (root or `/docs`), then enable
Pages for that branch/folder. `.nojekyll` keeps Pages from processing the files.
