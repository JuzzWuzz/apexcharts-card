/**
 * This module was automatically generated by `ts-interface-builder`
 */
import * as t from "ts-interface-checker";
// tslint:disable:object-literal-key-quotes

export const ChartCardExternalConfig = t.iface([], {
  type: t.lit("custom:apexcharts-card-2"),
  entity: "string",
  config_templates: t.opt(t.union(t.array("string"), "string")),
  color_list: t.opt(t.array("string")),
  chart_type: t.opt("ChartCardChartType"),
  all_series_config: t.opt("ChartCardAllSeriesExternalConfig"),
  now: t.opt(
    t.iface([], {
      show: t.opt("boolean"),
      color: t.opt("string"),
      label: t.opt("string"),
    }),
  ),
  show: t.opt(
    t.iface([], {
      loading: t.opt("boolean"),
      last_updated: t.opt("boolean"),
    }),
  ),
  stacked: t.opt("boolean"),
  apex_config: t.opt("any"),
  header: t.opt("ChartCardHeaderExternalConfig"),
  yaxis: t.opt(t.array("ChartCardYAxisExternal")),
});

export const ChartCardChartType = t.union(t.lit("line"), t.lit("scatter"));

export const ChartCardAllSeriesExternalConfig = t.iface([], {
  attribute: t.opt("string"),
  name: t.opt("string"),
  type: t.opt(t.union(t.lit("line"), t.lit("column"), t.lit("area"))),
  color: t.opt("string"),
  opacity: t.opt("number"),
  curve: t.opt(t.union(t.lit("smooth"), t.lit("straight"), t.lit("stepline"))),
  stroke_width: t.opt("number"),
  extend_to: t.opt(t.union(t.lit(false), t.lit("end"), t.lit("now"))),
  clamp_negative: t.opt("boolean"),
  unit: t.opt("string"),
  unit_step: t.opt("number"),
  unit_array: t.opt(t.array("string")),
  unit_separator: t.opt("string"),
  float_precision: t.opt("number"),
  show: t.opt("ChartCardSeriesShowConfigExt"),
  yaxis_id: t.opt("string"),
});

export const ChartCardSeriesShowConfigExt = t.iface([], {
  in_chart: t.opt("boolean"),
  in_header: t.opt(t.union("boolean", t.lit("before_now"), t.lit("after_now"))),
  legend_function: t.opt(t.union(t.lit("last"), t.lit("sum"))),
  legend_value: t.opt("boolean"),
  name_in_header: t.opt("boolean"),
  datalabels: t.opt(t.union("boolean", t.lit("total"), t.lit("percent"))),
  extremas: t.opt(
    t.union(
      "boolean",
      t.lit("time"),
      t.lit("min"),
      t.lit("max"),
      t.lit("min+time"),
      t.lit("max+time"),
    ),
  ),
});

export const ChartCardHeaderExternalConfig = t.iface([], {
  show: t.opt("boolean"),
  floating: t.opt("boolean"),
  title: t.opt("string"),
  show_states: t.opt("boolean"),
  colorize_states: t.opt("boolean"),
  standard_format: t.opt("boolean"),
});

export const ChartCardYAxisExternal = t.iface([], {
  id: t.opt("string"),
  show: t.opt("boolean"),
  opposite: t.opt("boolean"),
  min: t.opt(t.union(t.lit("auto"), "number", "string")),
  max: t.opt(t.union(t.lit("auto"), "number", "string")),
  align_to: t.opt("number"),
  decimals: t.opt("number"),
  apex_config: t.opt("any"),
});

const exportedTypeSuite: t.ITypeSuite = {
  ChartCardExternalConfig,
  ChartCardChartType,
  ChartCardAllSeriesExternalConfig,
  ChartCardSeriesShowConfigExt,
  ChartCardHeaderExternalConfig,
  ChartCardYAxisExternal,
};
export default exportedTypeSuite;
