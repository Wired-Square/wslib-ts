# @wired-square/chart

A time-series chart drawn as plain SVG, with no framework, no dependencies and no peers. It is sized for a few series
of a few hundred points, redrawn when the data changes, with no animation.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/chart
```

Without a bundler, serve `dist/index.js` and `dist/scale.js` side by side: the first imports the second as
`./scale.js`.

## Use

```ts
import { createChart, type ChartOptions } from "@wired-square/chart";

const now = Date.now();
const options: ChartOptions = {
  window: { from: now - 86_400_000, to: now },
  now,
  unit: "kW",
  yMin: 0,
  series: [{ id: "load", label: "Load", kind: "area", colour: "--app-accent", points: [[now - 3_600_000, 0.8], [now, 1.2]] }],
};

const chart = createChart(document.getElementById("power")!, options);
chart.update({ ...options, now: Date.now() });
chart.destroy();
```

The chart fills the container's content box and takes its height from the container's CSS height, so give the
container one. It redraws when that box resizes, and never sets the container's size itself.

## Options

| Option | What |
|---|---|
| `window` | `{ from, to }` in ms since the epoch; points outside it are clipped |
| `series` | Each `{ id, label, points, kind, colour }`, drawn in order |
| `unit` | Shown after each value in the hover readout |
| `now` | A dashed marker, drawn when it falls inside the window |
| `formatValue` | Formats the y ticks and the readout's values; by default, at most two decimals, or as many as the ticks need |
| `yMin` | The y axis reaches down to at least this; without it, the axis spans the data |
| `yAxisWidth` | The y axis's width in px; give stacked charts the same one so their time axes line up. By default it fits the labels |

A point is `[time, value]`. A `null` or `NaN` value is a gap: the line stops there and the readout shows a dash.

- `line` joins the points; the readout interpolates between them.
- `area` is a line filled down to zero, or to the axis's edge when zero is off the axis.
- `step` holds each point's value until the next point's time. The last point is drawn but holds no further, so to
  hold a value to the window's end, pass a point at the end with that value.

`colour` names a CSS custom property, such as `--app-accent`, and is drawn as `var(name)`.

## Theme

The rest of the chart reads the kit's `--app-*` tokens, so load the kit's `theme.css` or define these. Without a
required one, what it styles is invisible or unreadable; an optional one falls back to what the chart inherits.

| Property | Required | Styles |
|---|---|---|
| `--app-text-muted` | yes | Tick labels, the cursor and the readout's time |
| `--app-border` | yes | Grid lines and the readout's border |
| `--app-border-strong` | yes | The time axis and its ticks |
| `--app-accent` | yes | The `now` marker |
| `--app-surface` | yes | The readout's background |
| `--app-text` | no | The readout's values |
| `--app-font` | no | All text |
| `--app-radius` | no | The readout's corners |
| `--app-shadow` | no | The readout's shadow |

## Axes and readout

Time ticks step on the local calendar: every 5, 10, 15 or 30 minutes, 1, 2, 3, 6 or 12 hours, 1, 2, 7 or 14 days
(weeks start on Monday), or 1, 3, 6 or 12 months, the finest that fits the width. Beneath the first tick, and
beneath each one that starts a new day (or month, or year), the chart names it. The y axis has three to five round
ticks with grid lines.

Hovering shows a cursor and a readout of the time and each series' value then; it clears when the pointer leaves. A
tap shows them until the next tap, on the chart or elsewhere. The chart's root is `.app-chart`, its readout
`.app-chart-readout`.
