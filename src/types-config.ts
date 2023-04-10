export interface ChartCardConfigExternal {
  type: "custom:apexcharts-card";
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
  yAxes?: ChartCardYAxisConfigExternal[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
  period?: Periods;
  showDateSelector?: boolean;
  autoRefreshTime?: number;
}

export interface ChartCardDataTypeConfigExternal {
  id: string;
  clampNegative?: boolean;
  floatPrecision?: number;
  unit?: string;
  unitStep?: number;
  unitArray?: string[];
  unitSeparator?: string;
}

export interface ChartCardHeaderExternalConfig {
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
  yAxisIndex?: number;
}

export interface ChartCardSeriesShowConfigExternal {
  inChart?: boolean;
  inHeader?: boolean;
  legendFunction?: "last" | "sum";
  legendValue?: boolean;
  nameInHeader?: boolean;
  extremas?: boolean | "min" | "max";
}

export interface ChartCardAllYAxisConfigExternal {
  alignTo?: number;
  floatPrecision?: number;
  opposite?: boolean;
  maxValue?: "auto" | number | string;
  minValue?: "auto" | number | string;
  show?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apexConfig?: any;
}

export interface ChartCardYAxisConfigExternal
  extends ChartCardAllYAxisConfigExternal {
  dataTypeId?: string;
  id?: string;
}

export enum Periods {
  LAST_HOUR = "-1h",
  LAST_THREE_HOUR = "-3h",
  LAST_SIX_HOUR = "-6h",
  LAST_TWELVE_HOUR = "-12h",
  DAY = "1d",
  TWO_DAY = "2d",
  WEEK = "1w",
  MONTH = "1m",
  YEAR = "1y",
}
