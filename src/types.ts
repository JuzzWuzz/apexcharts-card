import { ApexOptions } from "apexcharts";
import {
  CardConfigExternal,
  CardHeaderConfig,
  CardNowConfig,
  CardShowConfig,
  DataPoint,
  DataType,
  DataTypeConfig,
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

export interface FormattedValue {
  value: string;
  unitSeparator: string;
  unitOfMeasurement: string;
  formatted(): string;
}

export type DataTypeMap = Map<DataType, DataTypeConfig>;
