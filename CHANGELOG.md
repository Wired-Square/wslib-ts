# Changelog

## `@wired-square/kit`

### 0.3.7

- The default glyphs other than `NothingYet`'s picture are written from `@wired-square/icons`' sources, which kit does
  not depend on. `Menu`'s default trigger is now an svg of three dots in place of the text "⋮", sized 1em and as
  tall as a line of text. `copy` is redrawn on a 24 grid with stroke 2, its back square cut behind the front;
  `schemeLight` and `schemeDark` take the set's `sun` and `moon`. Each reads `--icon-stroke` for its width, 2 by
  default.

### 0.3.6

- `theme.css` defines tokens 0.4.0's ten canvas tokens, which `@wired-square/canvas` draws with.

### 0.3.5

- `theme.css` defines tokens 0.3.0's nine serial console tokens, which `@wired-square/appliance-ui`'s
  `SerialConsole` draws with.
- A table's scroller is positioned, so a `Th unseen` label stays inside it rather than widening
  the page.

### 0.3.4

- `count` takes an irregular plural: `count(2, "person", "people")`.
- `size` dashes a missing size, as `num` does, and shows GiB from 1024 MiB.
- `day` shows a date-only `YYYY-MM-DD` as written, where it had read as UTC midnight and shown the day before west
  of UTC.

### 0.3.3

- An opened `Menu` focuses its `current` item, and its first item when none is current.
- `Menu` takes `chevron`: `IconSet`'s `chevron` after the trigger's face, out of its name, and turned while the menu
  is open. `KitIcons.chevron` is optional, so a full set written before it still type-checks; without one the kit's
  downward chevron is drawn.

### 0.3.2

- `MenuItem` takes `current`: `aria-current="page"` on the item, drawn bold as a selected `PopoverOption` is, and
  in `Highlight` under forced colours.

### 0.3.1

- `theme.css` defines tokens 0.2.0's six appliance tokens, which `@wired-square/appliance-ui` draws with.

### 0.3.0

- Under forced colours, a selected tab, filter or pill and a selected `PopoverOption` take `Highlight` rather than
  bold alone, and unselected tabs lose the underline forced colours gave every tab. A disabled field and an
  `aria-disabled` button or `MenuItem` read in `GrayText`, and `FeedStatus`'s dot stays drawn.
- `CopyButton` announces "Copied" through a polite status region beside the button. The glyph is hidden from the
  button's name, which no longer changes when it copies. While it shows, "Copied" appears twice in the text, so a
  test should find it by the `status` role rather than by text.
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

### 0.4.0

Ten tokens for `@wired-square/canvas`, each defaulting to an existing token, so they follow the scheme with light
values only: `--app-canvas-bg`, `--app-canvas-dot` (the dot grid), `--app-canvas-connection` (the line drawn while
connecting), `--app-canvas-chrome`, `-chrome-text`, `-chrome-hover` and `-chrome-border` (the controls and the
minimap's frame), and `--app-canvas-minimap-node`, `-minimap-mask` and `-minimap-view`. 57 tokens in all.

### 0.3.0

Nine tokens for `@wired-square/appliance-ui`'s serial console, with light and dark values: `--app-console-ansi-4`,
`-5` and `-6`, ANSI blue, magenta and cyan, which no status token stands for, and `--app-console-writer-0` to `-5`,
the colour each writer's input is drawn in. 47 tokens in all.

### 0.2.0

Six tokens for `@wired-square/appliance-ui`, with light values only: `--app-hostname` and `--app-hostname-contrast`
(the pill naming the box), `--app-qr-dark` and `--app-qr-light` (fixed, so a QR code is dark on light in either
scheme), and `--app-logo-size` and `--app-logo-size-welcome`. 38 tokens in all.

### 0.1.0

The kit's 32 `--app-*` tokens as data: `light`, `dark`, the `TokenName` and `Tokens` types for `satisfies`, and
`groups`, with each token's group and note. `@wired-square/tokens/tokens.json` holds the same values as
`{ "--app-x": { "light": "…", "dark"?: "…" } }`. No dependencies and no peers.

## `@wired-square/mcp-bridge`

### 0.1.0

The page half of wslib-mcp 0.1.1's `dom` and `tauri-bridge` features, as its own package, with behaviour and export
names unchanged.

- `@wired-square/mcp-bridge/dom-ops`: `domOps`, `DomOp`, `DOM_OPS`, `runDomOp`, `rectInViewport`,
  `clippingAncestor` and `describe`. Importing it starts capturing the console.
- `@wired-square/mcp-bridge/tauri-bridge`: `startHarnessBridge`, `answer`, `HarnessArgs`, `HarnessRequest`,
  `HarnessReply` and `AppOps`.
- The contract as data: `DOM_OP_CLASS` (`DomOpClass`, `read` or `drive` for each op), `REQUEST_EVENT`
  (`harness:request`) and `REPLY_EVENT` (`harness:reply`).
- No dependencies; `@tauri-apps/api` 2 is an optional peer, for `./tauri-bridge`.

## `@wired-square/appliance-types`

### 0.1.1

Generated from `wslib-appliance-types-v0.1.2`. `AppManifest` gains the optional `devices`, a list of `AppDevice`
(`class`, a `DeviceClass`, and for a USB class the optional `vids`, a list of `UsbVendorId`).

### 0.1.0

The appliance's wire types and limits, generated by ts-rs from wslib-rs's `wslib-appliance-types-v0.1.0`. Every type
and `constants` are exported from the root. No dependencies and no peers.

## `@wired-square/appliance-ui`

### 0.4.2

- At an app's root rendered without its trailing slash, `Chrome`'s switcher marks that app as current, not the
  console, so choosing the console loads it.

### 0.4.1

- `SerialConsole` is open once the back end attaches it, not when the socket opens. A console it refuses before
  attaching, on first opening or on reconnecting, is not dialled again: it shows the back end's message, if any,
  with Try again. `LinkState`'s `unreachable` carries that `message`.

### 0.4.0

- `SerialConsole`: a shared console on the app's `/ws/serial`, given its `url`, or a `port` (`ConsolePort`: `path`
  and `serialNumber`) and an optional `baud`, with a `label`. Given a port it offers the bauds, 115200 by default and
  74880 for an ESP32's boot ROM, and a new baud reopens it; the first to open a port sets its baud, so the heading
  names the port's baud once the back end says it, and the requested one until then. `readOnly` keeps it from
  typing, and `warning` is a short caution shown above it.
- Input is off until the viewer chooses Type, in each console and for that page only, and only while the session may
  write; Stop typing turns it off again, and is held while the port is paused. Keys are sent as a terminal sends
  them, Tab and Escape included, and a paste whole; Shift+Tab is never sent, and leaves the console. With input off,
  no key is taken from the page. Everyone attached sees each write, drawn in its writer's colour
  where the device echoes it, and as a marker naming the writer, never the bytes, where it does not; the device's
  output after a marker starts a new line. The attached are listed.
- The link and the port's state show inline. A console that drops reconnects, waiting up to 15 seconds, and marks
  where it did in the scrollback; one that never opened offers to try again. While the port is paused, as for a
  flash, the console stays attached and refuses input rather than queueing it.
- A refusal is said in one line under the scrollback, in plain words for its reason (paused, nothing reading the
  port, or watch only) with any detail from the back end beside it, and clears when the viewer next sends or the
  console reconnects.
- The wire types are generated from the back end's `wslib-serial-console` crate, by
  `scripts/serial-console-sync.mjs`.
- The scrollback's height follows the viewport's, between 8rem and 22rem, so the console fits in a dialog.
- ANSI blue, magenta and cyan are drawn in their own colours, not the accent.
- `applianceProxy` proxies `/ws` too, with its sockets.
- The kit peer is now ^0.3.5, for the console's tokens.

### 0.3.1

- The switcher's button and the folded account menu draw `Menu`'s `chevron` in place of the switcher's own, so the
  kit peer is now ^0.3.3.
- The product's `controls` and the account sit in `.app-masthead__tools`, which never wraps, so the account keeps to
  the controls' row and the inline account is never split. With no `controls`, the hostname joins the tools instead.
  As the window widens, the bar never gains a row.
- `Hostname` draws a dotted name as its first label over the rest of the domain, smaller and lighter, in a chip with
  a smaller radius, in the masthead and on the signed-out screens alike. Only the domain line shortens, to an
  ellipsis. A name with no dot, or an IP literal, stays one line. Screen readers hear "This box:" and the whole name
  as one string, and the chip carries it as a `title`.
- The account folds into its menu below 63rem rather than 40rem, and the menu's face is the username alone, cut short
  with an ellipsis on a row too narrow for it. Its name still says the username and the role.

### 0.3.0

- The masthead's brand, logo, name and maker, is the app switcher's button wherever `GET /api/switcher` gives at
  least one link, so an app installed later is offered without a reload. It keeps the brand's look, with a chevron,
  and is named `"<app name>, <maker>, switch app"`. The separate menu beside the hostname is gone. With no links the
  brand is the plain block it was, and the app name is no longer an `h1` while it is the button.
- Each item shows its app's logo, `<href>api/branding/logo`, beside the name, with the space kept where it does not
  load.
- `/api/switcher` is asked again each time the menu opens. Links that have not changed keep their items, so the focus
  the menu puts on the first stays there.
- The account folds into its menu below 40rem with or without a switcher; the 56rem rule is gone.

### 0.2.0

- `Chrome` has an app switcher: it reads `GET /api/switcher` (`AppLink[]`) once on mount, from the origin root rather
  than `document.baseURI`, so an app served under `/apps/<name>/` asks the console. Given two or more links it shows
  a `Menu` beside the hostname, named for the current app, the one whose `href` is the longest prefix of
  `location.pathname`, and marked current in the list. Choosing another is a full-page load of its `href`.
- The request is a plain `fetch`, not `api`: any failure, a 401 or a body that is not a list included, shows no
  switcher and leaves the masthead as it was, with no notice and no `onUnauthenticated` call.
- With a switcher in the bar, the account folds into its menu below 56rem rather than 40rem. The current app is a
  `current` `MenuItem`, so the kit peer is now ^0.3.2.

### 0.1.0

The appliance's browser half, which until 0.17.x was installed from git. Every name not listed below keeps its name
and entry point.

- `theme.css` is gone: its six tokens are tokens 0.2.0's, and `@wired-square/kit/theme.css` 0.3.1 defines them.
- Wire types and limits come from `@wired-square/appliance-types`, and `.` does not re-export them.
- `applianceVite` no longer adds Solid's plugin, `optimizeDeps.exclude` or `resolve.dedupe`; the app passes the
  plugin: `applianceVite({ plugins: [solid()] })`, so it now depends on `vite-plugin-solid` ^2.11.10 itself. `./vite`
  is compiled to `dist/`, with its own types.
- A lockfile from the git install still holds `@wired-square/appliance-ui@0.17.x`, and npm fails with
  `ERESOLVE` against the kit 0.3.1 peer until it goes. Delete its `node_modules/@wired-square/appliance-ui` entry
  from `package-lock.json` (or `npm uninstall @wired-square/appliance-ui` first), then install.
- The components no longer import their own CSS. The app imports, in order, `@wired-square/kit/theme.css`, its own
  token overrides, `@wired-square/kit/kit.css`, `@wired-square/appliance-ui/shell.css` (if it mounts `Shell` or
  `Chrome`) and the new `@wired-square/appliance-ui/appliance.css`.
- Ships TSX behind the `solid` condition. Peers, which the app installs each itself: `@wired-square/kit` ^0.3.1,
  `@wired-square/appliance-types` ^0.1.0, `solid-js` ^1.9.11, and `vite` ^8.0.0, optional, for `./vite`. `uqr`
  ^0.1.3 is its one dependency.

Moved names:

- From `@wired-square/appliance-ui` to `@wired-square/appliance-types`, the wire types: `AboutView`,
  `AddressConfig`, `ApiErrorBody`, `AppArch`, `AppCapability`, `AppHealth`, `AppImage`, `AppListener`,
  `AppManifest`, `AppNetwork`, `AppRole`, `AppSockets`, `AppVolume`, `AssertionCredential`, `AssertionResponse`,
  `AttestationResponse`, `AuditRecord`, `AuthenticatorSelection`, `Availability`, `BackupFile`, `BackupSchedule`,
  `BackupState`, `Branding`, `BrandingView`, `BundleHeader`, `CaCertificate`, `Caller`, `CertificateReport`,
  `CertificateView`, `Chosen`, `ClockSkew`, `ClockView`, `Contains`, `CreationOptions`, `CredentialDescriptor`,
  `CredentialParameters`, `EnabledChange`, `Enrolled`, `EnrolmentConfirm`, `Fact`, `FactorProof`,
  `FirstAccountBody`, `Inspection`, `InspectPeer`, `JsonValue`, `ListedUser`, `ListenerProtocol`, `LocalIdentity`,
  `LogLevel`, `LogRecord`, `LogSnapshot`, `NewUser`, `Ntp`, `Onboarding`, `OpenBundle`, `Page`, `PasskeyHost`,
  `PasskeyRegistration`, `PasskeyRename`, `PasskeyView`, `PasswordChange`, `PasswordReset`, `Peer`, `Pending`,
  `PendingEnrolment`, `PendingState`, `PinPeer`, `Reauthentication`, `RecoveryCodes`, `RegistrationCredential`,
  `RelyingPartyEntity`, `RequestOptions`, `ResetReport`, `RestoreBundle`, `RestoreReport`, `RestoreUnclaimed`,
  `Role`, `RoleChange`, `Rollback`, `ScheduleUpdate`, `ScheduleView`, `SecondStep`, `SettledBy`, `SignInBody`,
  `SignInCode`, `SignInMethod`, `Subsystem`, `TakeBackup`, `ThemeTokens`, `TotpConfirm`, `TotpEnrolment`,
  `TotpView`, `TrustedCa`, `TrustedCert`, `User`, `UserEntity`, `Warning` and `WarningScope`. The kit keeps its own
  `Pending`, `Rollback`, `SettledBy`, `Warning` and `WarningScope`, of the same shape, for its components; an
  appliance imports them from `@wired-square/appliance-types`.
- From `@wired-square/appliance-ui` to `@wired-square/appliance-types`, the constants: `TOKEN_PREFIX`, `MAX_TOKENS`,
  `MAX_VALUE_LEN`, `ROLE_LADDER`, `MIN_PASSWORD_LEN`, `MAX_PASSWORD_BYTES`, `MAX_USERNAME_LEN`,
  `MAX_PASSKEY_NAME_LEN`, `STALE_PROOF`, `MAX_AUDIT_PAGE`, `MAX_PEM_LEN`, `MAX_BUNDLE_LEN`, `MIN_PASSPHRASE_LEN`,
  `MIN_EVERY_HOURS`, `MAX_EVERY_HOURS`, `MIN_KEEP`, `MAX_KEEP`, `LOG_RING`, `LOG_LEVELS` and `FEED_HEARTBEAT_S`.
- From `@wired-square/appliance-ui` to `@wired-square/kit` (or `/core`): `Refusal` and `refusalMessage`.

## `@wired-square/canvas`

### 0.2.0

- Ports: an element in a node with `data-canvas-port="<id>"`, on the side its `data-canvas-side` names or else its
  node's side nearest it. A press on one starts a connection, as on `canvas-source`. A drop on another node's port,
  even where it stands out of the node, reports that port, and a drop elsewhere on a node reports none.
  `onConnect` takes a third argument, `{ sourcePort, targetPort }`, each `undefined` for a node-level end.
- `isValidConnection(source, sourcePort, target, targetPort)`: a refused drop is not reported. While a connection is
  drawn, the port or node under it wears `is-valid-target` or `is-invalid-target`, outlined in `--app-good` or
  `--app-bad`.
- `CanvasEdge` takes `sourcePort` and `targetPort`, and its `EdgeGeometry` then carries each port's anchor,
  `{ x, y, side }` in canvas coordinates at the middle of the port's outer side, once the port is measured. Ports are
  measured when their node mounts, resizes or its content changes, and when a connection starts; `offset` is the seam for a port's place in its node.
  An edge without ports is drawn as before.
- `data-canvas-port-kind="in"` or `"out"` on a port: a connection is reported with its `out` end, or the far end
  from an `in` port, as the source, whichever end it was drawn from. Two ports of the same kind never connect, are
  marked invalid, and are not put to `isValidConnection`.
- `connectionRadius`, in screen pixels: a connection's end that near a port lands on the nearest one, and the
  validity marks follow it. 0 by default, a hit as before.
- `bezierPath(source, target, curvature = 0.25)` from `./core`: an SVG path between two anchors whose ends leave
  along their sides, the curve React Flow draws.
- The line drawn from a port is `bezierPath` to the pointer, or to the port it would land on. From a
  `canvas-source` it stays straight.
- A `fitView` that animates while its nodes are measured lands on their measured bounds, and settles the same
  promise. It had framed a node just added at `unmeasuredSize`, clipping one taller.
- The fit at mount, without a `viewport`, refits as the canvas resizes and its nodes are measured, until the canvas
  is pressed or the camera moved.
- `fitPadding`: the padding of the mount fit, the Fit control and a `fitView` given none, read when each fit runs; 0.1 by default.
- `onEdgeClick(edge, event)`, for a click on an edge or its label, not after a drag. Edges take pointer events where
  they are painted; without `onEdgeClick`, a click on one is still a pane click.
- `@wired-square/canvas/react`: `Canvas`, `CanvasPanel`, `CanvasScope` and `useCanvas` for React 19, compiled to
  `dist/`. react and react-dom ^19.0.0 are optional peers beside solid-js.

### 0.1.0

A board canvas: a pannable, zoomable pane of nodes and edges, with a framework-free core and a Solid binding.

- `@wired-square/canvas/core`: `createCanvas(root, options)` and its `CanvasHandle` (`setNodes`, `setEdges`,
  `getNode`, `getNodes`, `getViewport`, `setViewport`, `setCentre`, `fitView`, `screenToCanvas` and
  `destroy`), `floatingAnchors`, and the types. The consumer mounts each node's content and draws each edge; the
  canvas keeps no selection, and reports clicks, hover, drags, connections and moves.
- Only the nodes and edges in view are mounted. Sizes come from a resize observer; `measure`, `observe` and `frame`
  are seams for tests.
- Classes the content wears: `nopan` on what must not pan or start a drag, `nowheel` on what the wheel must not zoom,
  and `canvas-source` on a connection's handle. The canvas wears `is-connecting` while a connection is drawn.
- A dot background, controls and a minimap, as options, and `.app-canvas-panel` for corner panels.
- `Canvas`, `CanvasPanel`, `CanvasScope` and `useCanvas`, as TSX behind the `solid` condition.
- `canvas.css`, in the cascade layer `canvas`. No dependencies; solid-js ^1.9.11 is an optional peer.

## `@wired-square/chart`

### 0.2.0

- `bands`: full-height tints over time ranges, each `{ from, to, colour, opacity? }`, drawn behind the grid and the
  series and clipped to the window. `Band` is exported.
- `yCap`: the y axis tops out at or below it, values above it are clipped, and each run above it is marked "↑" with
  its peak. The readout shows the real values. A cap at or below the axis's bottom is ignored.
- A zero line in `--app-border-strong` whenever zero is inside the y axis, not at its edge.

### 0.1.0

`createChart(container, options)`, a time-series chart drawn as SVG and sized to its container, returning `update`
and `destroy`. Line, area and step series clipped to a window, with gaps at missing values; time ticks stepped on the
local calendar from 5 minutes to 12 months and three to five y ticks; a fixed `yAxisWidth` for stacked charts; a
`now` marker; and a readout of each series' value on hover or tap. Colours
are CSS custom properties: each series names its own, and the axes use the kit's `--app-*` tokens. No dependencies
and no peers.

## `@wired-square/icons`

### 0.1.0

Twenty-one glyphs, one plain SVG each on a 24 grid with a 2 stroke in `currentColor` and round caps and joins:
alert, bang, check, chevron, clear, cloud, copy, database, info, lock, moon, more, overcast, pencil, plus,
scheme-system, sun, timer, trash, unlock and x. `./sprite.svg` holds each as a `<symbol id="icon-<name>">` that draws
with no CSS, and `./glyphs/<name>.svg` each alone. `.` exports `ICON_NAMES` and `IconName`; `./solid` one function
per glyph, in camelCase, behind the `solid` export condition, with `solid-js` an optional peer. `--icon-stroke` sets
the stroke's width; `--icon-sun` and `--icon-cloud` colour the sun and cloud parts. Some glyphs derive from Feather
(MIT) and Lucide (ISC), whose notices are in `LICENSE`.
