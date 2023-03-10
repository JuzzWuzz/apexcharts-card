export interface ChartCardExternalConfig {
  type: "custom:apexcharts-card-2";
  entity: string;
  config_templates?: string[] | string;
  color_list?: string[];
  chart_type?: ChartCardChartType;
  update_interval?: string;
  update_delay?: string;
  all_series_config?: ChartCardAllSeriesExternalConfig;
  series?: ChartCardSeriesExternalConfig[];
  span_generator?: string;
  now?: {
    show?: boolean;
    color?: string;
    label?: string;
  };
  show?: {
    loading?: boolean;
    last_updated?: boolean;
  };
  stacked?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apex_config?: any;
  header?: ChartCardHeaderExternalConfig;
  yaxis?: ChartCardYAxisExternal[];
}

export type ChartCardChartType = "line" | "scatter";

export interface ChartCardSpanExtConfig {
  start?: ChartCardStartEnd;
  end?: ChartCardStartEnd;
  offset?: string;
}

export type ChartCardStartEnd =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "isoWeek";

export interface ChartCardAllSeriesExternalConfig {
  entity?: string;
  attribute?: string;
  name?: string;
  type?: "line" | "column" | "area";
  color?: string;
  opacity?: number;
  curve?: "smooth" | "straight" | "stepline";
  stroke_width?: number;
  extend_to?: false | "end" | "now";
  clamp_negative?: boolean;
  unit?: string;
  unit_step?: number;
  unit_array?: string[];
  unit_separator?: string;
  data_generator?: string;
  float_precision?: number;
  min?: number;
  max?: number;
  show?: ChartCardSeriesShowConfigExt;
  yaxis_id?: string;
}

export interface ChartCardSeriesShowConfigExt {
  legend_value?: boolean;
  legend_function?: "last" | "sum";
  in_header?: boolean | "raw" | "before_now" | "after_now";
  name_in_header?: boolean;
  in_chart?: boolean;
  datalabels?: boolean | "total" | "percent";
  extremas?: boolean | "time" | "min" | "max" | "min+time" | "max+time";
}

export interface ChartCardSeriesExternalConfig
  extends ChartCardAllSeriesExternalConfig {
  entity: string;
}

export interface ChartCardHeaderExternalConfig {
  show?: boolean;
  floating?: boolean;
  title?: string;
  show_states?: boolean;
  colorize_states?: boolean;
  standard_format?: boolean;
}

export interface ChartCardYAxisExternal {
  id?: string;
  show?: boolean;
  opposite?: boolean;
  min?: "auto" | number | string;
  max?: "auto" | number | string;
  align_to?: number;
  decimals?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apex_config?: any;
}
