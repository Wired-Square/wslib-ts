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
| `./icons.css` | The rules that let `--icon-stroke`, `--icon-sun` and `--icon-cloud` reach the components |
| `./sprite.svg` | Every glyph as a `<symbol id="icon-<name>">` |
| `./glyphs/<name>.svg` | Each glyph alone |

A glyph's name is its file's, in kebab-case: `alert`, `arrow-down`, `arrow-down-circle`, `arrow-left`, `arrow-right`,
`arrow-up`, `bang`, `bust`, `calendar`, `certificate`, `certificate-pen`, `certificate-struck`, `check`, `chevron-down`,
`chevron-left`, `chevron-right`, `chevron-up`, `clear`, `cloud`, `copy`, `database`, `envelope`, `envelope-key`, `exit`,
`film`, `gauge`, `handset`, `info`, `landscape`, `ledger`, `lock`, `moon`, `more`, `morse`, `overcast`, `page`,
`paperclip`, `pencil`, `plus`, `portico`, `safe`, `scheme-system`, `seal`, `server`, `speaker`, `speech-bubble`, `sun`,
`timer`, `trash`, `tunnel`, `unlock` and `x`.

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

The components carry no inline style, so they draw under a CSP of `style-src 'self'`. Each has a 2 `stroke-width` as
an attribute and the class `ws-icon`, so any stylesheet rule can set the width: `.large .ws-icon { stroke-width: 1.5; }`.
Import `@wired-square/icons/icons.css` to set it with `--icon-stroke` instead, on the svg or any ancestor:
`.large { --icon-stroke: 1.5; }`. A component's `class` joins `ws-icon`.

The sun in `sun` and `overcast` has the class `ws-icon-sun`, and the cloud in `cloud` and `overcast` `ws-icon-cloud`,
each drawn in `currentColor` unless a rule says otherwise. With `icons.css` they read `--icon-sun` and `--icon-cloud`:
`.weather { --icon-sun: var(--app-warn); }`.

The sprite and the glyph files set the stroke with an inline style that reads the same three properties, falling back
to 2 and `currentColor`, so they need no stylesheet, through a `<use>` too.

## Peers

- `solid-js` ^1.9.11, optional, for `./solid`.

`.`, `icons.css`, the sprite and the glyph files need nothing installed.
