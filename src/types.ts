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
  Periods,
} from "./types-config";

export interface ChartCardConfig extends ChartCardConfigExternal {
  colorList: string[];
  header: ChartCardHeaderConfig;
  now: ChartCardNowConfig;
  show: ChartCardShowConfig;
  apexConfig?: ApexOptions;
  period: Periods;
  showDateSelector: boolean;
  autoRefreshTime: number;
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
  show: boolean;
  color: string;
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
  legendFunction: "last" | "sum";
  legendValue: boolean;
  nameInHeader: boolean;
}

export interface ChartCardYAxisConfig extends ChartCardYAxisConfigExternal {
  floatPrecision: number;
  id: string;
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

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}

export const periodIds = [
  "LAST_ONE_HOUR",
  "LAST_THREE_HOUR",
  "LAST_SIX_HOUR",
  "LAST_TWELVE_HOUR",
  "DAY",
  "TWO_DAY",
  "WEEK",
  "MONTH",
  "YEAR",
] as const;

type PeriodId = (typeof periodIds)[number];

export const PeriodLabels: Record<PeriodId, string> = {
  LAST_ONE_HOUR: "Last 1h",
  LAST_THREE_HOUR: "Last 3h",
  LAST_SIX_HOUR: "Last 6h",
  LAST_TWELVE_HOUR: "Last 12h",
  DAY: "Day",
  TWO_DAY: "2 Day",
  WEEK: "Week",
  MONTH: "Month",
  YEAR: "Year",
} as const;

export const PeriodValues: Record<PeriodId, string> = {
  LAST_ONE_HOUR: "-1h",
  LAST_THREE_HOUR: "-3h",
  LAST_SIX_HOUR: "-6h",
  LAST_TWELVE_HOUR: "Last 12h",
  DAY: "Day",
  TWO_DAY: "2 Day",
  WEEK: "Week",
  MONTH: "Month",
  YEAR: "Year",
} as const;
