# Changelog

## `@wired-square/kit`

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
