import { TinyColor } from "@ctrl/tinycolor";
import {
  DEFAULT_CLAMP_NEGATIVE,
  DEFAULT_COLORS,
  DEFAULT_DATA,
  DEFAULT_DATA_TYPE,
  DEFAULT_FLOAT_PRECISION,
  DEFAULT_MIN_MAX,
  DEFAULT_SERIES_TYPE,
  DEFAULT_UNIT_SEPARATOR,
  DEFAULT_Y_AXIS_ID,
  NO_VALUE,
} from "./const";
import { LovelaceConfig } from "juzz-ha-helper";
import {
  CardConfig,
  CardSeries,
  DataTypeMap,
  EntitySeries,
  FormattedValue,
} from "./types";
import {
  CardConfigExternal,
  DataPoint,
  DataType,
  DataTypeConfig,
  DataTypeGroup,
  LegendFunction,
  MinMaxPoint,
  MinMaxType,
  MinMaxValue,
  Period,
  Resolution,
  SeriesConfig,
  SeriesSetConfig,
  YAxisConfig,
} from "./types-config";
import { HassEntity } from "home-assistant-js-websocket";
import { createCheckers } from "ts-interface-checker";
import exportedTypeSuite from "./types-config-ti";
import moment from "moment";

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
 * # DataType Functions
 * ########################################
 */
export function getDefaultDataTypeConfig(): DataTypeConfig {
  return {
    dataType: DEFAULT_DATA_TYPE,
    floatPrecision: DEFAULT_FLOAT_PRECISION,
    unitSeparator: DEFAULT_UNIT_SEPARATOR,
  };
}
export function getDataTypeConfig(
  dataTypeMap: DataTypeMap,
  dataType: DataType,
): DataTypeConfig {
  return dataTypeMap.get(dataType) ?? getDefaultDataTypeConfig();
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
  const old = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hours12 = old ? { hour12: true } : { hourCycle: "h23" };
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    ...hours12,
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

  return mergeDeep(
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
      period: Period.TWO_DAY,
      showDateSelector: false,
      autoRefreshTime: 120,
      rememberOptions: true,
    },
    conf,
  );
}

/**
 * Generate the DataTypes Map, these are code defined values
 * This does not support User-Defined values in config
 * @returns The map of DataTypes, for easier lookup
 */
export function generateDataTypeMap(): DataTypeMap {
  const dataTypeMap: DataTypeMap = new Map();

  const systemDataTypes: DataTypeConfig[] = [
    {
      dataType: DataType.TEMPERATURE,
      floatPrecision: 1,
      unit: "°C",
      unitSeparator: "",
    },
    {
      dataType: DataType.HUMIDITY,
      floatPrecision: 0,
      unit: "%",
      unitSeparator: " ",
    },
    {
      dataType: DataType.POWER,
      floatPrecision: 2,
      unitArray: [
        "W",
        "kW",
        "MW",
        "GW",
      ],
      unitSeparator: " ",
      unitStep: 1000,
    },
    {
      dataType: DataType.ENERGY,
      floatPrecision: 2,
      unitArray: [
        "Wh",
        "kWh",
        "MWh",
        "GWh",
      ],
      unitSeparator: " ",
      unitStep: 1000,
    },
  ];

  systemDataTypes.forEach((dataType) => {
    dataTypeMap.set(dataType.dataType, dataType);
  });

  return dataTypeMap;
}

/**
 * Some DataTypes are not compatible for being shown on the same graph at the same time
 * Return the Group the supplied DataType belongs to
 * @param dataType The DataType to evaluate
 * @returns The DataTypeGroup this belongs to
 */
export function getDataTypeGroup(dataType: DataType): DataTypeGroup {
  switch (dataType) {
    case DataType.DEFAULT:
    case DataType.HUMIDITY:
    case DataType.POWER:
    case DataType.TEMPERATURE: {
      return DataTypeGroup.A;
    }
    case DataType.ENERGY: {
      return DataTypeGroup.B;
    }
  }
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
          dataType: DEFAULT_DATA_TYPE,
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
          dataType: DEFAULT_DATA_TYPE,
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
    const dataTypes = series
      .map((series) => series.dataType)
      .filter((value, index, array) => array.indexOf(value) === index);
    const dataTypeGroups = dataTypes
      .map((dataType) => getDataTypeGroup(dataType))
      .filter((value, index, array) => array.indexOf(value) === index);
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
  return seriesSetConf.series.map((seriesConfig, index: number) => {
    /**
     * Find the data for this series item
     */
    const entitySeries = entitySeriesArr.find(
      (entitySeries) =>
        isRequestedSeries && entitySeries.index === seriesConfig.index,
    );

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
 * Returns a label for the given period
 * @param period
 * @returns Formatted label
 */
export function getPeriodLabel(period: Period): string {
  switch (period) {
    case Period.LAST_HOUR:
      return "Last hour";
    case Period.LAST_THREE_HOUR:
      return "Last 3 hours";
    case Period.LAST_SIX_HOUR:
      return "Last 6 hours";
    case Period.LAST_TWELVE_HOUR:
      return "Last 12 hours";
    case Period.DAY:
      return "Day";
    case Period.TWO_DAY:
      return "2 Days";
    case Period.WEEK:
      return "Week";
    case Period.MONTH:
      return "Month";
  }
}

/**
 * Returns a label for the given resolution
 * @param resolution
 * @returns Formatted label
 */
export function getResolutionLabel(resolution: Resolution): string {
  switch (resolution) {
    case Resolution.RAW:
      return "Raw";
    case Resolution.ONE_MINUTE:
      return "1m";
    case Resolution.FIVE_MINUTES:
      return "5m";
    case Resolution.FIFTEEN_MINUTES:
      return "15m";
    case Resolution.THIRTY_MINUTES:
      return "30m";
    case Resolution.ONE_HOUR:
      return "1h";
    case Resolution.ONE_DAY:
      return "1d";
  }
}

/**
 * Helper to get a duration value to add/subtract a time value
 * @param period
 * @returns A moment duration
 */
export function getPeriodDuration(period: Period): moment.Duration {
  switch (period) {
    case Period.LAST_TWELVE_HOUR:
      return moment.duration(12, "hour");
    case Period.LAST_SIX_HOUR:
      return moment.duration(6, "hour");
    case Period.LAST_THREE_HOUR:
      return moment.duration(3, "hour");
    case Period.LAST_HOUR:
      return moment.duration(1, "hour");
    case Period.DAY:
    case Period.TWO_DAY:
      return moment.duration(1, "day");
    case Period.WEEK:
      return moment.duration(1, "week");
    case Period.MONTH:
      return moment.duration(1, "month");
    // case Periods.YEAR:
    //   return moment.duration(1, "year");
  }
}

/**
 * Use the given date to calculate the start and end dates based on the period supplied
 * @param date The date to work the start and end out against
 * @param period
 * @returns A dictionary of the calculated start and end dates
 */
export function calculateNewDates(
  date: moment.Moment,
  period: Period,
  resolution: Resolution,
): { startDate: moment.Moment; endDate: moment.Moment } {
  const periodDuration = getPeriodDuration(period);

  let startDate = date.clone();
  let endDate = date.clone();
  switch (period) {
    case Period.LAST_HOUR:
    case Period.LAST_THREE_HOUR:
    case Period.LAST_SIX_HOUR:
    case Period.LAST_TWELVE_HOUR: {
      // We rounding up to the end of the next interval. Raw items round up to next minute
      const duration = moment.duration(
        resolution !== Resolution.RAW ? resolution : Resolution.ONE_MINUTE,
      );
      endDate = moment(Math.ceil(+endDate / +duration) * +duration);
      startDate = endDate.clone().subtract(periodDuration);
      break;
    }
    case Period.DAY: {
      startDate = startDate.startOf("day");
      endDate = endDate.add(periodDuration).startOf("day");
      break;
    }
    case Period.TWO_DAY: {
      startDate = startDate.subtract(periodDuration).startOf("day");
      endDate = endDate.add(periodDuration).startOf("day");
      break;
    }
    case Period.WEEK: {
      startDate = startDate.startOf("isoWeek");
      endDate = endDate.add(periodDuration).startOf("isoWeek");
      break;
    }
    case Period.MONTH: {
      startDate = startDate.startOf("month");
      endDate = endDate.add(periodDuration).startOf("month");
      break;
    }
  }

  return {
    startDate: startDate,
    endDate: endDate,
  };
}

/**
 * Helper to get the supported resolutions based on the period
 * @param period
 * @param dataTypeGroup
 * @returns An array of supported resolutions
 * @throws Error if the "Supported Resolutions" for the desired period is empty
 */
export function getResolutionsForPeriod(
  period: Period,
  dataTypeGroup?: DataTypeGroup,
): Resolution[] {
  let supportedResolutions: Resolution[] = [];
  switch (dataTypeGroup) {
    case DataTypeGroup.A: {
      switch (period) {
        case Period.LAST_HOUR:
        case Period.LAST_THREE_HOUR: {
          supportedResolutions = [
            Resolution.RAW,
            Resolution.ONE_MINUTE,
            Resolution.FIVE_MINUTES,
          ];
          break;
        }
        case Period.LAST_SIX_HOUR: {
          supportedResolutions = [
            Resolution.ONE_MINUTE,
            Resolution.FIVE_MINUTES,
            Resolution.FIFTEEN_MINUTES,
            Resolution.THIRTY_MINUTES,
          ];
          break;
        }
        case Period.LAST_TWELVE_HOUR:
        case Period.DAY: {
          supportedResolutions = [
            Resolution.FIVE_MINUTES,
            Resolution.FIFTEEN_MINUTES,
            Resolution.THIRTY_MINUTES,
          ];
          break;
        }
        case Period.TWO_DAY: {
          supportedResolutions = [
            Resolution.FIFTEEN_MINUTES,
            Resolution.THIRTY_MINUTES,
          ];
          break;
        }
        case Period.WEEK:
        case Period.MONTH: {
          supportedResolutions = [Resolution.ONE_DAY];
          break;
        }
      }
      break;
    }
    case DataTypeGroup.B: {
      switch (period) {
        case Period.LAST_HOUR:
        case Period.LAST_THREE_HOUR:
        case Period.LAST_SIX_HOUR:
        case Period.LAST_TWELVE_HOUR:
        case Period.DAY:
        case Period.TWO_DAY: {
          supportedResolutions = [Resolution.ONE_HOUR];
          break;
        }
        case Period.WEEK:
        case Period.MONTH: {
          supportedResolutions = [Resolution.ONE_DAY];
          break;
        }
      }
      break;
    }
  }

  if (supportedResolutions.length === 0) {
    //throw new Error("No supported resolutions for the chosen period");
  }

  return supportedResolutions;
}

export function getDateRangeLabel(
  startDate: moment.Moment,
  endDate: moment.Moment,
  period: Period,
): string {
  switch (period) {
    case Period.LAST_HOUR:
    case Period.LAST_THREE_HOUR:
    case Period.LAST_SIX_HOUR:
    case Period.LAST_TWELVE_HOUR: {
      // if (startDate.isSame(endDate, "day")) {
      return `${startDate.format("D MMM HH:mm")} - ${endDate.format("HH:mm")}`;
      // } else {
      //   return `${startDate.format("D MMM HH:mm")} - ${endDate.format(
      //     "HH:mm",
      //   )}`;
      // }
    }
    case Period.DAY: {
      return startDate.format("D MMM YYYY");
    }
    case Period.TWO_DAY:
    case Period.WEEK: {
      return `${startDate.format("D MMM")} - ${endDate
        .subtract(1, "second")
        .format("D MMM")}`;
    }
    case Period.MONTH: {
      return startDate.format("MMMM YYYY");
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
