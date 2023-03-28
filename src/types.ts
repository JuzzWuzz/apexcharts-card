import { ApexOptions } from "apexcharts";
import {
  ChartCardConfigExternal,
  ChartCardSeriesConfigExternal,
  ChartCardSeriesShowConfigExternal,
  ChartCardSeriesYAxisConfigExternal,
} from "./types-config";

export interface ChartCardConfig extends ChartCardConfigExternal {
  apex_config?: ApexOptions;
}

export interface ChartCardSeriesConfig extends ChartCardSeriesConfigExternal {
  index: number;
  show: ChartCardSeriesShowConfig;
  yaxis?: ChartCardSeriesYAxisConfig;
}

export interface ChartCardSeriesShowConfig
  extends ChartCardSeriesShowConfigExternal {
  in_chart: boolean;
  in_header: boolean;
  legend_function: "last" | "sum";
  legend_value: boolean;
  name_in_header: boolean;
}

export interface ChartCardSeriesYAxisConfig
  extends ChartCardSeriesYAxisConfigExternal {
  min?: number;
  max?: number;
  min_type: MinMaxType;
  max_type: MinMaxType;
}

export type DataPoint = [number, number | null];

export enum MinMaxType {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}

export interface ChartCardSeries {
  config: ChartCardSeriesConfig;
  data: Array<DataPoint>;
  minPoint: DataPoint;
  maxPoint: DataPoint;
  headerValue: number | null;
  color: string;
  yAxis: ChartCardSeriesYAxisConfig;
}

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}
