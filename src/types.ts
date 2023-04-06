import { ApexOptions } from "apexcharts";
import {
  ChartCardConfigExternal,
  ChartCardDataTypeConfigExternal,
  ChartCardSeriesConfigExternal,
  ChartCardSeriesShowConfigExternal,
  ChartCardYAxisConfigExternal,
} from "./types-config";

export interface ChartCardConfig extends ChartCardConfigExternal {
  apex_config?: ApexOptions;
}

export interface ChartCardDataTypeConfig
  extends ChartCardDataTypeConfigExternal {
  clamp_negative: boolean;
  float_precision: number;
  unit_separator: string;
}

export interface ChartCardSeriesConfig extends ChartCardSeriesConfigExternal {
  show: ChartCardSeriesShowConfig;
  yAxisIndex: number;
  index: number;
}

export interface ChartCardSeriesShowConfig
  extends ChartCardSeriesShowConfigExternal {
  in_chart: boolean;
  in_header: boolean;
  legend_function: "last" | "sum";
  legend_value: boolean;
  name_in_header: boolean;
}

export interface ChartCardYAxisConfig extends ChartCardYAxisConfigExternal {
  multiYAxis: boolean;
  index: number;
  min_type: MinMaxType;
  max_type: MinMaxType;
  float_precision: number;
}

export type DataTypeMap = Map<string, ChartCardDataTypeConfig>;
export type DataPoint = [number, number | null];

export enum MinMaxType {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}

export type MinMaxPoint = {
  min: DataPoint;
  max: DataPoint;
};

export interface ChartCardSeries {
  config: ChartCardSeriesConfig;
  data: Array<DataPoint>;
  minMaxPoint: MinMaxPoint;
  headerValue: number | null;
  color: string;
}

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}
