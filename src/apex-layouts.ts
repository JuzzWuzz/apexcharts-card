import { DEFAULT_AREA_OPACITY, DEFAULT_SERIE_TYPE } from "./const";
import {
  ChartCardConfig,
  ChartCardSeries,
  ChartCardYAxisConfig,
  DataTypeMap,
  MinMaxType,
} from "./types";
import {
  computeColor,
  computeTextColor,
  formatValueAndUom,
  getDataTypeConfig,
  mergeDeep,
} from "./utils";

export function getLayoutConfig(
  config: ChartCardConfig,
  dataTypeMap: DataTypeMap,
  series: ChartCardSeries[] = [],
  yaxis: ChartCardYAxisConfig[] = [],
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
    legend: getLegend(dataTypeMap, series),
    stroke: getStroke(config, series),
    series: getSeries(series),
    xaxis: getXAxis(start, end),
    yaxis: getYAxis(dataTypeMap, yaxis, series),
    tooltip: {
      x: {
        formatter: getXTooltipFormatter(config),
      },
      y: {
        formatter: getYTooltipFormatter(dataTypeMap, series),
      },
    },
    annotations: getAnnotations(config, dataTypeMap, series, now),
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

function getLegend(
  dataTypeMap: DataTypeMap,
  series: ChartCardSeries[],
): ApexLegend {
  const getLegendFormatter = () => {
    const legendValues = series.map((s) => {
      const name = s.config.name ?? "";
      if (!s.config.show.legend_value) {
        return name;
      } else {
        const formattedValue = formatValueAndUom(
          s.headerValue,
          getDataTypeConfig(dataTypeMap, s.config.dataTypeId),
        ).formatted();
        return `${name}: <strong>${formattedValue}</strong>`;
      }
    });
    return function (_legendName, opts) {
      return legendValues[opts.seriesIndex];
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

function doThing(
  value,
  isMin: boolean,
  align_to: number | undefined,
  configMinMax: string | number | undefined,
  type: MinMaxType,
) {
  if (type === MinMaxType.FIXED) {
    console.log("Fixed");
    return configMinMax;
  }
  let val = value;
  if (align_to !== undefined) {
    const x = Math.abs(val) % align_to;
    const y = align_to - x;
    val = val >= 0 ? (isMin ? val - x : val + y) : isMin ? val - y : val + x;
  }

  if (typeof val === "number" && typeof configMinMax === "number") {
    if (type === MinMaxType.ABSOLUTE) {
      console.log("Absolute");
      return val + configMinMax;
    }
    if (
      type === MinMaxType.SOFT &&
      ((isMin && val > configMinMax) || (!isMin && val < configMinMax))
    ) {
      console.log("Soft");
      return configMinMax;
    }
  }
  return val;
}

function getYAxis(
  dataTypeMap: DataTypeMap,
  yAxes: ChartCardYAxisConfig[],
  series: ChartCardSeries[],
): ApexYAxis[] {
  return yAxes.map((y) => {
    // Construct the ApexConfig and remove items not permitted
    const apexConfig = mergeDeep(y.apex_config);
    delete apexConfig.min;
    delete apexConfig.max;
    delete apexConfig.decimalsInFloat;

    const minMax = series
      .filter((s) => s.config.yAxisIndex === y.index)
      .map((s) => {
        return { min: s.minMaxPoint.min[1], max: s.minMaxPoint.max[1] };
      })
      .reduce(
        (
          acc: { min: number | null; max: number | null },
          cur: { min: number | null; max: number | null },
        ) => {
          if (cur.min !== null && (acc.min === null || cur.min < acc.min)) {
            acc.min = cur.min;
          }
          if (cur.max !== null && (acc.max === null || cur.max > acc.max)) {
            acc.max = cur.max;
          }
          return acc;
        },
        {
          min: null,
          max: null,
        },
      );

    const dataTypeConfig = getDataTypeConfig(dataTypeMap, y.dataTypeId);
    const mergedConfig = mergeDeep(
      {
        decimalsInFloat: dataTypeConfig.float_precision,
        labels: {
          formatter: function (value) {
            return formatValueAndUom(value, dataTypeConfig).formatted();
          },
        },
        min: function (value, x) {
          console.log(value);
          console.log(x);
          return doThing(minMax.min, true, y.align_to, y.min_value, y.min_type);
        },
        max: function (value, x) {
          console.log(value);
          console.log(x);
          return doThing(
            minMax.max,
            false,
            y.align_to,
            y.max_value,
            y.max_type,
          );
        },
      },
      y,
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

function getYTooltipFormatter(
  dataTypeMap: DataTypeMap,
  series: ChartCardSeries[],
) {
  const dataTypeConfigs = series.map((s) =>
    getDataTypeConfig(dataTypeMap, s.config.dataTypeId),
  );
  return function (value, opts) {
    const formattedValue = formatValueAndUom(
      value,
      dataTypeConfigs[opts.seriesIndex],
    ).formatted();
    return [
      `<strong>${formattedValue}</strong>`,
    ];
  };
}

function getAnnotations(
  config: ChartCardConfig,
  dataTypeMap: DataTypeMap,
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
      const extremas = s.config.show.extremas;
      const dataTypeConfig = getDataTypeConfig(
        dataTypeMap,
        s.config.dataTypeId,
      );
      if (extremas !== undefined) {
        [
          extremas === true || extremas.toString().includes("min")
            ? s.minMaxPoint.min
            : null,
          extremas === true || extremas.toString().includes("max")
            ? s.minMaxPoint.max
            : null,
        ].map((p) => {
          if (p === null) return;
          const bgColor = computeColor(s.color);
          const txtColor = computeTextColor(bgColor);
          points.push({
            x: p[0],
            y: p[1],
            seriesIndex: s.config.index,
            yAxisIndex: s.config.yAxisIndex,
            marker: {
              strokeColor: bgColor,
              fillColor: "var(--card-background-color)",
            },
            label: {
              text: formatValueAndUom(p[1], dataTypeConfig).formatted(),
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
