# Changelog

## `@wired-square/kit`

### 0.3.0

- Under forced colours, a selected tab, filter or pill and a selected `PopoverOption` take `Highlight` rather than
  bold alone, and unselected tabs lose the underline forced colours gave every tab. A disabled field and an
  `aria-disabled` button or `MenuItem` read in `GrayText`, and `FeedStatus`'s dot stays drawn.
- `CopyButton` announces "Copied" through a polite status region beside the button. The glyph is hidden from the
  button's name, which no longer changes when it copies.
- A hovered danger button keeps its red background; the generic hover rule had replaced it.
- `createFlash(ms = 2000)` returns `[on, flashAfter]`: `on` turns true for `ms` once the promise given to
  `flashAfter` resolves, and a second flash restarts the timer. `flashAfter` hands back the promise's value or
  rejection, and a rejection leaves `on` off. `CopyButton` is built on it.
- `SearchInput` (`label`, `value`, `onValue`): a search box with autocorrect, autocapitalise and spellcheck off, and a
  Clear button while it holds an editable value, which empties it and returns focus to the box. Its glyph is `IconSet`'s `clear`.

### 0.2.0

- `Confirm` takes a `reason` (`{ label, placeholder? }`): a required field, with Confirm disabled until it is non-blank
  and `act` given it trimmed. `tone` is `danger` by default, or `primary`. Cancel stays disabled while it acts.
- `Popover` and `PopoverOption`: a panel pinned to any element on `popover="manual"`, closed by a press outside,
  Escape, a scroll outside or a resize, and taking focus only with `focusFirstItem`. `placePopover` is the one
  placement rule, and `Menu` now follows it, capping its height and keeping inside both edges. `MenuItem` takes
  `danger` and `disabled`. Escape closes a `Menu` without reaching a dialog around it, and closing one returns
  focus to its trigger. `testing/setup` shims `showPopover`. The `popover` attribute sets a WebKit 17 floor.
- `createSelection(visible, keyOf, resetOn)`, and `Tick`'s `mixed` for a select-all over part of it.
- `CopyButton`, with a `write` seam (default `navigator.clipboard.writeText`) and `IconSet`'s `copy` glyph.
- Times in three modes: `DateMode`, `formatWhen(at, mode, { locale, now, relative })`, and `DateModes` around the app
  with `DateModeToggle`, `When` and `useDateModes()` below it.
- `createAction`'s `succeed(sentence)` and `succeeded()`: a success sentence, for four seconds or until the next run.
- `ScreenBoundary`'s `pathname` is optional.
- `formatWhen`, `DateMode` and `placePopover` are in `@wired-square/kit/core` too.

### 0.1.0

The component kit from a prior appliance, as its own package.

- Components: `Badge`, `Button`, `IconButton`, `Confirm`, `Dialog`, `Field`, `Form`, `Loaded`, `Menu`, `Notice`,
  `PendingChange`, `PickFile`, `Pulse`, `FeedStatus`, `SchemePicker`, `ScreenBoundary`, `Section`, `Select`, `Table`,
  `Tabs`, `TextArea`, `Tick`, `Toggle`, `Views`, `NothingYet` and `Warnings`, with `createAction`,
  `createPagedList`, `keyedRows`, `latched`, `unchanged` and the formatters.
- `theme.css` (the `--app-*` tokens) and `kit.css` (the components' styles, in the `kit` cascade layer), imported by
  the app rather than by each component.
- `Refusal`, `refusalMessage` and `unanswered`: the error seam, in place of a transport's error class.
- `Pending<T>`, `Rollback`, `Warning`, `WarningScope` and `SettledBy`, declared by hand.
- `storedScheme(fallback)`, `applyScheme`, `chooseScheme`, `SCHEME_KEY`, and `SchemePicker`'s `choices`.
- `IconSet` and `KitIcons`, for the glyphs the kit draws.
- `applyTheme(tokens, darkTokens?)`, for token values applied at runtime.
- `@wired-square/kit/testing` (`mount`, `unmountAll`, `button`, `field`, `type`, `text`) and
  `@wired-square/kit/testing/setup` for vitest with jsdom; `mount`'s `around` goes outside a caller's `wrap`.
- `@wired-square/kit/core`: the modules with no JSX, compiled to JavaScript for plain node.

## `@wired-square/tokens`

### 0.1.0

The kit's 32 `--app-*` tokens as data: `light`, `dark`, the `TokenName` and `Tokens` types for `satisfies`, and
`groups`, with each token's group and note. `@wired-square/tokens/tokens.json` holds the same values as
`{ "--app-x": { "light": "…", "dark"?: "…" } }`. No dependencies and no peers.
