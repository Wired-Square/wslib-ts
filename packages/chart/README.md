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

The chart fills the container's width and takes its height from the container's CSS height, so give the container
one. It redraws when the container resizes.

## Options

| Option | What |
|---|---|
| `window` | `{ from, to }` in ms since the epoch; points outside it are clipped |
| `series` | Each `{ id, label, points, kind, colour, axis? }`, drawn in order |
| `unit` | Shown after each value in the hover readout |
| `now` | A dashed marker, drawn when it falls inside the window |
| `formatValue` | Formats the y ticks and the readout's values; by default, at most two decimals |
| `yMin` | The y axis reaches down to at least this; without it, the axis spans the data |

A point is `[time, value]`. A `null` or `NaN` value is a gap: the line stops there and the readout shows a dash.

- `line` joins the points; the readout interpolates between them.
- `area` is a line filled down to zero, or to the axis's edge when zero is off the axis.
- `step` holds each point's value until the next point's time. The last point is drawn but holds no further, so to
  hold a value to the window's end, pass a point at the end with that value.

`colour` names a CSS custom property, such as `--app-accent`, and is drawn as `var(name)`. The axes, grid, cursor,
marker and readout use the kit's `--app-*` tokens, so load the kit's `theme.css` or define them. `axis` takes only
`"left"` for now.

Time ticks fall on the local clock's whole hours, every 1, 2, 3, 6, 12 or 24 hours, the finest that fits the width,
and a tick on a new day names it beneath its time. The y axis has three to five round ticks with grid lines.

Hovering or touching the chart shows a cursor and a readout of the time and each series' value then; it clears when
the pointer leaves. The chart's root is `.app-chart`, its readout `.app-chart-readout`.
