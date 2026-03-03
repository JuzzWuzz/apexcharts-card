import { ApexOptions } from "apexcharts";
import { DEFAULT_AREA_OPACITY, DEFAULT_SERIES_TYPE } from "./const";
import { CardConfig, CardSeries, DataInterval } from "./types";
import {
  computeColor,
  computeTextColor,
  formatValueAndUom,
  mergeDeep,
} from "./utils";
import {
  DataTypeGroup,
  MinMaxType,
  MinMaxValue,
  Period,
  YAxisConfig,
} from "./types-config";
import { DateTime } from "luxon";
import { getDataTypeConfig } from "juzz-ha-helper";

export function getLayoutConfig(
  config: CardConfig,
  dataTypeGroup?: DataTypeGroup,
  series: CardSeries[] = [],
  yaxis: YAxisConfig[] = [],
  now: Date = new Date(),
  start?: Date,
  end?: Date,
  period?: Period,
  dataInterval?: DataInterval,
): ApexOptions {
  const options = {
    chart: {
      type: config.chartType || DEFAULT_SERIES_TYPE,
      foreColor: "var(--primary-text-color)",
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
    xaxis: getXAxis(start, end, dataTypeGroup),
    yaxis: getYAxis(yaxis, series),
    tooltip: {
      x: {
        formatter: getXTooltipFormatter(dataInterval),
      },
      y: {
        formatter: getYTooltipFormatter(series),
      },
    },
    annotations: getAnnotations(
      config,
      series,
      now,
      end,
      period,
      dataTypeGroup,
    ),
  };

  return mergeDeep(options, evalApexConfig(config.apexConfig));
}

function getFill(config: CardConfig, series: CardSeries[]) {
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

function getLegend(series: CardSeries[]) {
  const getLegendFormatter = () => {
    const legendValues = series.map((s) => {
      const name = s.config.name ?? "";
      if (!s.config.show.legendValue) {
        return name;
      } else {
        const formattedValue = formatValueAndUom(
          s.headerValue,
          getDataTypeConfig(s.config.dataType),
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
      toggleDataSeries: true,
    },
    position: "bottom",
    show: true,
    formatter: getLegendFormatter(),
  };
}

function getStroke(config: CardConfig, series: CardSeries[]) {
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

function getSeries(series: CardSeries[]) {
  return series.map((s) => {
    return {
      name: s.config.name,
      type: s.config.type,
      data: s.config.show.inChart
        ? s.data.map((d) => ({ x: d[0], y: d[1] }))
        : [],
    };
  });
}

function getXAxis(start?: Date, end?: Date, dataTypeGroup?: DataTypeGroup) {
  const labels = {
    datetimeUTC: false,
    datetimeFormatter: {
      year: "yyyy",
      month: "MMM 'yy",
      day: "dd MMM",
      hour: "HH:mm",
      minute: "HH:mm",
    },
  };

  if (dataTypeGroup === DataTypeGroup.B) {
    return { type: "datetime", labels };
  }

  if (start === undefined || isNaN(start.getTime())) {
    start = DateTime.now().startOf("day").toJSDate();
  }
  if (end === undefined || isNaN(end.getTime())) {
    end = DateTime.now().endOf("day").toJSDate();
  }
  return {
    type: "datetime",
    min: start.getTime(),
    max: end.getTime() - 1,
    labels,
  };
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

function getYAxis(yAxes: YAxisConfig[], series: CardSeries[]) {
  const apexYAxes = yAxes.map((y) => {
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

    // Get the DataType's config
    const dataTypeConfig = getDataTypeConfig(y.dataType);

    // Merge the final config
    return mergeDeep(
      {
        showAlways: true,
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
  });

  /**
   * When using multiple Y-Axes there needs to be one per series
   * But must only show the same axis once
   */
  if (yAxes.length === 1) {
    return apexYAxes;
  } else {
    const yAxisSeen: Map<number, boolean> = new Map();
    return series.map((s) => {
      const yAxisIndex = s.config.yAxisIndex;
      const showAxis = (yAxisSeen.get(yAxisIndex) ?? false) === false;
      yAxisSeen.set(yAxisIndex, true);
      return mergeDeep(apexYAxes[yAxisIndex], {
        show: showAxis,
      });
    });
  }
}

function getXTooltipFormatter(dataInterval?: DataInterval) {
  return function (value) {
    const lValue = Number.parseInt(value);
    if (isNaN(lValue)) return value;
    const dt = DateTime.fromMillis(lValue);
    switch (dataInterval?.unit) {
      case "year":
        return dt.toFormat("yyyy");
      case "month":
        return dt.toFormat("MMMM yyyy");
      case "day":
        return dt.toFormat("d MMMM yyyy");
      case "week": {
        const weekEnd = dt.plus({ days: 6 });
        if (dt.year === weekEnd.year) {
          return `${dt.toFormat("d MMM")} - ${weekEnd.toFormat("d MMM yyyy")}`;
        }
        return `${dt.toFormat("d MMM yyyy")} - ${weekEnd.toFormat("d MMM yyyy")}`;
      }
      default:
        // minute, hour, or unknown: include time
        return dt.toFormat("d MMM yyyy, HH:mm");
    }
  };
}

function getYTooltipFormatter(series: CardSeries[]) {
  return function (value, opts) {
    const seriesConfig = series[opts.seriesIndex].config;
    const formattedValue = formatValueAndUom(
      value,
      getDataTypeConfig(seriesConfig.dataType),
      seriesConfig.clampNegative,
    ).formatted();
    return [
      `<strong>${formattedValue}</strong>`,
    ];
  };
}

function getAnnotations(
  config: CardConfig,
  series: CardSeries[],
  now: Date,
  end?: Date,
  period?: Period,
  dataTypeGroup?: DataTypeGroup,
) {
  const getNowAnnotation = () => {
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
      ].includes(period) ||
      dataTypeGroup === DataTypeGroup.B
    ) {
      return {
        x: null,
      };
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
  const getMinMaxPoints = () => {
    const points: object[] = [];
    series.forEach((s) => {
      const extremas = s.config.show.extremas;
      const dataTypeConfig = getDataTypeConfig(s.config.dataType);
      if (extremas !== false) {
        [
          extremas === true || extremas.toString().includes("min")
            ? s.minMaxPoint.min
            : null,
          extremas === true || extremas.toString().includes("max")
            ? s.minMaxPoint.max
            : null,
        ].forEach((p) => {
          if (p === null || p[1] === null) return;
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

  Object.keys(apexConfig).forEach((key) => {
    if (
      typeof apexConfig[key] === "string" &&
      apexConfig[key].trim().startsWith("EVAL:")
    ) {
      // eslint-disable-next-line no-eval
      apexConfig[key] = eval(`(${apexConfig[key].trim().slice(5)})`);
    }
    if (typeof apexConfig[key] === "object") {
      apexConfig[key] = evalApexConfig(apexConfig[key]);
    }
  });
  return apexConfig;
}
