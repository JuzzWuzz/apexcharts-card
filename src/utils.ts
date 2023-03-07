import { HassEntities, HassEntity } from "home-assistant-js-websocket";
import { EntityCachePoints } from "./types";
import { TinyColor } from "@ctrl/tinycolor";
import parse from "parse-duration";
import {
  ChartCardExternalConfig,
  ChartCardSeriesExternalConfig,
} from "./types-config";
import { DEFAULT_FLOAT_PRECISION } from "./const";
import {
  formatNumber,
  FrontendLocaleData,
  LovelaceConfig,
} from "custom-card-helpers";

export function getMilli(hours: number): number {
  return hours * 60 ** 2 * 10 ** 3;
}

export function log(message: unknown): void {
  // eslint-disable-next-line no-console
  console.warn("apexcharts-card: ", message);
}

/**
 * Performs a deep merge of `source` into `target`.
 * Mutates `target` only but not its objects and arrays.
 *
 * @author inspired by [jhildenbiddle](https://stackoverflow.com/a/48218209).
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export function mergeDeep(target: any, source: any): any {
  const isObject = (obj) => obj && typeof obj === "object";

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

export function computeName(
  index: number,
  series: ChartCardSeriesExternalConfig[] | undefined,
  entities: (HassEntity | undefined)[] | HassEntities | undefined = undefined,
  entity: HassEntity | undefined = undefined,
): string {
  if (!series || (!entities && !entity)) return "";
  let name = "";
  if (entity) {
    name =
      series[index].name ||
      entity.attributes?.friendly_name ||
      entity.entity_id ||
      "";
  } else if (entities) {
    name =
      series[index].name ||
      entities[index]?.attributes?.friendly_name ||
      entities[index]?.entity_id ||
      "";
  }
  return name;
}

export function formatValueAndUom(
  value: string | number | null | undefined,
  clamp_negative: boolean | undefined,
  unit: string | undefined,
  unit_step: number | undefined,
  unit_array: string[] | undefined,
  precision: number | undefined,
): [string | null, string] {
  let lValue: string | number | null | undefined = value;
  let lPrecision: number | undefined = precision;
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
    if ((clamp_negative ?? false) && lValue < 0) {
      lValue = 0;
    }
    if (unit_step && unit_array) {
      let i = 0;
      if (lValue !== 0) {
        i = Math.min(
          Math.max(
            Math.floor(Math.log(Math.abs(lValue)) / Math.log(unit_step)),
            0,
          ),
          unit_array.length - 1,
        );
        lValue = lValue / Math.pow(unit_step, i);
      }
      uom = unit_array[i];
      if (i === 0) {
        lPrecision = 0;
      }
    }
    lValue = lValue.toFixed(lPrecision);
  }

  return [
    lValue,
    uom || unit || "",
  ];
}

export function computeColors(colors: string[] | undefined): string[] {
  if (!colors) return [];
  return colors.map((color) => {
    return computeColor(color);
  });
}

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
    return "#000"; // bright colors - black font
  } else {
    return "#fff"; // dark colors - white font
  }
}

export function validateInterval(interval: string, prefix: string): number {
  const parsed = parse(interval);
  if (parsed === null) {
    throw new Error(`'${prefix}: ${interval}' is not a valid range of time`);
  }
  return parsed;
}

export function validateOffset(interval: string, prefix: string): number {
  if (interval[0] !== "+" && interval[0] !== "-") {
    throw new Error(
      `'${prefix}: ${interval}' should start with a '+' or a '-'`,
    );
  }
  return validateInterval(interval, prefix);
}

export function offsetData(
  data: EntityCachePoints,
  offset: number | undefined,
): EntityCachePoints {
  if (offset) {
    return data.map((entry) => {
      return [
        entry[0] - offset,
        entry[1],
      ];
    });
  }
  return data;
}

export function getLovelace(): LovelaceConfig | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any = document.querySelector("home-assistant");
  root = root && root.shadowRoot;
  root = root && root.querySelector("home-assistant-main");
  root = root && root.shadowRoot;
  root = root && root.querySelector("app-drawer-layout partial-panel-resolver");
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

export function mergeConfigTemplates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ll: any,
  config: ChartCardExternalConfig,
): ChartCardExternalConfig {
  const tpl = config.config_templates;
  if (!tpl) return config;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = {};
  const tpls = tpl && Array.isArray(tpl) ? tpl : [tpl];
  tpls?.forEach((template) => {
    if (!ll.config.apexcharts_card_templates?.[template])
      throw new Error(
        `apexchart-card template '${template}' is missing from your config!`,
      );
    const res = mergeConfigTemplates(
      ll,
      JSON.parse(JSON.stringify(ll.config.apexcharts_card_templates[template])),
    );
    result = mergeDeepConfig(result, res);
  });
  result = mergeDeepConfig(result, config);
  return result as ChartCardExternalConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function mergeDeepConfig(target: any, source: any): any {
  const isObject = (obj) => obj && typeof obj === "object";

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = mergeDeepConfig(targetValue, sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeepConfig(
        Object.assign({}, targetValue),
        sourceValue,
      );
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

export function formatApexDate(value: Date): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hours12 = { hourCycle: "h23" };
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

export function truncateFloat(
  value: string | number | null | undefined,
  precision: number | undefined,
): string | number | null {
  let lValue: string | number | null | undefined = value;
  if (lValue === undefined) return null;
  if (typeof lValue === "string") {
    lValue = parseFloat(lValue);
    if (Number.isNaN(lValue)) {
      return lValue;
    }
  }
  if (
    lValue !== null &&
    typeof lValue === "number" &&
    !Number.isInteger(lValue)
  ) {
    lValue = (lValue as number).toFixed(
      precision === undefined ? DEFAULT_FLOAT_PRECISION : precision,
    );
  }
  return lValue;
}

export function myFormatNumber(
  num: string | number | null | undefined,
  localeOptions?: FrontendLocaleData,
  precision?: number | undefined,
): string | null {
  let lValue: string | number | null | undefined = num;
  if (lValue === undefined || lValue === null) return null;
  if (typeof lValue === "string") {
    lValue = parseFloat(lValue);
    if (Number.isNaN(lValue)) {
      return num as string;
    }
  }
  return formatNumber(lValue, localeOptions, {
    maximumFractionDigits:
      precision === undefined ? DEFAULT_FLOAT_PRECISION : precision,
  });
}
