import { ApexOptions } from "apexcharts";
import {
  CardConfigExternal,
  CardHeaderConfig,
  CardNowConfig,
  CardShowConfig,
  DataPoint,
  MinMaxPoint,
  Period,
  SeriesConfig,
} from "./types-config";

export interface CardConfig extends CardConfigExternal {
  colorList: string[];
  header: CardHeaderConfig;
  now: CardNowConfig;
  show: CardShowConfig;
  apexConfig?: ApexOptions;
  period: Period;
  showDateSelector: boolean;
  autoRefreshTime: number;
  rememberOptions: boolean;
}

export interface CardSeries {
  config: SeriesConfig;
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

export type DataIntervalUnit =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

export interface DataInterval {
  amount: number;
  unit: DataIntervalUnit;
  unitPlural: string;
}

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}
