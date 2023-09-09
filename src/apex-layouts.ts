import { ApexOptions } from "apexcharts";
import { DEFAULT_AREA_OPACITY, DEFAULT_SERIES_TYPE } from "./const";
import { CardConfig, CardSeries, DataTypeMap } from "./types";
import {
  computeColor,
  computeTextColor,
  formatValueAndUom,
  getDataTypeConfig,
  mergeDeep,
} from "./utils";
import { YAxisConfig, MinMaxType, Period, MinMaxValue } from "./types-config";

export function getLayoutConfig(
  config: CardConfig,
  dataTypeMap: DataTypeMap,
  series: CardSeries[] = [],
  yaxis: YAxisConfig[] = [],
  now: Date = new Date(),
  start?: Date,
  end?: Date,
  period?: Period,
): ApexOptions {
  const options = {
    chart: {
      type: config.chartType || DEFAULT_SERIES_TYPE,
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
    annotations: getAnnotations(config, dataTypeMap, series, now, end, period),
  };

  return mergeDeep(options, evalApexConfig(config.apexConfig));
}

function getFill(config: CardConfig, series: CardSeries[]): ApexFill {
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
    type: config.apexConfig?.fill?.type || "solid",
  };
}

function getColors(series: CardSeries[]): string[] {
  return series.map((s) => s.color);
}

function getLegend(dataTypeMap: DataTypeMap, series: CardSeries[]): ApexLegend {
  const getLegendFormatter = () => {
    const legendValues = series.map((s) => {
      const name = s.config.name ?? "";
      if (!s.config.show.legendValue) {
        return name;
      } else {
        const formattedValue = formatValueAndUom(
          s.headerValue,
          getDataTypeConfig(dataTypeMap, s.config.dataType),
          s.config.clampNegative,
        ).formatted();
        return `${name}: <strong>${formattedValue}</strong>`;
      }
    });
    return function (_legendName, opts) {
      return legendValues[opts.seriesIndex];
    };
  };

  return {
    onItemClick: {
      toggleDataSeries: false,
    },
    position: "bottom",
    show: true,
    formatter: getLegendFormatter(),
  };
}

function getStroke(config: CardConfig, series: CardSeries[]): ApexStroke {
  const getStrokeWidth = () => {
    if (config.chartType !== undefined && config.chartType !== "line")
      return config.apexConfig?.stroke?.width ?? 3;
    return series.map((s) => {
      if (s.config.strokeWidth !== undefined) {
        return s.config.strokeWidth;
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

function getSeries(series: CardSeries[]): ApexAxisChartSeries {
  return series.map((s) => {
    return {
      name: s.config.name,
      type: s.config.type,
      data: s.config.show.inChart ? s.data : [],
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

function calculateMaxOrMin(
  value: number | null,
  isMin: boolean,
  alignTo: number | undefined,
  configMinMax: MinMaxValue,
  type: MinMaxType,
) {
  if (type === MinMaxType.FIXED) {
    return configMinMax;
  }
  let val = value;
  if (val !== null) {
    if (alignTo !== undefined) {
      const x = Math.abs(val) % alignTo;
      const y = alignTo - x;
      val = val >= 0 ? (isMin ? val - x : val + y) : isMin ? val - y : val + x;
    }

    if (typeof configMinMax === "number") {
      if (type === MinMaxType.ABSOLUTE) {
        const newVal = val + configMinMax;
        console.log(
          `Is Min and Abs. Val: ${val}. Conf Min/Max: ${configMinMax}. New Val: ${newVal}`,
        );
        if (isMin && val >= 0 && newVal < 0) {
          return 0;
        }
        return newVal;
      }
      if (
        type === MinMaxType.SOFT &&
        ((isMin && val > configMinMax) || (!isMin && val < configMinMax))
      ) {
        return configMinMax;
      }
    }
  }
  return val;
}

function getYAxis(
  dataTypeMap: DataTypeMap,
  yAxes: YAxisConfig[],
  series: CardSeries[],
): ApexYAxis[] {
  return yAxes.map((y) => {
    // Construct the ApexConfig and remove items not permitted
    const apexConfig = mergeDeep(y.apexConfig);
    delete apexConfig.min;
    delete apexConfig.max;
    delete apexConfig.decimalsInFloat;

    // Get the series that are using this Y-Axis
    const yAxisSeries = series.filter((s) => s.config.yAxisIndex === y.index);

    // Get the Min/Max values f or the Y-Axis
    const minMax = yAxisSeries
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

    // Check if all linked series are wanting to clamp negative
    const clampNegative = yAxisSeries.reduce(
      (acc, s) => acc && s.config.clampNegative,
      true,
    );

    const dataTypeConfig = getDataTypeConfig(dataTypeMap, y.dataType);

    // Merge the final config
    const mergedConfig: ApexYAxis = mergeDeep(
      {
        decimalsInFloat: dataTypeConfig.floatPrecision,
        labels: {
          formatter: function (value) {
            return formatValueAndUom(
              value,
              dataTypeConfig,
              clampNegative,
            ).formatted();
          },
        },
        max: calculateMaxOrMin(
          minMax.max,
          false,
          y.alignTo,
          y.maxValue,
          y.maxType,
        ),
        min: calculateMaxOrMin(
          minMax.min,
          true,
          y.alignTo,
          y.minValue,
          y.minType,
        ),
      },
      y,
      apexConfig,
    );

    return mergedConfig;
  });
}

function getXTooltipFormatter(config: CardConfig) {
  if (config.apexConfig?.tooltip?.x?.format) return undefined;

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

function getYTooltipFormatter(dataTypeMap: DataTypeMap, series: CardSeries[]) {
  return function (value, opts) {
    const seriesConfig = series[opts.seriesIndex].config;
    const formattedValue = formatValueAndUom(
      value,
      getDataTypeConfig(dataTypeMap, seriesConfig.dataType),
      seriesConfig.clampNegative,
    ).formatted();
    return [
      `<strong>${formattedValue}</strong>`,
    ];
  };
}

function getAnnotations(
  config: CardConfig,
  dataTypeMap: DataTypeMap,
  series: CardSeries[],
  now: Date,
  end?: Date,
  period?: Period,
): ApexAnnotations {
  const getNowAnnotation = (): XAxisAnnotations => {
    if (
      !config.now.show ||
      series.length === 0 ||
      !end ||
      now.getTime() > end.getTime() ||
      !period ||
      [
        Period.LAST_HOUR,
        Period.LAST_THREE_HOUR,
        Period.LAST_SIX_HOUR,
        Period.LAST_TWELVE_HOUR,
      ].includes(period)
    ) {
      return {};
    }
    const color = computeColor(config.now.color);
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
      const dataTypeConfig = getDataTypeConfig(dataTypeMap, s.config.dataType);
      if (extremas !== false) {
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
              text: formatValueAndUom(p[1], dataTypeConfig, false).formatted(),
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

function evalApexConfig(apexConfig?: ApexOptions): ApexOptions | undefined {
  if (!apexConfig) return undefined;

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
