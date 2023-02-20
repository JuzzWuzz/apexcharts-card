import { HomeAssistant } from 'custom-card-helpers';
import { ChartCardSeriesConfig, EntityCachePoints, EntityEntryCache, HistoryPoint } from './types';
import { HassEntity } from 'home-assistant-js-websocket';
import { moment } from './const';
import SparkMD5 from 'spark-md5';
import { ChartCardSpanExtConfig } from './types-config';
import * as pjson from '../package.json';

export default class GraphEntry {
  private _computedHistory?: EntityCachePoints;

  private _hass?: HomeAssistant;

  private _entityID: string;

  private _entityState?: HassEntity;

  private _updating = false;

  // private _hoursToShow: number;

  private _graphSpan: number;

  private _index: number;

  private _config: ChartCardSeriesConfig;

  private _realStart: Date;

  private _realEnd: Date;

  private _md5Config: string;

  constructor(
    index: number,
    graphSpan: number,
    config: ChartCardSeriesConfig,
    span: ChartCardSpanExtConfig | undefined,
  ) {
    this._index = index;
    this._entityID = config.entity;
    this._graphSpan = graphSpan;
    this._config = config;
    this._realEnd = new Date();
    this._realStart = new Date();
    this._md5Config = SparkMD5.hash(`${this._graphSpan}${JSON.stringify(this._config)}${JSON.stringify(span)}`);
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._entityState = this._hass.states[this._entityID];
  }

  get history(): EntityCachePoints {
    return this._computedHistory || [];
  }

  get index(): number {
    return this._index;
  }

  get start(): Date {
    return this._realStart;
  }

  get end(): Date {
    return this._realEnd;
  }

  get lastState(): number | null {
    return this.history.length > 0 ? this.history[this.history.length - 1][1] : null;
  }

  get sumStates(): number | null {
    return this.history.length > 0 ? this._sum(this.history) : null;
  }

  public nowValue(now: number, before: boolean): number | null {
    if (this.history.length === 0) return null;
    const index = this.history.findIndex((point, index, arr) => {
      if (!before && point[0] > now) return true;
      if (before && point[0] < now && arr[index + 1] && arr[index + 1][0] > now) return true;
      return false;
    });
    if (index === -1) return null;
    return this.history[index][1];
  }

  get min(): number | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0) return undefined;
    return Math.min(...this._computedHistory.flatMap((item) => (item[1] === null ? [] : [item[1]])));
  }

  get max(): number | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0) return undefined;
    return Math.max(...this._computedHistory.flatMap((item) => (item[1] === null ? [] : [item[1]])));
  }

  public minMaxWithTimestamp(start: number, end: number): { min: HistoryPoint; max: HistoryPoint } | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0) return undefined;
    if (this._computedHistory.length === 1)
      return { min: [start, this._computedHistory[0][1]], max: [end, this._computedHistory[0][1]] };
    return this._computedHistory.reduce(
      (acc: { min: HistoryPoint; max: HistoryPoint }, point) => {
        if (point[1] === null) return acc;
        if (point[0] > end || point[0] < start) return acc;
        if (acc.max[1] === null || acc.max[1] < point[1]) acc.max = [...point];
        if (acc.min[1] === null || (point[1] !== null && acc.min[1] > point[1])) acc.min = [...point];
        return acc;
      },
      { min: [0, null], max: [0, null] },
    );
  }

  public minMaxWithTimestampForYAxis(start: number, end: number): { min: HistoryPoint; max: HistoryPoint } | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0) return undefined;
    let lastTimestampBeforeStart = start;
    const lastHistoryIndexBeforeStart =
      this._computedHistory.findIndex((hist) => {
        return hist[0] >= start;
      }) - 1;
    if (lastHistoryIndexBeforeStart >= 0)
      lastTimestampBeforeStart = this._computedHistory[lastHistoryIndexBeforeStart][0];
    return this.minMaxWithTimestamp(lastTimestampBeforeStart, end);
  }

  public async _updateHistory(start: Date, end: Date): Promise<boolean> {
    if (!this._entityState || this._updating) return false;
    this._updating = true;

    if (this._config.ignore_history) {
      let currentState: null | number | string = null;
      if (this._config.attribute) {
        currentState = this._entityState.attributes?.[this._config.attribute];
      } else {
        currentState = this._entityState.state;
      }
      let stateParsed: number | null = parseFloat(currentState as string);
      stateParsed = !Number.isNaN(stateParsed) ? stateParsed : null;
      this._computedHistory = [[new Date(this._entityState.last_updated).getTime(), stateParsed]];
      this._updating = false;
      return true;
    }

    let history: EntityEntryCache | undefined = undefined;

    history = await this._generateData(start, end);

    if (!history || history.data.length === 0) {
      this._updating = false;
      this._computedHistory = undefined;
      return false;
    }
    this._computedHistory = history.data;
    this._updating = false;
    return true;
  }

  private async _generateData(start: Date, end: Date): Promise<EntityEntryCache> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    let data;
    try {
      const datafn = new AsyncFunction(
        'entity',
        'start',
        'end',
        'hass',
        'moment',
        `'use strict'; ${this._config.data_generator}`,
      );
      data = await datafn(this._entityState, start, end, this._hass, moment);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const funcTrimmed =
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._config.data_generator!.length <= 100
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._config.data_generator!.trim()
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            `${this._config.data_generator!.trim().substring(0, 98)}...`;
      e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
      e.name = 'Error';
      throw e;
    }
    return {
      span: 0,
      card_version: pjson.version,
      last_fetched: new Date(),
      data,
    };
  }

  private _sum(items: EntityCachePoints): number {
    if (items.length === 0) return 0;
    let lastIndex = 0;
    return items.reduce((sum, entry, index) => {
      let val = 0;
      if (entry && entry[1] === null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        val = items[lastIndex][1]!;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        val = entry[1]!;
        lastIndex = index;
      }
      return sum + val;
    }, 0);
  }

  private _average(items: EntityCachePoints): number | null {
    const nonNull = this._filterNulls(items);
    if (nonNull.length === 0) return null;
    return this._sum(nonNull) / nonNull.length;
  }

  private _minimum(items: EntityCachePoints): number | null {
    let min: number | null = null;
    items.forEach((item) => {
      if (item[1] !== null)
        if (min === null) min = item[1];
        else min = Math.min(item[1], min);
    });
    return min;
  }

  private _maximum(items: EntityCachePoints): number | null {
    let max: number | null = null;
    items.forEach((item) => {
      if (item[1] !== null)
        if (max === null) max = item[1];
        else max = Math.max(item[1], max);
    });
    return max;
  }

  private _last(items: EntityCachePoints): number | null {
    if (items.length === 0) return null;
    return items.slice(-1)[0][1];
  }

  private _first(items: EntityCachePoints): number | null {
    if (items.length === 0) return null;
    return items[0][1];
  }

  private _median(items: EntityCachePoints) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const itemsDup = this._filterNulls([...items]).sort((a, b) => a[1]! - b[1]!);
    if (itemsDup.length === 0) return null;
    if (itemsDup.length === 1) return itemsDup[0][1];
    const mid = Math.floor((itemsDup.length - 1) / 2);
    if (itemsDup.length % 2 === 1) return itemsDup[mid][1];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (itemsDup[mid][1]! + itemsDup[mid + 1][1]!) / 2;
  }

  private _delta(items: EntityCachePoints): number | null {
    const max = this._maximum(items);
    const min = this._minimum(items);
    return max === null || min === null ? null : max - min;
  }

  private _diff(items: EntityCachePoints): number | null {
    const noNulls = this._filterNulls(items);
    const first = this._first(noNulls);
    const last = this._last(noNulls);
    if (first === null || last === null) {
      return null;
    }
    return last - first;
  }

  private _filterNulls(items: EntityCachePoints): EntityCachePoints {
    return items.filter((item) => item[1] !== null);
  }
}
