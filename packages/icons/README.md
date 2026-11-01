# @wired-square/icons

Wired Square's glyphs, one plain SVG each on a 24 grid, stroked in `currentColor` with round caps and joins: as a
sprite and as single files for any page, their names as data, and Solid components.

![The icons](preview.svg)

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/icons
```

## Entry points

| Subpath | What |
|---|---|
| `.` | Compiled JavaScript with types: `ICON_NAMES` and the `IconName` type |
| `./solid` | One function per glyph, named in camelCase (`schemeSystem` for `scheme-system`), as TSX behind the `solid` export condition |
| `./sprite.svg` | Every glyph as a `<symbol id="icon-<name>">` |
| `./glyphs/<name>.svg` | Each glyph alone |

A glyph's name is its file's, in kebab-case: `alert`, `bang`, `check`, `chevron`, `clear`, `cloud`, `copy`, `database`,
`info`, `lock`, `moon`, `more`, `overcast`, `pencil`, `plus`, `scheme-system`, `sun`, `timer`, `trash`, `unlock` and
`x`.

## Without a bundler

Copy `dist/sprite.svg` beside the page and point at a symbol. The stroke is set on each symbol, so no CSS is needed:

```html
<svg width="24" height="24" aria-hidden="true"><use href="sprite.svg#icon-check" /></svg>
```

## Solid

```tsx
import { IconSet } from "@wired-square/kit";
import { check, more } from "@wired-square/icons/solid";

<button type="button">{check()} Save</button>;
<span>{check({ "aria-hidden": false, role: "img", "aria-label": "Saved", width: "2em", height: "2em" })}</span>;
<IconSet icons={{ more }}>{/* every Menu below draws this more */}</IconSet>;
```

Each draws a 1em `<svg>`, hidden from assistive technology, and takes any SVG attribute over its defaults. Each has
the shape of a kit `IconSet` glyph, so it can stand in for one.

## Stroke and colour parts

`--icon-stroke` sets the stroke's width, 2 by default, on the svg or any ancestor, through a sprite's `<use>` too:
`.large { --icon-stroke: 1.5; }`.

The sun in `sun` and `overcast` reads `--icon-sun`, and the cloud in `cloud` and `overcast` reads `--icon-cloud`,
each falling back to `currentColor`: `.weather { --icon-sun: var(--app-warn); }`.

## Peers

- `solid-js` ^1.9.11, optional, for `./solid`.

`.`, the sprite and the glyph files need nothing installed.
