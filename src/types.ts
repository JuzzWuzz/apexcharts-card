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
  in_header: boolean;
  legend_function: "last" | "sum";
  legend_value: boolean;
  name_in_header: boolean;
}

export type HistoryPoint = [number, number | null];

export interface ChartCardYAxis extends ChartCardYAxisExternal {
  min?: number;
  max?: number;
  min_type: minmax_type;
  max_type: minmax_type;
}

export interface ChartCardSeries {
  config: ChartCardSeriesConfig;
  data: Array<HistoryPoint>;
  minPoint: HistoryPoint;
  maxPoint: HistoryPoint;
  headerValue: number | null;
  color: string;
  yAxis: ChartCardYAxis;
}

export enum minmax_type {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}
