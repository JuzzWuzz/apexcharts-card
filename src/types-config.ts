export interface ChartCardConfigExternal {
  type: "custom:apexcharts-card2";
  entity: string;
  configTemplates?: string[] | string;
  colorList?: string[];
  chartType?: "line" | "scatter";
  header?: ChartCardHeaderExternalConfig;
  now?: ChartCardNowExternalConfig;
  show?: ChartCardShowExternalConfig;
  dataTypes?: ChartCardDataTypeConfigExternal[];
  allSeriesConfig?: ChartCardAllSeriesConfigExternal;
  allYaxisConfig?: ChartCardAllYAxisConfigExternal;
  seriesSets: ChartCardSeriesSetConfigExternal[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
  period?: Period;
  showDateSelector?: boolean;
  autoRefreshTime?: number;
  rememberOptions?: boolean;
}

export interface ChartCardDataTypeConfigExternal {
  id: string;
  clampNegative?: boolean;
  floatPrecision?: number;
  unit?: string;
  unitArray?: string[];
  unitSeparator?: string;
  unitStep?: number;
}

export interface ChartCardHeaderExternalConfig {
  appendSeriesSetName?: boolean;
  colorizeStates?: boolean;
  show?: boolean;
  showStates?: boolean;
  title?: string;
}

export interface ChartCardNowExternalConfig {
  color?: string;
  label?: string;
  show?: boolean;
}

export interface ChartCardShowExternalConfig {
  lastUpdated?: boolean;
  loading?: boolean;
}

export interface ChartCardAllSeriesConfigExternal {
  color?: string;
  curve?: "smooth" | "straight" | "stepline";
  name?: string;
  opacity?: number;
  show?: ChartCardSeriesShowConfigExternal;
  strokeWidth?: number;
  type?: "line" | "column" | "area";
}

export interface ChartCardSeriesConfigExternal
  extends ChartCardAllSeriesConfigExternal {
  dataTypeId?: string;
  yAxisId?: string;
  measurement: string;
  device: string;
  channel?: string;
}

export interface ChartCardSeriesShowConfigExternal {
  extremas?: boolean | "min" | "max";
  inChart?: boolean;
  inHeader?: boolean;
  legendFunction?: LegendFunction;
  legendValue?: boolean;
  nameInHeader?: boolean;
}

export interface ChartCardSeriesSetConfigExternal {
  name: string;
  allSeriesConfig?: ChartCardAllSeriesConfigExternal;
  allYaxisConfig?: ChartCardAllYAxisConfigExternal;
  series: ChartCardSeriesConfigExternal[];
  yAxes?: ChartCardYAxisConfigExternal[];
}

export interface ChartCardAllYAxisConfigExternal {
  alignTo?: number;
  floatPrecision?: number;
  maxValue?: "auto" | number | string;
  minValue?: "auto" | number | string;
  opposite?: boolean;
  show?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
}

export interface ChartCardYAxisConfigExternal
  extends ChartCardAllYAxisConfigExternal {
  id?: string;
  dataTypeId?: string;
}

export type LegendFunction = "last" | "sum";

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
  ONE_DAY = "P1D",
}
