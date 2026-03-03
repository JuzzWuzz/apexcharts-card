# AGENTS.md — AI Agent Instructions for apexcharts-card

## Project Overview

Custom Home Assistant Lovelace card (fork of RomRider/apexcharts-card).
Renders time-series and energy data via ApexCharts v5 inside a LitElement Shadow DOM.
Data flows via MQTT: the card publishes requests, the backend responds by updating a HA entity whose attributes carry the data.

- **Stack**: LitElement 3, ApexCharts 5, TypeScript 5, Rollup 4, Luxon 3
- **Output**: Single ES module → `dist/apexcharts-card.js`

---

## Build

```bash
npm run build             # ts-interface-builder → eslint --fix → rollup
npm run build --release   # Same as main build but removes the .bldXX from view
npm start                 # rollup --watch (dev, with live server on :5001)
```

**Build steps in order**:
1. `ts-interface-builder src/types-config.ts` → regenerates `src/types-config-ti.ts` (auto-generated, never edit by hand)
2. `eslint --fix src/**/*.ts` — ESLint v8 + @typescript-eslint v7 (held at v8/v7, v9 has breaking flat-config changes)
3. `rollup -c rollup.config.js`— Optional `--release` to run a release build. Only run a release build when requested. 

### BUILD_NUMBER rule (critical)
`BUILD_NUMBER` lives in `src/const.ts`. It is displayed in the card footer as `v1.2.0.bld23` (dev mode only).

> **Always bump `BUILD_NUMBER` before every `npm run build`** that produces a testable dist.
> Reset to `1` when bumping the semver in `package.json`.

---

## Repository Layout

```
src/
  apexcharts-card.ts   Main LitElement card component (all UI, state, MQTT)
  apex-layouts.ts      ApexCharts options builder (no side effects)
  utils.ts             Pure utility functions (dates, formatting, config generation)
  types.ts             Runtime interfaces (CardConfig, CardSeries, DataInterval, …)
  types-config.ts      Config schema enums & interfaces (Period, DataTypeGroup, …)
  types-config-ti.ts   AUTO-GENERATED — do not edit
  types-ha.ts          HA UI format enums
  styles.ts            All component CSS (LitElement css`…`)
  const.ts             Constants: BUILD_NUMBER, DEFAULT_COLORS, DEFAULT_SERIES_TYPE, …

dist/
  apexcharts-card.js   Compiled output — copy this to HA www/

../juzz-ha-helper/     Local sibling package (file: dep)
  HomeAssistant, DataType, DataTypeConfig, getDataTypeConfig, LovelaceCard
```

---

## Architecture

### Data Flow

```
HA entity state changes
  → set hass()
    → _updateData(newEntityState=true)
      reads entity.attributes: { timeStart, timeEnd, timeDate, timeLiveData,
                                  period, seriesSet, series[], dataInterval }
      calls apexChart.updateOptions(getLayoutConfig(…))

User interaction (arrows, calendar, series select)
  → _updateDate(date) | _calendarPreset() | _pickSeriesSet()
    → callService()  [MQTT publish to graphs/{entity}]
      payload: { dataTypeGroup, period, series[], seriesSet,
                 timeDate, timeStart, timeEnd, timeLiveData }
      backend processes → entity updates → set hass() cycle repeats

Auto-refresh timer (every autoRefreshTime seconds)
  → only fires if _timeViewingLiveData === true
  → if currentTime > _timeEnd: _updateDate(now)  [slide window]
  → else: callService()  [re-fetch same window]
```

### Live vs Historical state

`_timeViewingLiveData` is **derived automatically** inside `_updateDate()`:
```typescript
if (_timeStart <= now && _timeEnd >= now) → true
else → false
```
Do **not** set `_timeViewingLiveData` manually at call sites.

---

## Key Files — Responsibilities & Rules

### `src/apexcharts-card.ts`

**State fields** (selected):
| Field | Type | Purpose |
|---|---|---|
| `_period` | `Period` | Active period (DAY/WEEK/MONTH/YEAR or LAST_*H) |
| `_timeDate` | `DateTime?` | Anchor date for range calculation |
| `_timeStart / _timeEnd` | `DateTime?` | Computed range boundaries |
| `_timeViewingLiveData` | `boolean` | Whether the current window includes now |
| `_dataInterval` | `DataInterval?` | Interval granularity from server (drives tooltip format) |
| `_seriesSet` | `SeriesSetConfig?` | Currently displayed series set |
| `_calendarOpen` | `boolean` | Calendar popup visibility |

**`shouldUpdate` allow-list**: Any new `@state` fields that affect rendering **must** be added to the `shouldUpdate` prop list (`_config`, `_timeDate`, `_error`, `_lastUpdated`, `_period`, `_seriesSet`, `_calendarOpen`, `_calendarViewDate`, `_calendarSelectedDate`). If omitted, Lit will not re-render when the field changes.

**`initTimer()`**: Calls `_pickToday()` on first run to establish the initial window. Only one timer runs at a time (`!this._refreshTimer` guard).

**`_refresh()`**: Two distinct paths — never merge them:
- Historical (`!_timeViewingLiveData`): `callService()` only, no date mutation
- Live: slide forward if elapsed, otherwise `callService()`

**`_updateDate()`**: The single source of truth for date + live-data state. Always goes through this when navigating dates.

### `src/apex-layouts.ts`

`getLayoutConfig()` is a **pure function** — no side effects, no class access. Returns a full `ApexOptions` object.

Signature:
```typescript
export function getLayoutConfig(
  config: CardConfig,
  dataTypeGroup?: DataTypeGroup,
  series: CardSeries[] = [],
  yaxis: YAxisConfig[] = [],
  now: Date = new Date(),
  start?: Date,
  end?: Date,
  period?: Period,
  dataInterval?: DataInterval,
): ApexOptions
```

**Never add `chart: { width: "100%" }` here.** Width is exclusively managed by `initGraph()` + the `_sizeObserver` ResizeObserver.

**Tooltip x-axis format** (driven by `dataInterval.unit`):
| unit | format |
|---|---|
| `minute` / `hour` / undefined | `d MMM yyyy, HH:mm` |
| `day` | `d MMMM yyyy` |
| `week` | `d MMM - d MMM yyyy` (or `d MMM yyyy - d MMM yyyy` if cross-year) |
| `month` | `MMMM yyyy` |
| `year` | `yyyy` |

### `src/utils.ts`

All functions are pure (no class or DOM access). Key functions to know:

- `generateBaseConfig(conf)` — validates via ts-interface-checker, merges defaults
- `generateSeriesSets(conf)` — processes `allSeriesConfig`, builds `SeriesSetConfig[]`
- `generateSeries(entity, conf, seriesSetConf)` — extracts data from entity attributes
- `calculateNewDates(date, period)` — computes `{startDate, endDate}` from anchor + period
- `getPeriodDuration(period)` — returns Luxon `Duration` for a given `Period`
- `getDateRangeLabel(start, end, period)` — UI label for the date selector
- `formatValueAndUom(value, dataTypeConfig, clamp)` — value + unit formatting

### `src/types-config.ts`

**`Period` enum values** (must match what the server expects):
```typescript
enum Period {
  LAST_HOUR = "-1h",  LAST_THREE_HOUR = "-3h",
  LAST_SIX_HOUR = "-6h",  LAST_TWELVE_HOUR = "-12h",
  DAY = "day",  WEEK = "week",  MONTH = "month",  YEAR = "year",
}
```

**`DataTypeGroup`**: `A` = time-series (datetime x-axis), `B` = energy/category (string x-axis labels).

When adding new enum values to `types-config.ts`, the build will regenerate `types-config-ti.ts` automatically via `ts-interface-builder`.

### `src/styles.ts`

All CSS lives here as a single `css\`…\`` export. Structure:
- Host / card layout
- `#date-selector` — toolbar row
- `.today-btn` — "Now" button
- Focus suppression: `ha-icon-button:focus:not(:focus-visible)` and `button:focus:not(:focus-visible)` suppress mouse-click focus rings while preserving keyboard nav
- Calendar popup: `#cal-backdrop` (z-index 998), `#calendar-popup` (z-index 999, `position: fixed` to escape `overflow: hidden`)
- Calendar internals: presets, nav, grid, day cells
- Series selector, states header, last updated, spinner

---

## Local Dependency: juzz-ha-helper

Located at `../juzz-ha-helper` (sibling directory). Declared as `"file:../juzz-ha-helper"` in `package.json`.

Key exports:
- `HomeAssistant` — full HA object (states, callService, etc.)
- `LovelaceCard` — interface for HA card registration
- `DataType` enum — `DEFAULT | ENERGY | PERCENTAGE | POWER | TEMPERATURE`
- `DataTypeConfig` — precision, unit, unitStep, unitSeparator
- `getDataTypeConfig(dataType)` — returns `DataTypeConfig` for a given `DataType`

Do not attempt to import HA types from `home-assistant-frontend` — use `juzz-ha-helper` wrappers.

---

## HA Component Patterns

### `ha-icon-button`
Use `.path=${mdiIconPath}` from `@mdi/js`. Events via `@click`. Do not use `mwc-icon-button` directly.

### `ha-select` + `mwc-list-item`
In the current HA version deployed here, `ha-select`:
- Requires children as `<mwc-list-item .value=${val}>` — the `.options` array property is **not** supported
- Use `@selected` event with `ev.target.value` — `@value-changed` is **not** reliably fired

### Calendar popup positioning
Use `getBoundingClientRect()` on the trigger button, then `position: fixed` with `top`/`right` to position the popup. This escapes `ha-card { overflow: hidden }`. The backdrop (`#cal-backdrop`) handles dismiss-on-click-outside.

---

## MQTT Payload

Published to topic `graphs/{config.entity}`:
```typescript
{
  dataTypeGroup: string,     // "a" | "b"
  period: string,            // Period enum value e.g. "day", "week", "month"
  series: Array<{ index: number }>,
  seriesSet: string,         // Name of the active SeriesSetConfig
  timeDate: string,          // ISO UTC — anchor date
  timeStart: string,         // ISO UTC — range start
  timeEnd: string,           // ISO UTC — range end
  timeLiveData: boolean,     // Whether viewing the live window
}
```

Server responds by updating `hass.states[entity].attributes` with:
```typescript
{
  timeStart, timeEnd, timeDate, timeLiveData,
  period, seriesSet,
  series: Array<EntitySeries>,   // { data: DataPoint[], index, minMax }
  dataInterval: { amount: number, unit: DataIntervalUnit, unitPlural: string },
}
```

---

## Coding Conventions

- **Date/time**: Luxon `DateTime` and `Duration` throughout. Moment.js is fully removed.
- **No `width: "100%"` in `getLayoutConfig()`** — see Shadow DOM fix above.
- **No manual `_timeViewingLiveData` mutation** outside `_updateDate()`.
- **`@state()` additions must be added to `shouldUpdate`** prop list.
- **`types-config-ti.ts` is auto-generated** — never edit by hand, always regenerated by `npm run build`.
- **ApexCharts sub-types** (ApexFill, ApexXAxis, etc.) are module-private in v5.6+ — do not import them. Remove return type annotations on functions that return them; TypeScript infers.
- **ESLint**: v8 stack. Do not upgrade to v9 (flat config breaking changes).
- **Commits**: Conventional commits style (`feat:`, `fix:`, `refactor:`, `chore:`). Co-author line: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- **No auto-commit**: Only commit when explicitly asked.
