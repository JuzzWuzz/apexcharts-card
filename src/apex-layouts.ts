import { HomeAssistant } from "custom-card-helpers";
import {
  DEFAULT_AREA_OPACITY,
  DEFAULT_FLOAT_PRECISION,
  DEFAULT_SERIE_TYPE,
  NO_VALUE,
  TIMESERIES_TYPES,
} from "./const";
import { ChartCardConfig } from "./types";
import {
  computeName,
  computeUom,
  formatValueAndUom,
  mergeDeep,
  myFormatNumber,
  prettyPrintTime,
} from "./utils";
import { getDefaultLocale } from "./locales";

export function getLayoutConfig(
  config: ChartCardConfig,
  hass: HomeAssistant | undefined = undefined,
): unknown {
  const def = {
    chart: {
      locales: [getDefaultLocale()],
      defaultLocale: "en",
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
      opacity: getFillOpacity(config),
      type: getFillType(config),
    },
    series: getSeries(config, hass),
    labels: getLabels(config, hass),
    xaxis: getXAxis(config),
    yaxis: getYAxis(config),
    tooltip: {
      x: {
        formatter: getXTooltipFormatter(config),
      },
      y: {
        formatter: getYTooltipFormatter(config, hass),
      },
    },
    dataLabels: {
      enabled: getDataLabelsEnabled(config),
      enabledOnSeries: getDataLabels_enabledOnSeries(config),
      formatter: getDataLabelsFormatter(config, hass),
    },
    legend: {
      position: "bottom",
      show: true,
      formatter: getLegendFormatter(config, hass),
    },
    stroke: {
      curve: getStrokeCurve(config),
      lineCap: "butt",
      width: getStrokeWidth(config),
    },
    markers: {
      showNullDataPoints: false,
    },
    noData: {
      text: "Loading...",
    },
  };

  const conf = {};
  return config.apex_config
    ? mergeDeep(mergeDeep(def, conf), evalApexConfig(config.apex_config))
    : mergeDeep(def, conf);
}

function getFillOpacity(config: ChartCardConfig): number[] {
  const series = config.series_in_graph;
  return series.map((serie) => {
    return serie.opacity !== undefined
      ? serie.opacity
      : serie.type === "area"
      ? DEFAULT_AREA_OPACITY
      : 1;
  });
}

function getSeries(config: ChartCardConfig, hass: HomeAssistant | undefined) {
  const series = config.series_in_graph;
  if (TIMESERIES_TYPES.includes(config.chart_type)) {
    return series.map((serie, index) => {
      return {
        name: computeName(index, series, undefined, hass?.states[serie.entity]),
        type: serie.type,
        data: [],
      };
    });
  } else {
    return [];
  }
}

function getLabels(config: ChartCardConfig, hass: HomeAssistant | undefined) {
  if (TIMESERIES_TYPES.includes(config.chart_type)) {
    return [];
  } else {
    return config.series_in_graph.map((serie, index) => {
      return computeName(
        index,
        config.series_in_graph,
        undefined,
        hass?.states[serie.entity],
      );
    });
  }
}

function getXAxis(config: ChartCardConfig) {
  if (TIMESERIES_TYPES.includes(config.chart_type)) {
    return {
      type: "datetime",
      // range: getMilli(config.hours_to_show),
      labels: {
        datetimeUTC: false,
        datetimeFormatter: getDateTimeFormatter(),
      },
    };
  } else {
    return {};
  }
}

function getYAxis(config: ChartCardConfig) {
  return Array.isArray(config.apex_config?.yaxis) || config.yaxis
    ? undefined
    : {
        decimalsInFloat: DEFAULT_FLOAT_PRECISION,
      };
}

function getDateTimeFormatter(): unknown {
  return {
    year: "yyyy",
    month: "MMM 'yy",
    day: "dd MMM",
    hour: "HH:mm",
    minute: "HH:mm:ss",
  };
}

function getXTooltipFormatter(
  config: ChartCardConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
  //: ((val: number, _a: any, _b: any) => string) | undefined
  if (config.apex_config?.tooltip?.x?.format) return undefined;

  // return function (value, opts, conf = config, hass2 = hass) {
  //   console.log(opts);
  //   console.log(conf);
  //   console.log(hass2);
  //   return `${value}`;
  // };

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

function getYTooltipFormatter(
  config: ChartCardConfig,
  hass: HomeAssistant | undefined,
) {
  return function (value, opts, conf = config, hass2 = hass) {
    let lValue = value;
    let uom: string | undefined = undefined;
    const unitSeparator =
      conf.series_in_graph[opts.seriesIndex].unit_separator ?? " ";
    if (!conf.series_in_graph[opts.seriesIndex]?.show.as_duration) {
      const series = conf.series_in_graph[opts.seriesIndex];
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
    } else {
      uom = computeUom(
        opts.seriesIndex,
        conf.series_in_graph,
        undefined,
        hass2?.states[conf.series_in_graph[opts.seriesIndex].entity],
      );
    }
    return conf.series_in_graph[opts.seriesIndex]?.show.as_duration
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        [
          `<strong>${prettyPrintTime(
            lValue,
            conf.series_in_graph[opts.seriesIndex].show.as_duration!,
          )}</strong>`,
        ]
      : [`<strong>${lValue}${unitSeparator}${uom}</strong>`];
  };
}

function getDataLabelsEnabled(config: ChartCardConfig): boolean {
  return (
    !TIMESERIES_TYPES.includes(config.chart_type) ||
    config.series_in_graph.some((serie) => {
      return serie.show.datalabels;
    })
  );
}

function getDataLabelsFormatter(
  config: ChartCardConfig,
  hass: HomeAssistant | undefined,
) {
  return function (value, opts, conf = config, lHass = hass) {
    if (conf.series_in_graph[opts.seriesIndex].show.datalabels === "total") {
      return myFormatNumber(
        opts.w.globals.stackedSeriesTotals[opts.dataPointIndex],
        lHass?.locale,
        conf.series_in_graph[opts.seriesIndex].float_precision,
      );
    }
    if (value === null) return;
    return myFormatNumber(
      value,
      lHass?.locale,
      conf.series_in_graph[opts.seriesIndex].float_precision,
    );
  };
}

function getLegendFormatter(
  config: ChartCardConfig,
  hass: HomeAssistant | undefined,
) {
  return function (_, opts, conf = config, hass2 = hass) {
    const name = computeName(
      opts.seriesIndex,
      conf.series_in_graph,
      undefined,
      hass2?.states[conf.series_in_graph[opts.seriesIndex].entity],
    );
    if (!conf.series_in_graph[opts.seriesIndex].show.legend_value) {
      return [name];
    } else {
      let value;
      if (TIMESERIES_TYPES.includes(config.chart_type)) {
        const legend_function =
          conf.series_in_graph[opts.seriesIndex].show.legend_function;
        if (legend_function === "sum") {
          value = opts.w.globals.series[opts.seriesIndex].reduce(
            (a, b) => a + b,
            0,
          );
        } else {
          value = opts.w.globals.series[opts.seriesIndex].slice(-1)[0];
        }
      } else {
        value = opts.w.globals.series[opts.seriesIndex];
      }
      let uom: string | undefined = undefined;
      const unitSeparator =
        conf.series_in_graph[opts.seriesIndex].unit_separator ?? " ";
      if (!conf.series_in_graph[opts.seriesIndex]?.show.as_duration) {
        const series = conf.series_in_graph[opts.seriesIndex];
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
      } else {
        uom = computeUom(
          opts.seriesIndex,
          conf.series_in_graph,
          undefined,
          hass2?.states[conf.series_in_graph[opts.seriesIndex].entity],
        );
      }
      let valueString = "";
      if (value === undefined || value === null) {
        valueString = `<strong>${NO_VALUE}${unitSeparator}${uom}</strong>`;
      } else {
        if (conf.series_in_graph[opts.seriesIndex]?.show.as_duration) {
          valueString = `<strong>${prettyPrintTime(
            value,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            conf.series_in_graph[opts.seriesIndex].show.as_duration!,
          )}</strong>`;
        } else {
          valueString = `<strong>${value}${unitSeparator}${uom}</strong>`;
        }
      }
      return [
        name + ":",
        valueString,
      ];
    }
  };
}

function getStrokeCurve(config: ChartCardConfig) {
  const series = config.series_in_graph;
  return series.map((serie) => {
    return serie.curve || "smooth";
  });
}

function getDataLabels_enabledOnSeries(config: ChartCardConfig) {
  return config.series_in_graph.flatMap((serie, index) => {
    return serie.show.datalabels ? [index] : [];
  });
}

function getStrokeWidth(config: ChartCardConfig) {
  if (config.chart_type !== undefined && config.chart_type !== "line")
    return config.apex_config?.stroke?.width === undefined
      ? 3
      : config.apex_config?.stroke?.width;
  const series = config.series_in_graph;
  return series.map((serie) => {
    if (serie.stroke_width !== undefined) {
      return serie.stroke_width;
    }
    return [
      undefined,
      "line",
      "area",
    ].includes(serie.type)
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
