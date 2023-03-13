import { HassEntity } from "home-assistant-js-websocket";
import {
  ChartCardSeriesConfig,
  EntityCachePoints,
  HistoryPoint,
} from "./types";

export default class GraphEntry {
  private _computedHistory?: EntityCachePoints;

  private _updating = false;

  private _index: number;

  private _config: ChartCardSeriesConfig;

  constructor(index: number, config: ChartCardSeriesConfig) {
    this._index = index;
    this._config = config;
  }

  get history(): EntityCachePoints {
    return this._computedHistory || [];
  }

  get index(): number {
    return this._index;
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

  public _updateData(entity: HassEntity | undefined): boolean {
    if (this._updating || !entity) return false;
    this._updating = true;

    const history: EntityCachePoints = entity.attributes.data;
    if (!history || history.length === 0) {
      this._updating = false;
      this._computedHistory = undefined;
      return false;
    }
    this._computedHistory = history;
    this._updating = false;
    return true;
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
