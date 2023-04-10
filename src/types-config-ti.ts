/**
 * This module was automatically generated by `ts-interface-builder`
 */
import * as t from "ts-interface-checker";
// tslint:disable:object-literal-key-quotes

export const ChartCardConfigExternal = t.iface([], {
  type: t.lit("custom:apexcharts-card"),
  entity: "string",
  configTemplates: t.opt(t.union(t.array("string"), "string")),
  colorList: t.opt(t.array("string")),
  chartType: t.opt(t.union(t.lit("line"), t.lit("scatter"))),
  header: t.opt("ChartCardHeaderExternalConfig"),
  now: t.opt("ChartCardNowExternalConfig"),
  show: t.opt("ChartCardShowExternalConfig"),
  dataTypes: t.opt(t.array("ChartCardDataTypeConfigExternal")),
  allSeriesConfig: t.opt("ChartCardAllSeriesConfigExternal"),
  allYaxisConfig: t.opt("ChartCardAllYAxisConfigExternal"),
  yAxes: t.opt(t.array("ChartCardYAxisConfigExternal")),
  apexConfig: t.opt("any"),
  period: t.opt("Periods"),
  showDateSelector: t.opt("boolean"),
  autoRefreshTime: t.opt("number"),
});

export const ChartCardDataTypeConfigExternal = t.iface([], {
  id: "string",
  clampNegative: t.opt("boolean"),
  floatPrecision: t.opt("number"),
  unit: t.opt("string"),
  unitStep: t.opt("number"),
  unitArray: t.opt(t.array("string")),
  unitSeparator: t.opt("string"),
});

export const ChartCardHeaderExternalConfig = t.iface([], {
  colorizeStates: t.opt("boolean"),
  show: t.opt("boolean"),
  showStates: t.opt("boolean"),
  title: t.opt("string"),
});

export const ChartCardNowExternalConfig = t.iface([], {
  color: t.opt("string"),
  label: t.opt("string"),
  show: t.opt("boolean"),
});

export const ChartCardShowExternalConfig = t.iface([], {
  lastUpdated: t.opt("boolean"),
  loading: t.opt("boolean"),
});

export const ChartCardAllSeriesConfigExternal = t.iface([], {
  color: t.opt("string"),
  curve: t.opt(t.union(t.lit("smooth"), t.lit("straight"), t.lit("stepline"))),
  name: t.opt("string"),
  opacity: t.opt("number"),
  show: t.opt("ChartCardSeriesShowConfigExternal"),
  strokeWidth: t.opt("number"),
  type: t.opt(t.union(t.lit("line"), t.lit("column"), t.lit("area"))),
});

export const ChartCardSeriesConfigExternal = t.iface(
  ["ChartCardAllSeriesConfigExternal"],
  {
    dataTypeId: t.opt("string"),
    yAxisId: t.opt("string"),
    yAxisIndex: t.opt("number"),
  },
);

export const ChartCardSeriesShowConfigExternal = t.iface([], {
  inChart: t.opt("boolean"),
  inHeader: t.opt("boolean"),
  legendFunction: t.opt(t.union(t.lit("last"), t.lit("sum"))),
  legendValue: t.opt("boolean"),
  nameInHeader: t.opt("boolean"),
  extremas: t.opt(t.union("boolean", t.lit("min"), t.lit("max"))),
});

export const ChartCardAllYAxisConfigExternal = t.iface([], {
  alignTo: t.opt("number"),
  floatPrecision: t.opt("number"),
  opposite: t.opt("boolean"),
  maxValue: t.opt(t.union(t.lit("auto"), "number", "string")),
  minValue: t.opt(t.union(t.lit("auto"), "number", "string")),
  show: t.opt("boolean"),
  apexConfig: t.opt("any"),
});

export const ChartCardYAxisConfigExternal = t.iface(
  ["ChartCardAllYAxisConfigExternal"],
  {
    dataTypeId: t.opt("string"),
    id: t.opt("string"),
  },
);

export const Periods = t.enumtype({
  LAST_HOUR: "-1h",
  LAST_THREE_HOUR: "-3h",
  LAST_SIX_HOUR: "-6h",
  LAST_TWELVE_HOUR: "-12h",
  DAY: "1d",
  TWO_DAY: "2d",
  WEEK: "1w",
  MONTH: "1m",
  YEAR: "1y",
});

const exportedTypeSuite: t.ITypeSuite = {
  ChartCardConfigExternal,
  ChartCardDataTypeConfigExternal,
  ChartCardHeaderExternalConfig,
  ChartCardNowExternalConfig,
  ChartCardShowExternalConfig,
  ChartCardAllSeriesConfigExternal,
  ChartCardSeriesConfigExternal,
  ChartCardSeriesShowConfigExternal,
  ChartCardAllYAxisConfigExternal,
  ChartCardYAxisConfigExternal,
  Periods,
};
export default exportedTypeSuite;
