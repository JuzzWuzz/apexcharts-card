import { ApexOptions } from "apexcharts";
import {
  ChartCardConfigExternal,
  ChartCardDataTypeConfigExternal,
  ChartCardHeaderExternalConfig,
  ChartCardNowExternalConfig,
  ChartCardSeriesConfigExternal,
  ChartCardSeriesShowConfigExternal,
  ChartCardShowExternalConfig,
  ChartCardYAxisConfigExternal,
  LegendFunction,
  Period,
} from "./types-config";
import { HassEntity } from "home-assistant-js-websocket";

export interface ChartCardConfig extends ChartCardConfigExternal {
  colorList: string[];
  header: ChartCardHeaderConfig;
  now: ChartCardNowConfig;
  show: ChartCardShowConfig;
  apexConfig?: ApexOptions;
  period: Period;
  showDateSelector: boolean;
  autoRefreshTime: number;
  rememberOptions: boolean;
}

export interface ChartCardDataTypeConfig
  extends ChartCardDataTypeConfigExternal {
  clampNegative: boolean;
  floatPrecision: number;
  unitSeparator: string;
}

export interface ChartCardHeaderConfig extends ChartCardHeaderExternalConfig {
  colorizeStates: boolean;
  show: boolean;
  showStates: boolean;
}

export interface ChartCardNowConfig extends ChartCardNowExternalConfig {
  color: string;
  show: boolean;
}

export interface ChartCardShowConfig extends ChartCardShowExternalConfig {
  lastUpdated: boolean;
  loading: boolean;
}

export interface ChartCardSeriesConfig extends ChartCardSeriesConfigExternal {
  index: number;
  show: ChartCardSeriesShowConfig;
  yAxisId: string;
  yAxisIndex: number;
}

export interface ChartCardSeriesShowConfig
  extends ChartCardSeriesShowConfigExternal {
  inChart: boolean;
  inHeader: boolean;
  legendFunction: LegendFunction;
  legendValue: boolean;
  nameInHeader: boolean;
}

export interface ChartCardYAxisConfig extends ChartCardYAxisConfigExternal {
  id: string;
  floatPrecision: number;
  index: number;
  max_type: MinMaxType;
  min_type: MinMaxType;
  multiYAxis: boolean;
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

export interface EntitySeries {
  data: Array<DataPoint>;
  index: number;
  minMax: MinMaxPoint;
}

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}
