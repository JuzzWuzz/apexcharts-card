# ApexCharts Card

A custom Home Assistant Lovelace card for rendering time-series and energy data via [ApexCharts.js](https://apexcharts.com).

This is a heavily modified fork of [RomRider/apexcharts-card](https://github.com/RomRider/apexcharts-card), redesigned around an MQTT-driven data model and period-based navigation.

---

## How It Works

The card does not read entity state history directly. Instead, it operates through a **request/response pattern over MQTT**:

1. The card publishes a data request to `graphs/{entity}` whenever the user navigates dates, changes the period, switches series sets, or the auto-refresh timer fires.
2. A backend service processes the request and writes the result back into the HA entity's `attributes`.
3. The card reads `hass.states[entity].attributes` to render the chart.

This means the card requires a companion backend that subscribes to the MQTT topic and populates the entity attributes.

### MQTT Request Payload

Published to `graphs/{config.entity}`:

```json
{
  "dataTypeGroup": "a",
  "period": "month",
  "series": [{ "index": 0 }, { "index": 1 }],
  "seriesSet": "My Series Set",
  "timeDate": "2026-03-01T00:00:00.000Z",
  "timeStart": "2026-03-01T00:00:00.000Z",
  "timeEnd": "2026-03-31T23:59:59.999Z",
  "timeLiveData": false
}
```

### Entity Attribute Response

The backend populates these attributes on the entity:

```json
{
  "timeStart": "...",
  "timeEnd": "...",
  "timeDate": "...",
  "timeLiveData": true,
  "period": "month",
  "seriesSet": "My Series Set",
  "dataInterval": { "amount": 1, "unit": "day", "unitPlural": "days" },
  "series": [
    { "index": 0, "data": [[timestamp_ms, value], ...], "minMax": { ... } }
  ]
}
```

---

## Installation

Copy `dist/apexcharts-card.js` to your Home Assistant `www/` folder and register it as a resource:

```yaml
resources:
  - url: /local/apexcharts-card.js
    type: module
```

---

## Configuration

### Minimal Example

```yaml
type: custom:apexcharts-card
entity: sensor.my_graph_entity
seriesSets:
  - name: Power
    series:
      - index: 0
        name: Solar
      - index: 1
        name: Grid
```

### Full Configuration Reference

```yaml
type: custom:apexcharts-card

# Required: The HA entity that carries the graph data in its attributes.
entity: sensor.my_graph_entity

# Optional: Override the default color palette.
colorList:
  - "#e74c3c"
  - "#3498db"

# Optional: Chart type. Defaults to "line". Applies to all series unless overridden per-series.
chartType: line   # "line" | "scatter"

# Optional: Default period shown on first load.
period: month   # day | week | month | year | -1h | -3h | -6h | -12h

# Optional: Show the date navigation toolbar. Defaults to true.
showDateSelector: true

# Optional: Auto-refresh interval in seconds. Only fires while viewing live data.
autoRefreshTime: 300

# Optional: Remember the last-used period and series set across page reloads.
rememberOptions: false

# Optional: Header configuration.
header:
  show: true
  title: My Chart
  showStates: true       # Show per-series values below the title
  colorizeStates: true   # Colour each value to match its series
  appendSeriesSetName: false  # Append the active series set name to the title

# Optional: "Now" vertical line annotation on the chart.
now:
  show: true
  color: "#ff0000"
  label: Now

# Optional: Show/hide card elements.
show:
  lastUpdated: true   # Timestamp in bottom-right corner
  loading: true       # Loading spinner

# Optional: Default configuration applied to every series (can be overridden per-series).
allSeriesConfig:
  type: line           # line | column | area
  curve: smooth        # smooth | straight | stepline
  strokeWidth: 2
  opacity: 0.7
  dataType: DEFAULT    # DEFAULT | ENERGY | POWER | TEMPERATURE | PERCENTAGE

# Optional: Default configuration applied to every y-axis.
allYaxisConfig:
  minValue: 0
  maxValue: auto
  show: true
  floatPrecision: 2

# Required: One or more series sets. If more than one, a dropdown selector appears.
seriesSets:
  - name: Power Overview
    series:
      - index: 0
        name: Solar
        type: area
        color: "#f1c40f"
        dataType: POWER
        yAxisId: power
      - index: 1
        name: Grid
        type: line
        color: "#e74c3c"
        dataType: POWER
        yAxisId: power
    yAxes:
      - id: power
        dataType: POWER
        minValue: 0
        maxValue: auto
        show: true

# Optional: Pass additional ApexCharts options directly (merged over generated config).
apexConfig:
  chart:
    toolbar:
      show: false
```

---

## Series Sets

Each series set defines a named group of data series. The card sends the active series set's name and series indices to the backend via MQTT, allowing the backend to return the appropriate data.

If more than one series set is configured, a dropdown selector appears at the bottom of the card.

### Data Type Groups

The series set `dataTypeGroup` is derived automatically from the `dataType` of the first series:

| Group | dataType values | Chart style |
|---|---|---|
| A | DEFAULT, POWER, TEMPERATURE, PERCENTAGE | Line/area with datetime x-axis |
| B | ENERGY | Bar chart with category x-axis |

Group B charts use a **category axis** (one bar per data point) rather than a continuous datetime axis. The x-axis labels are automatically thinned based on the data interval to avoid crowding.

---

## Period Navigation

The toolbar at the top of the card provides:

- **← / →** arrows to step backward/forward by one period
- **Calendar icon** to open a date picker
- **NOW button** to jump back to the current live window
- **Refresh icon** to manually trigger a data refresh

### Available Periods

| Value | Description |
|---|---|
| `day` | Full calendar day |
| `week` | Mon–Sun week |
| `month` | Full calendar month |
| `year` | Full calendar year |
| `-1h` | Last 1 hour (live, no nav) |
| `-3h` | Last 3 hours (live, no nav) |
| `-6h` | Last 6 hours (live, no nav) |
| `-12h` | Last 12 hours (live, no nav) |

---

## Series Configuration

Each series in a series set can override any `allSeriesConfig` property:

| Field | Type | Description |
|---|---|---|
| `index` | number | **Required.** Series index passed to the backend |
| `name` | string | Display name in header and legend |
| `type` | string | `line` \| `column` \| `area` |
| `color` | string | Hex or CSS colour |
| `dataType` | DataType | Controls unit formatting and y-axis scaling |
| `curve` | string | `smooth` \| `straight` \| `stepline` |
| `strokeWidth` | number | Line width in px |
| `opacity` | number | Fill opacity for area charts |
| `yAxisId` | string | ID of the y-axis this series uses |
| `show.inChart` | boolean | Whether to render this series on the chart |
| `show.inHeader` | boolean | Whether to show this series' value in the header |
| `show.legendValue` | boolean | Show value in the legend |
| `show.legendFunction` | string | `last` \| `sum` — how the legend value is computed |
| `show.nameInHeader` | boolean | Show series name alongside value in header |
| `show.extremas` | boolean \| `"min"` \| `"max"` | Show min/max annotations on chart |
| `clampNegative` | boolean | Force negative values to zero |

---

## Y-Axis Configuration

Each y-axis can be independently configured:

| Field | Type | Description |
|---|---|---|
| `id` | string | ID referenced by series `yAxisId` |
| `dataType` | DataType | Controls tick label formatting |
| `minValue` | number \| `"auto"` | Axis minimum |
| `maxValue` | number \| `"auto"` | Axis maximum |
| `show` | boolean | Show or hide this axis |
| `opposite` | boolean | Place axis on right side |
| `floatPrecision` | number | Decimal places on tick labels |
| `alignTo` | number | Align tick count to a multiple |
| `apexConfig` | object | Raw ApexCharts yaxis options merged in |

---

## Advanced: `apexConfig`

Any raw [ApexCharts options](https://apexcharts.com/docs/options/) can be injected via `apexConfig` at the card level or per y-axis. The value is deep-merged over the generated config.

String values prefixed with `func:` are evaluated as JavaScript functions:

```yaml
apexConfig:
  yaxis:
    labels:
      formatter: "func:(val) => val.toFixed(1) + ' kW'"
```

> **Warning:** `func:` uses `eval()` internally. Only use trusted values from your own configuration.

---

## Building from Source

```bash
npm install
npm run build          # Development build (shows v1.2.1.bldXX in footer)
npm run build --release  # Release build (clean version string)
npm start              # Watch mode with live server on :5001
```

Output: `dist/apexcharts-card.js`
