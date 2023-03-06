import { HomeAssistant } from "custom-card-helpers";
import {
  ChartCardSeriesConfig,
  EntityCachePoints,
  EntityEntryCache,
  HistoryPoint,
} from "./types";
import { HassEntity } from "home-assistant-js-websocket";
import { moment } from "./const";
import * as pjson from "../package.json";

export default class GraphEntry {
  private _computedHistory?: EntityCachePoints;

  private _hass?: HomeAssistant;

  private _entityID: string;

  private _entityState?: HassEntity;

  private _updating = false;

  private _graphSpan: number;

  private _index: number;

  private _config: ChartCardSeriesConfig;

  private _realStart: Date;

  private _realEnd: Date;

  constructor(index: number, graphSpan: number, config: ChartCardSeriesConfig) {
    this._index = index;
    this._entityID = config.entity;
    this._graphSpan = graphSpan;
    this._config = config;
    this._realEnd = new Date();
    this._realStart = new Date();
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
    return this.history.length > 0
      ? this.history[this.history.length - 1][1]
      : null;
  }

  get sumStates(): number | null {
    return this.history.length > 0 ? this._sum(this.history) : null;
  }

  public nowValue(now: number, before: boolean): number | null {
    if (this.history.length === 0) return null;
    const index = this.history.findIndex((point, index, arr) => {
      if (!before && point[0] > now) return true;
      if (before && point[0] < now && arr[index + 1] && arr[index + 1][0] > now)
        return true;
      return false;
    });
    if (index === -1) return null;
    return this.history[index][1];
  }

  get min(): number | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0)
      return undefined;
    return Math.min(
      ...this._computedHistory.flatMap((item) =>
        item[1] === null ? [] : [item[1]],
      ),
    );
  }

  get max(): number | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0)
      return undefined;
    return Math.max(
      ...this._computedHistory.flatMap((item) =>
        item[1] === null ? [] : [item[1]],
      ),
    );
  }

  public minMaxWithTimestamp(
    start: number,
    end: number,
  ): { min: HistoryPoint; max: HistoryPoint } | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0)
      return undefined;
    if (this._computedHistory.length === 1)
      return {
        min: [
          start,
          this._computedHistory[0][1],
        ],
        max: [
          end,
          this._computedHistory[0][1],
        ],
      };
    return this._computedHistory.reduce(
      (acc: { min: HistoryPoint; max: HistoryPoint }, point) => {
        if (point[1] === null) return acc;
        if (point[0] > end || point[0] < start) return acc;
        if (acc.max[1] === null || acc.max[1] < point[1]) acc.max = [...point];
        if (acc.min[1] === null || (point[1] !== null && acc.min[1] > point[1]))
          acc.min = [...point];
        return acc;
      },
      {
        min: [
          0,
          null,
        ],
        max: [
          0,
          null,
        ],
      },
    );
  }

  public minMaxWithTimestampForYAxis(
    start: number,
    end: number,
  ): { min: HistoryPoint; max: HistoryPoint } | undefined {
    if (!this._computedHistory || this._computedHistory.length === 0)
      return undefined;
    let lastTimestampBeforeStart = start;
    const lastHistoryIndexBeforeStart =
      this._computedHistory.findIndex((hist) => {
        return hist[0] >= start;
      }) - 1;
    if (lastHistoryIndexBeforeStart >= 0)
      lastTimestampBeforeStart =
        this._computedHistory[lastHistoryIndexBeforeStart][0];
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
      this._computedHistory = [
        [
          new Date(this._entityState.last_updated).getTime(),
          stateParsed,
        ],
      ];
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

  private async _generateData(
    start: Date,
    end: Date,
  ): Promise<EntityEntryCache> {
    const AsyncFunction = Object.getPrototypeOf(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async function () {},
    ).constructor;
    let data, data2;
    try {
      const datafn = new AsyncFunction(
        "entity",
        "start",
        "end",
        "hass",
        "moment",
        `'use strict'; ${this._config.data_generator}`,
      );
      data2 = await datafn(this._entityState, start, end, this._hass, moment);
      console.log(data2);
      data = data2.data;
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
      e.name = "Error";
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
}
