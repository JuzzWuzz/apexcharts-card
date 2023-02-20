import { ApexOptions } from 'apexcharts';
import {
  ChartCardExternalConfig,
  ChartCardSeriesExternalConfig,
  ChartCardSeriesShowConfigExt,
  ChartCardYAxisExternal,
} from './types-config';

export interface ChartCardConfig extends ChartCardExternalConfig {
  series: ChartCardSeriesConfig[];
  series_in_graph: ChartCardSeriesConfig[];
  graph_span: string;
  useCompress: boolean;
  apex_config?: ApexOptions;
  yaxis?: ChartCardYAxis[];
}

export interface ChartCardSeriesConfig extends ChartCardSeriesExternalConfig {
  index: number;
  show: ChartCardSeriesShowConfig;
  ignore_history: boolean;
}

export interface ChartCardSeriesShowConfig extends ChartCardSeriesShowConfigExt {
  legend_value: boolean;
  legend_function: 'last' | 'sum';
  in_header: boolean | 'raw' | 'before_now' | 'after_now';
  name_in_header: boolean;
  in_chart: boolean;
  offset_in_name: boolean;
}

export interface EntityEntryCache {
  span: number;
  card_version: string;
  last_fetched: Date;
  data: EntityCachePoints;
}

export type EntityCachePoints = Array<HistoryPoint>;

export type HistoryPoint = [number, number | null];

export interface HistoryBucket {
  timestamp: number;
  data: EntityCachePoints;
}

export interface ChartCardYAxis extends ChartCardYAxisExternal {
  series_id?: number[];
  min_type?: minmax_type;
  max_type?: minmax_type;
}

export enum minmax_type {
  AUTO,
  FIXED,
  SOFT,
  ABSOLUTE,
}
