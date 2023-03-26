import {
  DEFAULT_AREA_OPACITY,
  DEFAULT_FLOAT_PRECISION,
  DEFAULT_SERIE_TYPE,
} from "./const";
import { ChartCardConfig, ChartCardSeries } from "./types";
import {
  computeColor,
  computeTextColor,
  formatValueAndUom,
  mergeDeep,
} from "./utils";

export function getLayoutConfig(
  config: ChartCardConfig,
  series: ChartCardSeries[] = [],
  now: Date = new Date(),
  start?: Date,
  end?: Date,
): unknown {
  const def = {
    chart: {
      type: config.chart_type || DEFAULT_SERIE_TYPE,
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
    markers: {
      showNullDataPoints: false,
    },
    noData: {
      text: "Loading...",
    },
    fill: getFill(config, series),
    colors: getColors(series),
    legend: getLegend(series),
    stroke: getStroke(config, series),
    series: getSeries(series),
    xaxis: getXAxis(start, end),
    yaxis: getYAxis(series),
    tooltip: {
      x: {
        formatter: getXTooltipFormatter(config),
      },
      y: {
        formatter: getYTooltipFormatter(series),
      },
    },
    annotations: getAnnotations(config, series, now),
  };

  const xx = config.apex_config
    ? mergeDeep(def, evalApexConfig(config.apex_config))
    : def;

  console.log("##########");
  console.log("Layout Config:");
  console.log("##########");
  console.log(JSON.stringify(xx));
  console.log(xx);
  console.log("##########");
  return xx;
}

function getFill(config: ChartCardConfig, series: ChartCardSeries[]): ApexFill {
  const getOpacity = () => {
    return series.map((s) => {
      return (
        s.config.opacity ??
        (s.config.type === "area" ? DEFAULT_AREA_OPACITY : 1)
      );
    });
  };
  return {
    opacity: getOpacity(),
    type: config.apex_config?.fill?.type || "solid",
  };
}

function getColors(series: ChartCardSeries[]): string[] {
  return series.map((s) => s.color);
}

function getLegend(series: ChartCardSeries[]): ApexLegend {
  const getLegendFormatter = () => {
    if (series === undefined) return undefined;
    return function (_legendName, opts, seriesConf = series) {
      const s = seriesConf[opts.seriesIndex];
      const name = s.config.name ?? "";
      if (!s.config.show.legend_value) {
        return name;
      } else {
        const formattedValue = formatValueAndUom(
          s.headerValue,
          s.config,
        ).formatted();
        return `${name}: <strong>${formattedValue}</strong>`;
      }
    };
  };

  return {
    position: "bottom",
    show: true,
    formatter: getLegendFormatter(),
  };
}

function getStroke(
  config: ChartCardConfig,
  series: ChartCardSeries[],
): ApexStroke {
  const getStrokeWidth = () => {
    if (config.chart_type !== undefined && config.chart_type !== "line")
      return config.apex_config?.stroke?.width ?? 3;
    return series.map((s) => {
      if (s.config.stroke_width !== undefined) {
        return s.config.stroke_width;
      }
      return [
        undefined,
        "line",
        "area",
      ].includes(s.config.type)
        ? 5
        : 0;
    });
  };
  return {
    curve: series.map((s) => {
      return s.config.curve ?? "smooth";
    }),
    lineCap: "butt",
    width: getStrokeWidth(),
  };
}

function getSeries(series: ChartCardSeries[]): ApexAxisChartSeries {
  return series.map((s) => {
    return {
      name: s.config.name,
      type: s.config.type,
      data: s.config.show.in_chart ? s.data : [],
    };
  });
}

function getXAxis(start?: Date, end?: Date): ApexXAxis {
  if (start === undefined || isNaN(start.getTime())) {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  }
  if (end === undefined || isNaN(end.getTime())) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }
  const xAxis: ApexXAxis = {
    type: "datetime",
    min: start.getTime(),
    max: end.getTime(),
    labels: {
      datetimeUTC: false,
      datetimeFormatter: {
        year: "yyyy",
        month: "MMM 'yy",
        day: "dd MMM",
        hour: "hh:mm tt",
        minute: "hh:mm:ss tt",
      },
    },
  };
  return xAxis;
}

function getYAxis(series: ChartCardSeries[]): ApexYAxis[] {
  return series.map((s) => {
    // Construct the ApexConfig and remove items not permitted
    const apexConfig = mergeDeep(s.yAxis.apex_config);
    delete apexConfig.min;
    delete apexConfig.max;
    delete apexConfig.decimalsInFloat;

    const mergedConfig = mergeDeep(
      {
        decimalsInFloat: s.config.float_precision ?? DEFAULT_FLOAT_PRECISION,
        labels: {
          formatter: function (value) {
            return formatValueAndUom(value, s.config).formatted();
          },
        },
      },
      s.yAxis,
      apexConfig,
    );
    delete mergedConfig.align_to;
    delete mergedConfig.apex_config;
    delete mergedConfig.min_type;
    delete mergedConfig.max_type;
    delete mergedConfig.min_value;
    delete mergedConfig.max_value;

    return mergedConfig as ApexYAxis;
  });
}

function getXTooltipFormatter(config: ChartCardConfig) {
  if (config.apex_config?.tooltip?.x?.format) return undefined;

  return function (val) {
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

function getYTooltipFormatter(series: ChartCardSeries[]) {
  return function (value, opts, seriesConf = series.map((s) => s.config)) {
    const s = seriesConf[opts.seriesIndex];
    const formattedValue = formatValueAndUom(value, s).formatted();
    return [
      `<strong>${formattedValue}</strong>`,
    ];
  };
}

function getAnnotations(
  config: ChartCardConfig,
  series: ChartCardSeries[],
  now: Date,
): ApexAnnotations {
  const getNowAnnotation = (): XAxisAnnotations => {
    if (config.now?.show !== true || series.length === 0) {
      return {};
    }
    const color = computeColor(config.now.color || "var(--primary-color)");
    const textColor = computeTextColor(color);
    return {
      x: now.getTime(),
      strokeDashArray: 3,
      label: {
        text: config.now.label,
        borderColor: color,
        style: {
          color: textColor,
          background: color,
        },
      },
      borderColor: color,
    };
  };
  const getMinMaxPoints = (): PointAnnotations[] => {
    const points: PointAnnotations[] = [];
    series.map((s) => {
      const extremas = s.config.show.extremas?.toString();
      if (extremas !== undefined) {
        [
          extremas.includes("min") ? s.minPoint : null,
          extremas.includes("max") ? s.maxPoint : null,
        ].map((p) => {
          if (p === null) return;
          const bgColor = computeColor(s.color);
          const txtColor = computeTextColor(bgColor);
          points.push({
            x: p[0],
            y: p[1],
            seriesIndex: s.config.index,
            yAxisIndex: s.config.index,
            marker: {
              strokeColor: bgColor,
              fillColor: "var(--card-background-color)",
            },
            label: {
              text: formatValueAndUom(p[1], s.config).value,
              borderColor: "var(--card-background-color)",
              borderWidth: 2,
              style: {
                background: bgColor,
                color: txtColor,
              },
            },
          });
        });
      }
    });
    return points;
  };
  return {
    xaxis: [getNowAnnotation()],
    points: getMinMaxPoints(),
  };
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
