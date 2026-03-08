import { TinyColor } from "@ctrl/tinycolor";
import {
  DEFAULT_COLORS,
  DEFAULT_DATA,
  DEFAULT_MIN_MAX,
  DEFAULT_SERIES_TYPE,
  DEFAULT_Y_AXIS_ID,
  NO_VALUE,
} from "./const";
import {
  DataType,
  DataTypeConfig,
  DEFAULT_CLAMP_NEGATIVE,
  DEFAULT_FLOAT_PRECISION,
  LovelaceConfig,
} from "juzz-ha-helper";
import { CardConfig, CardSeries, EntitySeries, FormattedValue } from "./types";
import {
  CardConfigExternal,
  DataPoint,
  DataTypeGroup,
  LegendFunction,
  MinMaxPoint,
  MinMaxType,
  MinMaxValue,
  Period,
  SeriesConfig,
  SeriesSetConfig,
  YAxisConfig,
} from "./types-config";
import { HassEntity } from "home-assistant-js-websocket";
import { createCheckers } from "ts-interface-checker";
import { basicTypes, BasicType } from "ts-interface-checker/dist/types";
import exportedTypeSuite from "./types-config-ti";
import { DateTime, Duration } from "luxon";

/**
 * Add support for the DataType enum
 */
basicTypes["DataType"] = new BasicType(
  (v) => Object.values(DataType).includes(v),
  "is not a DataType",
);

/**
 * ########################################
 * # Color Functions
 * ########################################
 */

export function computeColor(color: string): string {
  if (color[0] === "#") {
    return new TinyColor(color).toHexString();
  } else if (color.substring(0, 3) === "var") {
    return new TinyColor(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(color.substring(4).slice(0, -1))
        .trim(),
    ).toHexString();
  } else {
    return new TinyColor(color).toHexString();
  }
}
export function computeTextColor(backgroundColor: string): string {
  const colorObj = new TinyColor(backgroundColor);
  if (colorObj.isValid && colorObj.getLuminance() > 0.5) {
    return "#000"; // Bright colors => Black font
  } else {
    return "#fff"; // Dark colors => White font
  }
}

/**
 * ########################################
 * # Y-Axis Functions
 * ########################################
 */

export function getTypeOfMinMax(
  value?: MinMaxValue,
): [number | undefined, MinMaxType] {
  if (typeof value === "number") {
    return [
      value,
      MinMaxType.FIXED,
    ];
  } else if (value === undefined || value === "auto") {
    return [
      undefined,
      MinMaxType.AUTO,
    ];
  }
  if (typeof value === "string") {
    const matched = value.match(/[+-]?\d+(\.\d+)?/g);
    if (!matched || matched.length !== 1) {
      throw Error(`Calculating Y-Axis Min/Max Type: Bad format: ${value}`);
    }
    const floatValue = parseFloat(matched[0]);
    if (value.startsWith("~")) {
      return [
        floatValue,
        MinMaxType.SOFT,
      ];
    } else if (value.startsWith("|") && value.endsWith("|")) {
      return [
        floatValue,
        MinMaxType.ABSOLUTE,
      ];
    }
  }
  throw Error(`Calculating Y-Axis Min/Max Type: Bad format: ${value}`);
}

/**
 * ########################################
 * # Formatting Functions
 * ########################################
 */

export function formatApexDate(value: Date): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).format(value);
}
export function formatValueAndUom(
  value: string | number | null | undefined,
  dataTypeConfig: DataTypeConfig,
  clampNegative: boolean,
): FormattedValue {
  let lValue: string | number | null | undefined = value;
  let lPrecision: number = dataTypeConfig.floatPrecision;
  if (lValue === undefined || lValue === null) {
    lValue = null;
  } else {
    if (typeof lValue === "string") {
      lValue = parseFloat(lValue);

      if (Number.isNaN(lValue)) {
        lValue = value as string;
      }
    }
  }
  let uom: string | undefined = undefined;
  if (typeof lValue === "number") {
    if (clampNegative && lValue < 0) {
      lValue = 0;
    }
    if (dataTypeConfig.unitStep && dataTypeConfig.unitArray) {
      let i = 0;
      if (lValue !== 0) {
        i = Math.min(
          Math.max(
            Math.floor(
              Math.log(Math.abs(lValue)) / Math.log(dataTypeConfig.unitStep),
            ),
            0,
          ),
          dataTypeConfig.unitArray.length - 1,
        );
        lValue = lValue / Math.pow(dataTypeConfig.unitStep, i);
      }
      uom = dataTypeConfig.unitArray[i];
      if (i === 0) {
        lPrecision = 0;
      }
    }
    lValue = lValue.toFixed(lPrecision);
    // Fix for `-0`
    lValue = lValue.replace(/^-([.0]*)$/, "$1");
  }

  return {
    value: lValue ?? NO_VALUE,
    unitSeparator: dataTypeConfig?.unitSeparator,
    unitOfMeasurement: uom ?? dataTypeConfig?.unit ?? "",
    formatted() {
      return [
        this.value,
        this.unitOfMeasurement,
      ]
        .filter((s) => (s ?? "").trim().length > 0)
        .join(this.unitSeparator);
    },
  };
}

/**
 * ########################################
 * # Merging Functions
 * ########################################
 */

export function mergeConfigTemplates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ll: any,
  config: CardConfigExternal,
): CardConfigExternal {
  const tpl = config.configTemplates;
  if (!tpl) return config;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = {};
  const tpls = tpl && Array.isArray(tpl) ? tpl : [tpl];
  tpls?.forEach((template) => {
    if (!ll.config.apexchartsCardTemplates?.[template])
      throw Error(
        `Template Merging: Template '${template}' is missing from your config`,
      );
    const res = mergeConfigTemplates(
      ll,
      JSON.parse(JSON.stringify(ll.config.apexchartsCardTemplates[template])),
    );
    result = mergeDeep(result, res);
  });
  result = mergeDeep(result, config);
  return result as CardConfigExternal;
}

/**
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
export function mergeDeep(...objects) {
  const isObject = (obj) => obj && typeof obj === "object";
  const merge = (target, source) => {
    if (isObject(source)) {
      Object.keys(source).forEach((key) => {
        const tVal = target[key];
        const sVal = source[key];

        if (Array.isArray(tVal) && Array.isArray(sVal)) {
          target[key] = merge(tVal, sVal);
        } else if (isObject(tVal) && isObject(sVal)) {
          target[key] = merge(tVal, sVal);
        } else {
          target[key] = sVal;
        }
      });
    }
    return target;
  };

  return objects.reduce((prev, obj) => {
    return merge(prev, obj);
  }, {});
}

/**
 * ########################################
 * # Misc Functions
 * ########################################
 */

export function getLovelace(): LovelaceConfig | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any = document.querySelector("home-assistant");
  root = root && root.shadowRoot;
  root = root && root.querySelector("home-assistant-main");
  root = root && root.shadowRoot;
  root =
    root &&
    root.querySelector(
      "app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver",
    );
  root = (root && root.shadowRoot) || root;
  root = root && root.querySelector("ha-panel-lovelace");
  root = root && root.shadowRoot;
  root = root && root.querySelector("hui-root");
  if (root) {
    const ll = root.lovelace;
    ll.current_view = root.___curView;
    return ll;
  }
  return null;
}

/**
 * Returns whethere the supplied date is valid or not
 * @param date The date to check
 * @returns If the date is valid
 */
export function isDateValid(date): boolean {
  return date instanceof Date && isFinite(date.getTime());
}

/**
 * ########################################
 * # Generation Functions
 * ########################################
 */

/**
 * Generate the base config based on a default set of values merged in with the user data
 * @param conf The base config
 * @returns The compiled final config
 */
export function generateBaseConfig(conf: CardConfigExternal): CardConfig {
  const { CardConfigExternal } = createCheckers(exportedTypeSuite);
  CardConfigExternal.strictCheck(conf);

  const cardConfig = mergeDeep(
    {
      colorList: DEFAULT_COLORS,
      header: {
        appendSeriesSetName: false,
        colorizeStates: false,
        show: false,
        showStates: false,
      },
      now: {
        color: "var(--primary-color)",
        show: false,
      },
      show: {
        lastUpdated: true,
        loading: true,
      },
      period: Period.DAY,
      showDateSelector: false,
      autoRefreshTime: 120,
      rememberOptions: true,
    },
    conf,
  );

  // Evaluate any "EVAL:" string values in apexConfig once at config-build time,
  // rather than on every getLayoutConfig() call (i.e. every entity state update).
  evalApexConfig(cardConfig.apexConfig);

  return cardConfig;
}

/**
 * Recursively evaluates any string values prefixed with "EVAL:" as JavaScript expressions.
 * Mutates the object in place. Called once at setConfig() time so getLayoutConfig() receives
 * a pre-evaluated config and does not repeat the walk on every entity state change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evalApexConfig(apexConfig?: any): void {
  if (!apexConfig) return;
  Object.keys(apexConfig).forEach((key) => {
    if (
      typeof apexConfig[key] === "string" &&
      apexConfig[key].trim().startsWith("EVAL:")
    ) {
      // eslint-disable-next-line no-eval
      apexConfig[key] = eval(`(${apexConfig[key].trim().slice(5)})`);
    }
    if (typeof apexConfig[key] === "object") {
      evalApexConfig(apexConfig[key]);
    }
  });
}

/**
 * Some DataTypes are not compatible for being shown on the same graph at the same time
 * Return the Group the supplied DataType belongs to
 * @param dataType The DataType to evaluate
 * @returns The DataTypeGroup this belongs to
 */
export function getDataTypeGroup(dataType: DataType): DataTypeGroup {
  if (dataType === DataType.ENERGY) {
    return DataTypeGroup.B;
  }

  return DataTypeGroup.A;
}

/**
 * Generate the SeriesSets based on the main chart config
 * Validation is run to ensure the supplied config is compatible with one another
 * @param conf The base config
 * @returns An array of the Series Sets
 */
export function generateSeriesSets(conf: CardConfig): SeriesSetConfig[] {
  return conf.seriesSets.map((seriesSetConf) => {
    const yAxes = (seriesSetConf.yAxes ?? [{}]).map((yaxis, index, arr) => {
      const multiYAxis = arr.length > 1;
      if (multiYAxis && yaxis.id === undefined) {
        throw Error(
          `Y-Axis ${index}: Must specify a value for the Y-Axis <id> when using multiple Y-Axes`,
        );
      }
      // Compute the Y-Axis Config
      const yaxisConfig: YAxisConfig = mergeDeep(
        {
          index: index,
          id: DEFAULT_Y_AXIS_ID,
          dataType: DataType.DEFAULT,
          floatPrecision: DEFAULT_FLOAT_PRECISION,
          maxType: MinMaxType.AUTO,
          minType: MinMaxType.AUTO,
          multiYAxis: multiYAxis,
          opposite: false,
          show: true,
        },
        conf.allYaxisConfig,
        seriesSetConf.allYaxisConfig,
        yaxis,
      );

      // Set Min/Max types
      [
        yaxisConfig.minValue,
        yaxisConfig.minType,
      ] = getTypeOfMinMax(yaxisConfig.minValue);
      [
        yaxisConfig.maxValue,
        yaxisConfig.maxType,
      ] = getTypeOfMinMax(yaxisConfig.maxValue);

      return yaxisConfig;
    });

    const series = seriesSetConf.series.map((series, index) => {
      // Compute the Series Config
      const seriesConfig: SeriesConfig = mergeDeep(
        {
          clampNegative: DEFAULT_CLAMP_NEGATIVE,
          dataType: DataType.DEFAULT,
          index: index,
          show: {
            extremas: false,
            inChart: true,
            inHeader: true,
            legendFunction: "last",
            legendValue: false,
            nameInHeader: true,
          },
          yAxisId: DEFAULT_Y_AXIS_ID,
          yAxisIndex: -1,
        },
        conf.allSeriesConfig,
        seriesSetConf.allSeriesConfig,
        series,
      );
      // Set the series chart type
      seriesConfig.type = conf.chartType
        ? undefined
        : seriesConfig.type || DEFAULT_SERIES_TYPE;

      /**
       * Figure out the Y-Axis
       */
      const yAxis = yAxes.find((yAxis) => yAxis.id === seriesConfig.yAxisId);
      if (yAxis === undefined) {
        if (
          seriesSetConf.yAxes !== undefined &&
          seriesConfig.yAxisId === DEFAULT_Y_AXIS_ID
        ) {
          throw Error(
            `Series ${index}: You need to specify a 'yAxisId' matching one defined in the 'yAxes' array`,
          );
        } else {
          throw Error(
            `Series ${index}: Requested a 'yAxisId' of '${seriesConfig.yAxisId}', that does not exist`,
          );
        }
      }
      seriesConfig.yAxisIndex = yAxis.index;

      return seriesConfig;
    });

    // Check for compatibility between the series
    const dataTypes = [...new Set(series.map((s) => s.dataType))];
    const dataTypeGroups = [
      ...new Set(dataTypes.map((dataType) => getDataTypeGroup(dataType))),
    ];
    if (dataTypeGroups.length > 1) {
      throw Error(
        `Series Set '${
          seriesSetConf.name
        }' has incompatible DataType's: ${dataTypes.join(", ")}`,
      );
    }

    // Construct the final Series Set Config item
    const seriesSetConfig: SeriesSetConfig = {
      dataTypeGroup: dataTypeGroups[0],
      name: seriesSetConf.name,
      series: series,
      yAxes: yAxes,
    };

    // Run validators to ensure the final config is correct
    const { SeriesSetConfig } = createCheckers(exportedTypeSuite);
    SeriesSetConfig.strictCheck(seriesSetConfig);

    return seriesSetConfig;
  });
}

/**
 * Generate the series data based on the enntities attribute data
 * @param entity The Home Assistant entity, used to get attributes and data
 * @param conf The base config
 * @param seriesSetConf The SeriesSet config
 * @returns An array of Series objects that contains the data and necessary config
 */
export function generateSeries(
  entity: HassEntity,
  conf: CardConfig,
  seriesSetConf?: SeriesSetConfig,
): CardSeries[] {
  if (!seriesSetConf) return [];
  const isRequestedSeries = entity.attributes.seriesSet === seriesSetConf.name;
  const entitySeriesArr: EntitySeries[] = entity.attributes.series ?? [];
  const entitySeriesByIndex = new Map(
    entitySeriesArr.map((es) => [
      es.index,
      es,
    ]),
  );
  return seriesSetConf.series.map((seriesConfig, index: number) => {
    /**
     * Find the data for this series item
     */
    const entitySeries = isRequestedSeries
      ? entitySeriesByIndex.get(seriesConfig.index)
      : undefined;

    /**
     * Load the series data
     */
    const seriesData: Array<DataPoint> = entitySeries?.data ?? DEFAULT_DATA;

    /**
     * Load the Min/Max for the series
     */
    const seriesMinMax: MinMaxPoint = entitySeries?.minMax ?? DEFAULT_MIN_MAX;

    /**
     * Compute the Header values
     */
    let seriesHeaderValue: number | null = null;
    if (seriesConfig.show.inHeader) {
      switch (seriesConfig.show.legendFunction) {
        case "sum": {
          seriesHeaderValue = seriesData.reduce((sum, entry) => {
            if (entry[1] !== null) return sum + entry[1];
            return sum;
          }, 0);

          break;
        }
        case "last": {
          if (seriesData.length > 0) {
            seriesHeaderValue = seriesData[seriesData.length - 1][1];
          }

          break;
        }
      }
    }

    /**
     * Load the series color
     */
    const graphColors = conf.colorList;
    const seriesColor =
      seriesConfig.color ?? graphColors[index % graphColors.length];

    return {
      config: seriesConfig,
      data: seriesData,
      minMaxPoint: seriesMinMax,
      headerValue: seriesHeaderValue,
      color: seriesColor,
    };
  });
}

/**
 * ########################################
 * # Generation Functions
 * ########################################
 */

/**
 * Helper to get a duration value to add/subtract a time value
 * @param period
 * @returns A luxon Duration
 */
export function getPeriodDuration(period: Period): Duration {
  switch (period) {
    case Period.LAST_TWELVE_HOUR:
      return Duration.fromObject({ hours: 12 });
    case Period.LAST_SIX_HOUR:
      return Duration.fromObject({ hours: 6 });
    case Period.LAST_THREE_HOUR:
      return Duration.fromObject({ hours: 3 });
    case Period.LAST_HOUR:
      return Duration.fromObject({ hours: 1 });
    case Period.DAY:
      return Duration.fromObject({ days: 1 });
    case Period.WEEK:
      return Duration.fromObject({ weeks: 1 });
    case Period.MONTH:
      return Duration.fromObject({ months: 1 });
    case Period.YEAR:
      return Duration.fromObject({ years: 1 });
  }
}

/**
 * Use the given date to calculate the start and end dates based on the period supplied
 * @param date The date to work the start and end out against
 * @param period
 * @returns A dictionary of the calculated start and end dates
 */
export function calculateNewDates(
  date: DateTime,
  period: Period,
): { startDate: DateTime; endDate: DateTime } {
  const periodDuration = getPeriodDuration(period);

  // DateTime is immutable — no clone() needed
  let startDate = date;
  let endDate = date;
  switch (period) {
    case Period.LAST_HOUR:
    case Period.LAST_THREE_HOUR:
    case Period.LAST_SIX_HOUR:
    case Period.LAST_TWELVE_HOUR: {
      startDate = date.minus(periodDuration);
      break;
    }
    case Period.DAY: {
      startDate = startDate.startOf("day");
      endDate = endDate.plus(periodDuration).startOf("day");
      break;
    }
    case Period.WEEK: {
      startDate = startDate.startOf("week");
      endDate = endDate.plus(periodDuration).startOf("week");
      break;
    }
    case Period.MONTH: {
      startDate = startDate.startOf("month");
      endDate = endDate.plus(periodDuration).startOf("month");
      break;
    }
    case Period.YEAR: {
      startDate = startDate.startOf("year");
      endDate = endDate.plus(periodDuration).startOf("year");
      break;
    }
  }

  return {
    startDate: startDate,
    endDate: endDate,
  };
}

export function getDateRangeLabel(
  startDate: DateTime,
  endDate: DateTime,
  period: Period,
): string {
  switch (period) {
    case Period.LAST_HOUR:
    case Period.LAST_THREE_HOUR:
    case Period.LAST_SIX_HOUR:
    case Period.LAST_TWELVE_HOUR: {
      return `${startDate.toFormat("d MMM HH:mm")} - ${endDate.toFormat("HH:mm")}`;
    }
    case Period.DAY: {
      return startDate.toFormat("d MMM yyyy");
    }
    case Period.WEEK: {
      return `${startDate.toFormat("d MMM")} - ${endDate
        .minus({ seconds: 1 })
        .toFormat("d MMM")}`;
    }
    case Period.MONTH: {
      return startDate.toFormat("MMMM yyyy");
    }
    case Period.YEAR: {
      return startDate.toFormat("yyyy");
    }
  }
}

export function getHeaderStateFunctionLabel(
  legendFunction: LegendFunction,
): string {
  switch (legendFunction) {
    case "last": {
      return "Last";
    }
    case "sum": {
      return "Sum";
    }
  }
}
