# Performance Improvements

Identified optimisations for `apexcharts-card`. Items are grouped by priority and effort.

> **Note on `console.log`:** All `console.log` calls are stripped from production builds by Terser
> (`pure_funcs: ["console.log"]` in `rollup.config.js`). They are intentionally present for
> debugging under `npm start` (watch mode) and do not need to be removed.

---

## Phase 1 — Easy Wins (no architectural change)

### 1. Set-based deduplication in `generateSeriesSets()` — `src/utils.ts`

**Problem:** Uses `.filter((v, i, arr) => arr.indexOf(v) === i)` to deduplicate `dataTypes` and
`dataTypeGroups`. `indexOf` inside `filter` is O(n²).

**Fix:** Replace with `[...new Set(array)]`.

```typescript
// Before
const dataTypes = series
  .map((s) => s.dataType)
  .filter((value, index, array) => array.indexOf(value) === index);

// After
const dataTypes = [...new Set(series.map((s) => s.dataType))];
```

**Impact:** O(n²) → O(n). Low absolute cost today, but correct pattern.

---

### 2. Map-based series lookup in `generateSeries()` — `src/utils.ts`

**Problem:** For each series config, `.find()` linearly scans the entity series array.
With m configs × n entity series = O(m × n).

**Fix:** Build a `Map<index, EntitySeries>` from `entitySeriesArr` once before the `.map()`.

```typescript
// Before
const entitySeries = entitySeriesArr.find(
  (es) => isRequestedSeries && es.index === seriesConfig.index,
);

// After
const entitySeriesByIndex = new Map(entitySeriesArr.map((es) => [es.index, es]));
// ... inside .map():
const entitySeries = isRequestedSeries
  ? entitySeriesByIndex.get(seriesConfig.index)
  : undefined;
```

**Impact:** O(m × n) → O(n + m). Most noticeable with many series indices.

---

### 3. Pre-compute millis outside calendar day loop — `src/apexcharts-card.ts`

**Problem:** `_renderCalendarDays()` calls `day.startOf("day").toMillis()` twice per iteration
(once vs `selected`, once vs `today`) for 42 iterations = 84 redundant DateTime sub-operations.
`selected.toMillis()` and `today.toMillis()` are also both constant for the entire loop.

**Fix:** Pre-compute `selectedMs` and `todayMs` before the loop; inside the loop compute
`day.startOf("day").toMillis()` once per iteration.

```typescript
const todayMs = DateTime.now().startOf("day").toMillis();
const selectedMs = this._calendarSelectedDate.startOf("day").toMillis();

for (let i = 0; i < 42; i++) {
  const dayMs = startOfGrid.plus({ days: i }).startOf("day").toMillis();
  const isSelected = dayMs === selectedMs;
  const isToday = dayMs === todayMs;
  // ...
}
```

**Impact:** 84 operations → 42 + 2 constant setup. Minor, but simple.

---

### 4. Single-pass bar categories accumulation — `src/apex-layouts.ts`

**Problem:** Building `barCategories` creates three intermediate arrays:
`flatMap()` → `new Set(...)` → `[...spread]` → `.sort()`.

```typescript
// Current
const barCategories = [...new Set(series.flatMap((s) => s.data.map((d) => d[0])))].sort((a, b) => a - b);
```

**Fix:** Use a `Set` accumulator directly.

```typescript
const categorySet = new Set<number>();
for (const s of series) {
  for (const d of s.data) categorySet.add(d[0]);
}
const barCategories = Array.from(categorySet).sort((a, b) => a - b);
```

**Impact:** Two fewer intermediate array allocations. Noticeable on large datasets (yearly energy data with 365 points × multiple series).

---

## Phase 2 — Moderate Effort, Meaningful Gains

### 5. Pre-compute `dataTypeConfig` per series in tooltip formatter — `src/apex-layouts.ts`

**Problem:** `getYTooltipFormatter()` calls `getDataTypeConfig(seriesConfig.dataType)` inside the
returned closure. This function is called by ApexCharts on every tooltip render (every hover).

```typescript
// Current — called on every hover
return function (value, opts) {
  const seriesConfig = series[opts.seriesIndex].config;
  const formattedValue = formatValueAndUom(
    value,
    getDataTypeConfig(seriesConfig.dataType),  // re-evaluated each time
    seriesConfig.clampNegative,
  ).formatted();
};
```

**Fix:** Pre-compute a lookup array at closure creation time.

```typescript
function getYTooltipFormatter(series: CardSeries[]) {
  const dataTypeConfigs = series.map((s) => getDataTypeConfig(s.config.dataType));

  return function (value, opts) {
    const s = series[opts.seriesIndex];
    const formattedValue = formatValueAndUom(
      value,
      dataTypeConfigs[opts.seriesIndex],
      s.config.clampNegative,
    ).formatted();
    return [`<strong>${formattedValue}</strong>`];
  };
}
```

**Impact:** Eliminates repeated `getDataTypeConfig()` calls during all tooltip interactions.

---

### 6. Move `evalApexConfig` from `getLayoutConfig()` to `generateBaseConfig()` — `src/utils.ts` + `src/apex-layouts.ts`

**Problem:** `evalApexConfig()` recursively walks the entire `apexConfig` object tree (evaluating
`EVAL:` prefixed strings) every time `getLayoutConfig()` is called. `getLayoutConfig` is called
on every entity state change via `_updateData()`. The `apexConfig` comes from the card config,
which is static after `setConfig()`.

**Fix:** Apply `evalApexConfig()` once inside `generateBaseConfig()` (which runs only at
`setConfig()` time), storing the already-evaluated result in `CardConfig`. Remove the
`evalApexConfig` call from `getLayoutConfig()`.

**Consideration:** Any per-Y-axis `apexConfig` blocks would also need the same treatment
(evaluated once in `generateSeriesSets()`).

**Impact:** Eliminates O(depth × keys) recursive walk on every data update.

---

### 7. Debounce `callService()` in `_refresh()` — `src/apexcharts-card.ts`

**Problem:** The refresh button calls `_refresh()` → `callService()` directly with no guard.
Rapid clicks send multiple MQTT publishes before any response arrives.

**Fix:** Add debounce/throttle for the **manual refresh path only** (or dedupe identical in-flight
payloads), rather than a global cooldown in `callService()`.

`callService()` is also used by `_updateDate()` and series-set/date navigation flows; a global
leading-edge cooldown can suppress legitimate state-changing requests and leave stale/empty data.

```typescript
private _lastManualRefreshMs = 0;

private _refresh(): void {
  // ... keep existing live/historical branching logic
  const now = Date.now();
  if (now - this._lastManualRefreshMs < 500) return;
  this._lastManualRefreshMs = now;
  this.callService();
}
```

**Impact:** Prevents duplicate manual refresh publishes without blocking valid navigation/update requests.

---

## Phase 3 — Consider Carefully (requires testing)

### 8. Debounce `_updateData()` from `set hass()` — `src/apexcharts-card.ts`

**Problem:** `set hass()` fires on every HA state change. During startup or reconnect, HA can
fire multiple updates in quick succession. Each one triggers `generateSeries()` + `updateOptions()`
on the ApexCharts instance.

The existing `_updating` guard prevents concurrent runs, but fast sequential updates (where each
completes before the next arrives) still each cause a full chart update.

**Approach:** Debounce/coalesce updates triggered by `set hass()` only (e.g. 50–100ms), keeping
the latest pending `newEntityState=true` signal and invoking `_updateData(true)` once per burst.
Do not debounce direct/internal callers that intentionally force immediate updates.

**Consideration:** Must be careful not to interfere with the `_updating` flag or the
`newEntityState` path that triggers `initGraph()` on axis type changes. Test against both cold
start and live-data refresh scenarios.

If updates arrive while `_updating` is true, queue one follow-up run (last-wins) so the final HA
state is not dropped.

---

## Not Worth Changing

| Item | Reason |
|---|---|
| `mergeDeep` recursive overhead | Only called during config build (`setConfig`), not a runtime concern |
| `DateTime` creation in X-axis label formatter | Returns early for unlabeled timestamps; cost per call is negligible |
| `ResizeObserver` creation in `initGraph()` | Correct pattern (disconnect → recreate); infrequent |
| `requestAnimationFrame` in `connectedCallback` | Intentional — defers chart access until DOM is ready |
| `getLovelace()` shadow DOM traversal | Only called during `setConfig()` — once per card load |
| Y-axis deduplication logic in `getYAxis()` | Correct multi-Y-axis support; not a hot path |
| Calendar preset array recreation | Created once per calendar render; 5 items, negligible |
