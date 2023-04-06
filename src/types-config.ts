export interface ChartCardConfigExternal {
  type: "custom:apexcharts-card-2";
  entity: string;
  config_templates?: string[] | string;
  color_list?: string[];
  chart_type?: "line" | "scatter";
  all_series_config?: ChartCardAllSeriesConfigExternal;
  all_yaxis_config?: ChartCardAllYAxisConfigExternal;
  yAxes?: ChartCardYAxisConfigExternal[];
  dataTypes?: ChartCardDataTypeConfigExternal[];
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

export interface ChartCardDataTypeConfigExternal {
  id: string;
  clamp_negative?: boolean;
  float_precision?: number;
  unit?: string;
  unit_step?: number;
  unit_array?: string[];
  unit_separator?: string;
}

export interface ChartCardHeaderExternalConfig {
  show?: boolean;
  floating?: boolean;
  title?: string;
  show_states?: boolean;
  colorize_states?: boolean;
  standard_format?: boolean;
}

export interface ChartCardAllSeriesConfigExternal {
  attribute?: string;
  color?: string;
  curve?: "smooth" | "straight" | "stepline";
  name?: string;
  opacity?: number;
  stroke_width?: number;
  type?: "line" | "column" | "area";
  show?: ChartCardSeriesShowConfigExternal;
}

export interface ChartCardSeriesConfigExternal
  extends ChartCardAllSeriesConfigExternal {
  dataTypeId?: string;
  yAxisIndex?: number;
  yAxisId?: string;
}

export interface ChartCardSeriesShowConfigExternal {
  in_chart?: boolean;
  in_header?: boolean;
  legend_function?: "last" | "sum";
  legend_value?: boolean;
  name_in_header?: boolean;
  extremas?: boolean | "min" | "max";
}

export interface ChartCardAllYAxisConfigExternal {
  align_to?: number;
  show?: boolean;
  opposite?: boolean;
  float_precision?: number;
  min_value?: "auto" | number | string;
  max_value?: "auto" | number | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apex_config?: any;
}

export interface ChartCardYAxisConfigExternal
  extends ChartCardAllYAxisConfigExternal {
  id: string;
  dataTypeId?: string;
}
