import { TinyColor } from "@ctrl/tinycolor";
import { ChartCardExternalConfig } from "./types-config";
import { DEFAULT_FLOAT_PRECISION, NO_VALUE } from "./const";
import { LovelaceConfig } from "juzz-ha-helper";
import { ChartCardSeriesConfig, FormattedValue } from "./types";

export function log(message: unknown): void {
  // eslint-disable-next-line no-console
  console.warn("apexcharts-card: ", message);
}

export function formatValueAndUom(
  value: string | number | null | undefined,
  seriesConf: ChartCardSeriesConfig,
): FormattedValue {
  let lValue: string | number | null | undefined = value;
  let lPrecision: number =
    seriesConf.float_precision ?? DEFAULT_FLOAT_PRECISION;
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
    if ((seriesConf.clamp_negative ?? false) && lValue < 0) {
      lValue = 0;
    }
    if (seriesConf.unit_step && seriesConf.unit_array) {
      let i = 0;
      if (lValue !== 0) {
        i = Math.min(
          Math.max(
            Math.floor(
              Math.log(Math.abs(lValue)) / Math.log(seriesConf.unit_step),
            ),
            0,
          ),
          seriesConf.unit_array.length - 1,
        );
        lValue = lValue / Math.pow(seriesConf.unit_step, i);
      }
      uom = seriesConf.unit_array[i];
      if (i === 0) {
        lPrecision = 0;
      }
    }
    lValue = lValue.toFixed(lPrecision);
  }

  return {
    value: lValue ?? NO_VALUE,
    unitSeparator: seriesConf.unit_separator ?? " ",
    unitOfMeasurement: uom ?? seriesConf.unit ?? "",
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
    if (!ll.config.apexcharts_card_templates_2?.[template])
      throw new Error(
        `apexchart-card template '${template}' is missing from your config!`,
      );
    const res = mergeConfigTemplates(
      ll,
      JSON.parse(
        JSON.stringify(ll.config.apexcharts_card_templates_2[template]),
      ),
    );
    result = mergeDeep(result, res);
  });
  result = mergeDeep(result, config);
  return result as ChartCardExternalConfig;
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
