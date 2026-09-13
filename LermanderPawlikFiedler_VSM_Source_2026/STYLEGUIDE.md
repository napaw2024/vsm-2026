# Fragmented Reality style guide

The canonical design values live in `src/styles/tokens.css`. Components consume those variables instead of redefining desktop and mobile sizes locally.

## Typography

| Role | Desktop | Column/mobile (`≤900px`) | Typeface |
| --- | ---: | ---: | --- |
| Navigation | 16px | 14px | Work Sans |
| Centered narrative | 24px | 20px | Georgia |
| Section title | 24px | 20px | Work Sans Semibold |
| Story copy | 20px | 16px | Georgia |
| Facts | 16px | 14px | Work Sans |
| Map labels | 12px | 11px | Work Sans |

Brand exceptions use Flor DeRuina, Ruina DeRuina, or Semilla DeRuina through the font-role tokens.

## Colours

Components never contain raw hex or RGB values. They use semantic tokens from `tokens.css`.

| Token role | Purpose |
| --- | --- |
| `--color-background` | Current section background |
| `--color-text` / `--color-title` | Narrative copy and headings |
| `--color-layout-panel` / `--color-sidebar` | Story and data panels |
| `--color-text-navi` / `--color-nav-*` | Main-navigation states |
| `--color-side-nav-*` | Side-navigation text, hover, and divider |
| `--color-mesh` | Mesh-size accents and the sound-hint border |
| `--color-map-outline` | Theme-aware map boundaries |
| `--color-data-annotation` | Fixed purple data labels and facts |
| `--color-forest` | Forest geometry |
| `--color-media-background` / `--color-on-media` | Full-screen media and its foreground text |

Dark- and bright-mode values are defined together in `tokens.css`; components do not decide theme colours themselves.

## Spacing

| Role | Desktop | Column/mobile (`≤900px`) |
| --- | ---: | ---: |
| Normal copy gap | 16px | 16px |
| Title to copy | 24px | 20px |
| Copy to facts | 32px | 24px |

## Responsive states

- `>900px`: left/right golden-ratio layout and desktop typography.
- `≤900px`: media/text column layout, mobile typography, and dynamic viewport sizing.
- `≤700px`: phone-specific rotated sequence media and compact navigation details.
- `≤1100px`: viewport-fit spacing and media scale adjustment; it does not create another layout or typography state.
- `≤1350px`: main-navigation gap adjustment only.

Breakpoint ownership is deliberate:

- `tokens.css` changes shared values at `1100px`, `900px`, and `700px`.
- `sections.css` has one column-layout block at `900px`, one phone block at `700px`, and one desktop block above `900px`.
- `navigation.css` owns its fit thresholds at `1350px`, `1100px`, and `900px`.
- `global.css` contains no component breakpoint overrides.

## Layout

- Desktop story/data sections use `--layout-copy-column: 38.2%` and `--layout-media-column: 61.8%`.
- Desktop panel padding is controlled by `--panel-padding-*` rather than component-level values.
- At `≤900px`, sections switch to one column with two `--column-row-height` rows.
- Mobile panel padding and sidebar widths are tokenized separately from desktop values.
- Full-screen mobile media uses dynamic viewport units so Safari browser controls do not expose page gaps.
- Animation coordinates and map/model calibration values remain local because they are scene-specific, not layout-system values.

## CSS responsibilities

- `tokens.css`: theme colours, font roles, type scale, spacing, layout variables.
- `global.css`: font loading, reset, and document-level defaults.
- `navigation.css`: main navigation, side navigation, sound control.
- `sections.css`: scrollytelling stages, section layouts, map, story, and media presentation.

## Naming

Component classes use a BEM-like pattern: `.component__element--modifier`. JavaScript state classes use `is-*`, and scroll-step selectors use `data-*` attributes.
