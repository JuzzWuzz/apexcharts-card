import { HomeAssistant } from "juzz-ha-helper";
import {
  DEFAULT_AREA_OPACITY,
  DEFAULT_FLOAT_PRECISION,
  DEFAULT_SERIE_TYPE,
  NO_VALUE,
} from "./const";
import { ChartCardConfig, ChartCardSeriesConfig } from "./types";
import {
  computeName,
  formatValueAndUom,
  mergeDeep,
  myFormatNumber,
} from "./utils";

export function getLayoutConfig(
  config: ChartCardConfig,
  seriesConfig: ChartCardSeriesConfig[],
  hass: HomeAssistant | undefined = undefined,
): unknown {
  const def = {
    chart: {
      type: config.chart_type || DEFAULT_SERIE_TYPE,
      stacked: config?.stacked,
      foreColor: "var(--primary-text-color)",
      width: "100%",
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    grid: {
      strokeDashArray: 3,
    },
    fill: {
      opacity: getFillOpacity(seriesConfig),
      type: getFillType(config),
    },
    series: getSeries(seriesConfig),
    xaxis: getXAxis(),
    yaxis: getYAxis(config),
    tooltip: {
      x: {
        formatter: getXTooltipFormatter(config),
      },
      y: {
        formatter: getYTooltipFormatter(seriesConfig),
      },
    },
    dataLabels: {
      enabled: getDataLabelsEnabled(seriesConfig),
      enabledOnSeries: getDataLabels_enabledOnSeries(seriesConfig),
      formatter: getDataLabelsFormatter(seriesConfig, hass),
    },
    legend: {
      position: "bottom",
      show: true,
      formatter: getLegendFormatter(seriesConfig),
    },
    stroke: {
      curve: getStrokeCurve(seriesConfig),
      lineCap: "butt",
      width: getStrokeWidth(config, seriesConfig),
    },
    markers: {
      showNullDataPoints: false,
    },
    noData: {
      text: "Loading...",
    },
  };

  //console.log(JSON.stringify(def));

  const xx = config.apex_config
    ? mergeDeep(def, evalApexConfig(config.apex_config))
    : def;

  //console.log(JSON.stringify(xx));
  return xx;
}

function getFillOpacity(seriesConfig: ChartCardSeriesConfig[]): number[] {
  return seriesConfig.map((series) => {
    return series.opacity !== undefined
      ? series.opacity
      : series.type === "area"
      ? DEFAULT_AREA_OPACITY
      : 1;
  });
}

function getSeries(seriesConfig: ChartCardSeriesConfig[]) {
  return seriesConfig.map((series, index) => {
    return {
      name: computeName(index, seriesConfig),
      type: series.type,
      data: [],
    };
  });
}

function getXAxis() {
  return {
    type: "datetime",
    // range: getMilli(config.hours_to_show),
    labels: {
      datetimeUTC: false,
      datetimeFormatter: getDateTimeFormatter(),
    },
  };
}

function getYAxis(config: ChartCardConfig) {
  return Array.isArray(config.apex_config?.yaxis) || config.yaxis
    ? undefined
    : {
        decimalsInFloat: DEFAULT_FLOAT_PRECISION,
      };
}

function getDateTimeFormatter(): unknown {
  // eslint-disable-next-line no-constant-condition
  if (false) {
    return {
      year: "yyyy",
      month: "MMM 'yy",
      day: "dd MMM",
      hour: "HH:mm",
      minute: "HH:mm:ss",
    };
  } else {
    return {
      year: "yyyy",
      month: "MMM 'yy",
      day: "dd MMM",
      hour: "hh:mm tt",
      minute: "hh:mm:ss tt",
    };
  }
}

function getXTooltipFormatter(
  config: ChartCardConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
  //: ((val: number, _a: any, _b: any) => string) | undefined
  if (config.apex_config?.tooltip?.x?.format) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return function (val, _a, _b) {
    console.log("Route B");
    console.log(val);
    console.log(_a);
    console.log(_b);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).format(val);
  };
}

function getYTooltipFormatter(seriesConfig: ChartCardSeriesConfig[]) {
  return function (value, opts, seriesConf = seriesConfig) {
    let lValue = value;
    let uom: string | undefined = undefined;
    const unitSeparator = seriesConf[opts.seriesIndex].unit_separator ?? " ";
    const series = seriesConf[opts.seriesIndex];
    [
      lValue,
      uom,
    ] = formatValueAndUom(
      lValue,
      series.clamp_negative,
      series.unit,
      series.unit_step,
      series.unit_array,
      series.float_precision,
    );
    return [`<strong>${lValue}${unitSeparator}${uom}</strong>`];
  };
}

function getDataLabelsEnabled(seriesConfig: ChartCardSeriesConfig[]): boolean {
  return seriesConfig.some((series) => {
    return series.show.datalabels;
  });
}

function getDataLabelsFormatter(
  seriesConfig: ChartCardSeriesConfig[],
  hass: HomeAssistant | undefined,
) {
  return function (value, opts, seriesConf = seriesConfig, lHass = hass) {
    if (seriesConf[opts.seriesIndex].show.datalabels === "total") {
      return myFormatNumber(
        opts.w.globals.stackedSeriesTotals[opts.dataPointIndex],
        lHass?.locale,
        seriesConf[opts.seriesIndex].float_precision,
      );
    }
    if (value === null) return;
    return myFormatNumber(
      value,
      lHass?.locale,
      seriesConf[opts.seriesIndex].float_precision,
    );
  };
}

function getLegendFormatter(seriesConfig: ChartCardSeriesConfig[]) {
  return function (_, opts, seriesConf = seriesConfig) {
    const name = computeName(opts.seriesIndex, seriesConf);
    if (!seriesConf[opts.seriesIndex].show.legend_value) {
      return [name];
    } else {
      let uom: string | undefined = undefined;
      const unitSeparator = seriesConf[opts.seriesIndex].unit_separator ?? " ";
      const series = seriesConf[opts.seriesIndex];

      let value;
      const legend_function = series.show.legend_function;
      if (legend_function === "sum") {
        value = opts.w.globals.series[opts.seriesIndex].reduce(
          (a, b) => a + b,
          0,
        );
      } else {
        value = opts.w.globals.series[opts.seriesIndex].slice(-1)[0];
      }
      [
        value,
        uom,
      ] = formatValueAndUom(
        value,
        series.clamp_negative,
        series.unit,
        series.unit_step,
        series.unit_array,
        series.float_precision,
      );
      let valueString = "";
      if (value === undefined || value === null) {
        valueString = `<strong>${NO_VALUE}${unitSeparator}${uom}</strong>`;
      } else {
        valueString = `<strong>${value}${unitSeparator}${uom}</strong>`;
      }
      return [
        name + ":",
        valueString,
      ];
    }
  };
}

function getStrokeCurve(seriesConfig: ChartCardSeriesConfig[]) {
  return seriesConfig.map((series) => {
    return series.curve || "smooth";
  });
}

function getDataLabels_enabledOnSeries(seriesConfig: ChartCardSeriesConfig[]) {
  return seriesConfig.flatMap((series, index) => {
    return series.show.datalabels ? [index] : [];
  });
}

function getStrokeWidth(
  config: ChartCardConfig,
  seriesConfig: ChartCardSeriesConfig[],
) {
  if (config.chart_type !== undefined && config.chart_type !== "line")
    return config.apex_config?.stroke?.width === undefined
      ? 3
      : config.apex_config?.stroke?.width;
  return seriesConfig.map((series) => {
    if (series.stroke_width !== undefined) {
      return series.stroke_width;
    }
    return [
      undefined,
      "line",
      "area",
    ].includes(series.type)
      ? 5
      : 0;
  });
}

function getFillType(config: ChartCardConfig) {
  return config.apex_config?.fill?.type || "solid";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evalApexConfig(apexConfig: any): any {
  const eval2 = eval;
  Object.keys(apexConfig).forEach((key) => {
    if (
      typeof apexConfig[key] === "string" &&
      apexConfig[key].trim().startsWith("EVAL:")
    ) {
      apexConfig[key] = eval2(`(${apexConfig[key].trim().slice(5)})`);
    }
    if (typeof apexConfig[key] === "object") {
      apexConfig[key] = evalApexConfig(apexConfig[key]);
    }
  });
  return apexConfig;
}
