/**
 * Base Enums
 */

export enum DataType {
  DEFAULT = "default",
  ENERGY = "energy",
  HUMIDITY = "humidity",
  POWER = "power",
  TEMPERATURE = "temperature",
}

export enum DataTypeGroup {
  A = "a",
  B = "b",
}

export enum MinMaxType {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}

export enum Period {
  LAST_HOUR = "-1h",
  LAST_THREE_HOUR = "-3h",
  LAST_SIX_HOUR = "-6h",
  LAST_TWELVE_HOUR = "-12h",
  DAY = "1d",
  TWO_DAY = "2d",
  WEEK = "1w",
  MONTH = "1m",
  // YEAR = "1y",
}

export enum Resolution {
  RAW = "RAW",
  ONE_MINUTE = "PT1M",
  FIVE_MINUTES = "PT5M",
  FIFTEEN_MINUTES = "PT15M",
  THIRTY_MINUTES = "PT30M",
  ONE_HOUR = "PT1H",
  ONE_DAY = "P1D",
}

/**
 * Base Types
 */

export type DataPoint = [number, number | null];

export type ExtremasType = boolean | "min" | "max";

export type LegendFunction = "last" | "sum";

export type MinMaxPoint = {
  min: DataPoint;
  max: DataPoint;
};

export type MinMaxValue = "auto" | number | string | undefined;

/**
 * Card Configs
 */

export interface CardConfigExternal {
  type: "custom:apexcharts-card2";
  entity: string;
  configTemplates?: string[] | string;
  colorList?: string[];
  chartType?: "line" | "scatter";
  header?: CardHeaderExternalConfig;
  now?: CardNowExternalConfig;
  show?: CardShowExternalConfig;
  allSeriesConfig?: AllSeriesConfigExternal;
  allYaxisConfig?: AllYAxisConfigExternal;
  seriesSets: SeriesSetConfigExternal[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
  period?: Period;
  showDateSelector?: boolean;
  autoRefreshTime?: number;
  rememberOptions?: boolean;
}

/**
 * Card Header Configs
 */

export interface CardHeaderExternalConfig {
  appendSeriesSetName?: boolean;
  colorizeStates?: boolean;
  show?: boolean;
  showStates?: boolean;
  title?: string;
}

export interface CardHeaderConfig extends CardHeaderExternalConfig {
  appendSeriesSetName: boolean;
  colorizeStates: boolean;
  show: boolean;
  showStates: boolean;
}

/**
 * Card Now Configs
 */

export interface CardNowExternalConfig {
  color?: string;
  label?: string;
  show?: boolean;
}

export interface CardNowConfig extends CardNowExternalConfig {
  color: string;
  show: boolean;
}

/**
 * Card Show Configs
 */

export interface CardShowExternalConfig {
  lastUpdated?: boolean;
  loading?: boolean;
}

export interface CardShowConfig extends CardShowExternalConfig {
  lastUpdated: boolean;
  loading: boolean;
}

/**
 * Data Types Configs
 */

export interface DataTypeConfig {
  dataType: DataType;
  floatPrecision: number;
  unit?: string;
  unitArray?: string[];
  unitSeparator: string;
  unitStep?: number;
}

/**
 * Series Show Configs
 */

export interface SeriesShowConfigExternal {
  extremas?: ExtremasType;
  inChart?: boolean;
  inHeader?: boolean;
  legendFunction?: LegendFunction;
  legendValue?: boolean;
  nameInHeader?: boolean;
}

export interface SeriesShowConfig extends SeriesShowConfigExternal {
  extremas: ExtremasType;
  inChart: boolean;
  inHeader: boolean;
  legendFunction: LegendFunction;
  legendValue: boolean;
  nameInHeader: boolean;
}

/**
 * Series Configs
 */

export interface AllSeriesConfigExternal {
  clampNegative?: boolean;
  color?: string;
  curve?: "smooth" | "straight" | "stepline";
  dataType?: DataType;
  name?: string;
  opacity?: number;
  show?: SeriesShowConfigExternal;
  strokeWidth?: number;
  type?: "line" | "column" | "area";
  yAxisId?: string;
}

export interface SeriesConfigExternal extends AllSeriesConfigExternal {
  measurement: string;
  device: string;
  channel?: string;
}

export interface SeriesConfig extends SeriesConfigExternal {
  clampNegative: boolean;
  dataType: DataType;
  index: number;
  show: SeriesShowConfig;
  yAxisId: string;
  yAxisIndex: number;
}

/**
 * Y-Axis Configs
 */

export interface AllYAxisConfigExternal {
  alignTo?: number;
  dataType?: DataType;
  floatPrecision?: number;
  maxValue: MinMaxValue;
  minValue: MinMaxValue;
  opposite?: boolean;
  show?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
}

export interface YAxisConfigExternal extends AllYAxisConfigExternal {
  id?: string;
}

export interface YAxisConfig extends YAxisConfigExternal {
  id: string;
  dataType: DataType;
  floatPrecision: number;
  index: number;
  maxType: MinMaxType;
  minType: MinMaxType;
  multiYAxis: boolean;
  opposite: boolean;
  show: boolean;
}

/**
 * SeriesSet Configs
 */

export interface SeriesSetConfigExternal {
  name: string;
  allSeriesConfig?: AllSeriesConfigExternal;
  allYaxisConfig?: AllYAxisConfigExternal;
  series: SeriesConfigExternal[];
  yAxes?: YAxisConfigExternal[];
}

export interface SeriesSetConfig {
  dataTypeGroup: DataTypeGroup;
  name: string;
  series: SeriesConfig[];
  yAxes: YAxisConfig[];
}
