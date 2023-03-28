export interface ChartCardConfigExternal {
  type: "custom:apexcharts-card-2";
  entity: string;
  config_templates?: string[] | string;
  color_list?: string[];
  chart_type?: ChartCardChartType;
  all_series_config?: ChartCardSeriesConfigExternal;
  now?: {
    show?: boolean;
    color?: string;
    label?: string;
  };
  show?: {
    loading?: boolean;
    last_updated?: boolean;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apex_config?: any;
  header?: ChartCardHeaderExternalConfig;
}

export type ChartCardChartType = "line" | "scatter";

export interface ChartCardHeaderExternalConfig {
  show?: boolean;
  floating?: boolean;
  title?: string;
  show_states?: boolean;
  colorize_states?: boolean;
  standard_format?: boolean;
}

export interface ChartCardSeriesConfigExternal {
  attribute?: string;
  name?: string;
  type?: "line" | "column" | "area";
  color?: string;
  opacity?: number;
  curve?: "smooth" | "straight" | "stepline";
  stroke_width?: number;
  clamp_negative?: boolean;
  unit?: string;
  unit_step?: number;
  unit_array?: string[];
  unit_separator?: string;
  float_precision?: number;
  show?: ChartCardSeriesShowConfigExternal;
  yaxis?: ChartCardSeriesYAxisConfigExternal;
}

export interface ChartCardSeriesShowConfigExternal {
  in_chart?: boolean;
  in_header?: boolean;
  legend_function?: "last" | "sum";
  legend_value?: boolean;
  name_in_header?: boolean;
  extremas?: boolean | "min" | "max";
}

export interface ChartCardSeriesYAxisConfigExternal {
  align_to?: number;
  show?: boolean;
  opposite?: boolean;
  min_value?: "auto" | number | string;
  max_value?: "auto" | number | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apex_config?: any;
}
