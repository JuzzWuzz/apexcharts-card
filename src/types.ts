import { ApexOptions } from "apexcharts";
import {
  ChartCardExternalConfig,
  ChartCardAllSeriesExternalConfig,
  ChartCardSeriesShowConfigExt,
  ChartCardYAxisExternal,
} from "./types-config";

export interface ChartCardConfig extends ChartCardExternalConfig {
  useCompress: boolean;
  apex_config?: ApexOptions;
  yaxis?: ChartCardYAxis[];
}

export interface ChartCardSeriesConfig
  extends ChartCardAllSeriesExternalConfig {
  index: number;
  show: ChartCardSeriesShowConfig;
}

export interface ChartCardSeriesShowConfig
  extends ChartCardSeriesShowConfigExt {
  in_chart: boolean;
  in_header: boolean | "before_now" | "after_now";
  legend_function: "last" | "sum";
  legend_value: boolean;
  name_in_header: boolean;
}

export type EntityCachePoints = Array<HistoryPoint>;

export type HistoryPoint = [number, number | null];

export interface ChartCardYAxis extends ChartCardYAxisExternal {
  series_id?: number[];
  min_type?: minmax_type;
  max_type?: minmax_type;
}

export enum minmax_type {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}
