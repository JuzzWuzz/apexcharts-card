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
}

export interface ChartCardSeriesConfig
  extends ChartCardAllSeriesExternalConfig {
  index: number;
  show: ChartCardSeriesShowConfig;
  yaxis?: ChartCardYAxis;
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
  min_type: minmax_type;
  max_type: minmax_type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label_formatter?(val: number, opts?: any): string | string[];
}

export enum minmax_type {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}
