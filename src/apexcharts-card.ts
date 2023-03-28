import {
  LitElement,
  html,
  TemplateResult,
  PropertyValues,
  CSSResultGroup,
} from "lit";
import { property, customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import { StyleInfo, styleMap } from "lit/directives/style-map.js";
import {
  ChartCardConfig,
  ChartCardSeries,
  ChartCardSeriesConfig,
  ChartCardSeriesYAxisConfig,
  DataPoint,
  MinMaxType,
} from "./types";
import * as pjson from "../package.json";
import {
  formatApexDate,
  formatValueAndUom,
  getLovelace,
  log,
  mergeConfigTemplates,
  mergeDeep,
} from "./utils";
import ApexCharts from "apexcharts";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import { createCheckers } from "ts-interface-checker";
import { ChartCardConfigExternal } from "./types-config";
import exportedTypeSuite from "./types-config-ti";
import {
  DEFAULT_DATA,
  DEFAULT_MAX_POINT,
  DEFAULT_MIN_POINT,
  DEFAULT_UPDATE_DELAY,
} from "./const";
import { DEFAULT_COLORS, DEFAULT_SERIE_TYPE } from "./const";
import { HomeAssistant } from "juzz-ha-helper";

/* eslint no-console: 0 */
console.info(
  `%c APEXCHARTS-CARD %c v${pjson.version} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ApexCharts = ApexCharts;

@customElement("apexcharts-card-2")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ChartsCard extends LitElement {
  private _hass?: HomeAssistant;

  private _apexChart?: ApexCharts;

  private _loaded = false;

  @property({ type: Boolean }) private _updating = false;

  @property({ attribute: false }) private _config?: ChartCardConfig;

  @property({ attribute: false })
  private _series: ChartCardSeries[] = [];

  private _entity?: HassEntity;

  private _updateDelay: number = DEFAULT_UPDATE_DELAY;

  @property({ attribute: false }) _lastUpdated: Date = new Date();

  public connectedCallback() {
    super.connectedCallback();
    if (this._config && this._hass && !this._loaded) {
      this._initialLoad();
    } else if (this._config && this._hass && this._apexChart) {
      window.requestAnimationFrame(() => {
        this._updateOnInterval();
      });
    }
  }

  disconnectedCallback() {
    this._updating = false;
    super.disconnectedCallback();
  }

  private _updateOnInterval(): void {
    if (!this._updating && this._hass) {
      this._updateData();
    }
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (this._config && this._hass && this.isConnected && !this._loaded) {
      this._initialLoad();
    }
  }

  public set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (!this._config || !hass) return;

    const entityState = hass.states[this._config.entity];
    if (entityState === undefined) {
      return;
    }
    if (this._entity !== entityState) {
      this._entity = entityState;
      if (!this._updating) {
        setTimeout(() => {
          this._updateData();
        }, this._updateDelay);
      }
    }
  }

  public setConfig(config: ChartCardConfigExternal) {
    let configDup: ChartCardConfigExternal = JSON.parse(JSON.stringify(config));
    if (configDup.config_templates) {
      configDup.config_templates =
        configDup.config_templates && Array.isArray(configDup.config_templates)
          ? configDup.config_templates
          : [configDup.config_templates];
      configDup = mergeConfigTemplates(getLovelace(), configDup);
    }
    try {
      const { ChartCardConfigExternal } = createCheckers(exportedTypeSuite);
      ChartCardConfigExternal.strictCheck(configDup);

      this._config = mergeDeep(
        {
          show: { loading: true },
        },
        configDup,
      );

      console.log("##########");
      console.log("CONFIG:");
      console.log(this._config);
      console.log(JSON.stringify(this._config));
      console.log("##########");
      console.log();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `/// apexcharts-card version ${pjson.version} /// ${e.message}`,
      );
    }
  }

  private async _updateData() {
    if (!this._config || !this._apexChart || !this._entity) return;

    this._updating = true;
    const now = new Date();
    this._lastUpdated = now;

    try {
      const start = new Date(this._entity.attributes.start);
      const end = new Date(this._entity.attributes.end);
      const conf = this._config;

      // Get the colours to use
      const graphColors = this._config?.color_list || DEFAULT_COLORS;

      // Do Config load
      this._series = (this._entity.attributes.series ?? []).map(
        (series, index) => {
          try {
            /**
             * Check the config to ensure  valid options are being supplied
             */
            const { ChartCardSeriesConfigExternal } =
              createCheckers(exportedTypeSuite);
            ChartCardSeriesConfigExternal.strictCheck(series.config);

            /**
             * Load the series config
             */
            const seriesConfig: ChartCardSeriesConfig = mergeDeep(
              {
                index: index,
                show: {
                  legend_value: true,
                  legend_function: "last",
                  in_chart: true,
                  in_header: true,
                  name_in_header: true,
                },
              },
              conf.all_series_config,
              series.config,
            );
            // Set the series chart type
            seriesConfig.type = this._config?.chart_type
              ? undefined
              : seriesConfig.type || DEFAULT_SERIE_TYPE;

            console.log("##########");
            console.log("Series Config:");
            console.log(seriesConfig);

            /**
             * Load the series data
             */
            const seriesData: Array<DataPoint> = series.data ?? DEFAULT_DATA;
            const seriesMinPoint = seriesData.reduce((prev, cur) => {
              if (cur[1] !== null && (prev[1] === null || cur[1] < prev[1]))
                return cur;
              return prev;
            }, DEFAULT_MIN_POINT);
            const seriesMaxPoint = seriesData.reduce((prev, cur) => {
              if (cur[1] !== null && (prev[1] === null || cur[1] > prev[1]))
                return cur;
              return prev;
            }, DEFAULT_MAX_POINT);

            console.log("##########");
            console.log("Series Min & Max:");
            console.log(seriesMinPoint);
            console.log(seriesMaxPoint);

            const inHeader = seriesConfig.show.in_header;
            let seriesHeaderValue: number | null = null;
            if (inHeader) {
              if (seriesConfig.show.legend_function === "sum") {
                seriesHeaderValue = seriesData.reduce((sum, entry) => {
                  if (entry[1] !== null) return sum + entry[1];
                  return sum;
                }, 0);
              } else if (seriesData.length > 0) {
                seriesHeaderValue = seriesData[seriesData.length - 1][1];
              }
            }

            console.log("##########");
            console.log("Series Header Value");
            console.log(seriesHeaderValue);

            /**
             * Load the series color
             */
            const seriesColor =
              seriesConfig.color ?? graphColors[index % graphColors.length];

            console.log("##########");
            console.log("Series Color:");
            console.log(seriesColor);

            /**
             * Load the series Y-Axis
             */
            const seriesYAxis = mergeDeep(seriesConfig);

            // Set Min/Max values
            [
              seriesYAxis.min_value,
              seriesYAxis.min_type,
            ] = this._getTypeOfMinMax(seriesYAxis.min_value);
            [
              seriesYAxis.max_value,
              seriesYAxis.max_type,
            ] = this._getTypeOfMinMax(seriesYAxis.max_value);

            // this._computeYAxisAutoMinMax(seriesYAxis);

            console.log("##########");
            console.log("Series Y-Axis:");
            console.log(seriesYAxis);

            console.log("##########");

            return {
              config: seriesConfig,
              data: seriesData,
              minPoint: seriesMinPoint,
              maxPoint: seriesMaxPoint,
              headerValue: seriesHeaderValue,
              color: seriesColor,
              yAxis: seriesYAxis,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            throw new Error(
              `/// apexcharts-card version ${pjson.version} /// ${e.message}`,
            );
          }
        },
      );

      this._apexChart?.updateOptions(
        getLayoutConfig(conf, this._series, now, start, end),
        false,
        false,
      );
    } catch (err) {
      log(err);
    }
    this._updating = false;
  }

  static get styles(): CSSResultGroup {
    return stylesApex;
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const spinnerClass: ClassInfo = {
      "lds-ring": this._config.show?.loading && this._updating ? true : false,
    };
    const wrapperClasses: ClassInfo = {
      wrapper: true,
      "with-header": this._config.header?.show || true,
    };

    const standardHeaderTitle = this._config.header?.standard_format
      ? this._config.header?.title
      : undefined;

    return html`
      <ha-card header=${ifDefined(standardHeaderTitle)}>
        <div id="spinner-wrapper">
          <div id="spinner" class=${classMap(spinnerClass)}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
        <div class=${classMap(wrapperClasses)}>
          ${this._config.header?.show &&
          (this._config.header.show_states ||
            !this._config.header.standard_format)
            ? this._renderHeader()
            : html``}
          <div id="graph-wrapper">
            <div id="graph"></div>
          </div>
        </div>
        ${this._renderLastUpdated()}
      </ha-card>
    `;
  }

  private _renderHeader(): TemplateResult {
    const classes: ClassInfo = {
      floating: this._config?.header?.floating || false,
    };
    return html`
      <div id="header" class=${classMap(classes)}>
        ${!this._config?.header?.standard_format && this._config?.header?.title
          ? this._renderTitle()
          : html``}
        ${this._config?.header?.show_states ? this._renderStates() : html``}
      </div>
    `;
  }

  private _renderTitle(): TemplateResult {
    return html`<div id="header__title" class="disabled">
      <span>${this._config?.header?.title}</span>
    </div>`;
  }

  private _renderStates(): TemplateResult {
    const seriesStates = this._series
      .filter((s) => s.config.show.in_header)
      .map((s) => {
        const formatted = formatValueAndUom(s.headerValue, s.config);
        const styles: StyleInfo = {
          color: this._config?.header?.colorize_states ? s.color : "",
        };
        return html`
          <div id="states__state" class="disabled">
            <div id="state__value">
              <span id="state" style=${styleMap(styles)}>
                ${formatted.value}
              </span>
              <span id="uom">${formatted.unitOfMeasurement}</span>
            </div>
            ${s.config.show.name_in_header
              ? html`<div id="state__name">${s.config.name ?? ""}</div>`
              : html``}
          </div>
        `;
      });
    return html`<div id="header__states">${seriesStates}</div>`;
  }

  private _renderLastUpdated(): TemplateResult {
    if (this._config?.show?.last_updated) {
      return html`
        <div id="last_updated">${formatApexDate(this._lastUpdated)}</div>
      `;
    }
    return html``;
  }

  private async _initialLoad() {
    await this.updateComplete;

    if (
      !this._apexChart &&
      this.shadowRoot &&
      this._config &&
      this.shadowRoot.querySelector("#graph")
    ) {
      this._loaded = true;
      const graph = this.shadowRoot.querySelector("#graph");
      this._apexChart = new ApexCharts(
        graph,
        getLayoutConfig(this._config, this._series),
      );
      this._apexChart.render();
    }
  }

  private _computeYAxisAutoMinMax(yAxis: ChartCardSeriesYAxisConfig) {
    if (
      yAxis.min_type !== MinMaxType.FIXED ||
      yAxis.max_type !== MinMaxType.FIXED
    ) {
      const minMax = this._series
        .map((s) => {
          return {
            min: s.minPoint[1],
            max: s.maxPoint[1],
          };
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
      if (yAxis.align_to !== undefined) {
        if (minMax.min !== null && yAxis.min_type !== MinMaxType.FIXED) {
          if (minMax.min % yAxis.align_to !== 0) {
            minMax.min =
              minMax.min >= 0
                ? minMax.min - (minMax.min % yAxis.align_to)
                : -(
                    yAxis.align_to +
                    (minMax.min % yAxis.align_to) -
                    minMax.min
                  );
          }
        }
        if (minMax.max !== null && yAxis.max_type !== MinMaxType.FIXED) {
          if (minMax.max % yAxis.align_to !== 0) {
            minMax.max =
              minMax.max >= 0
                ? yAxis.align_to - (minMax.max % yAxis.align_to) + minMax.max
                : (minMax.max % yAxis.align_to) - minMax.max;
          }
        }
      }

      if (minMax.min !== null && yAxis.min_type !== MinMaxType.FIXED) {
        yAxis.min = this._getMinMaxBasedOnType(
          true,
          minMax.min,
          yAxis.min_value as number,
          yAxis.min_type,
        );
      }
      if (minMax.max !== null && yAxis.max_type !== MinMaxType.FIXED) {
        yAxis.max = this._getMinMaxBasedOnType(
          false,
          minMax.max,
          yAxis.max_value as number,
          yAxis.max_type,
        );
      }
    }
  }

  private _getMinMaxBasedOnType(
    isMin: boolean,
    value: number,
    configMinMax: number,
    type: MinMaxType,
  ): number {
    switch (type) {
      case MinMaxType.AUTO:
        return value;
      case MinMaxType.SOFT:
        if (
          (isMin && value > configMinMax) ||
          (!isMin && value < configMinMax)
        ) {
          return configMinMax;
        } else {
          return value;
        }
      case MinMaxType.ABSOLUTE:
        return value + configMinMax;
      default:
        return value;
    }
  }

  private _getTypeOfMinMax(
    value?: "auto" | number | string,
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
        throw new Error(`Bad yaxis min/max format: ${value}`);
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
    throw new Error(`Bad yaxis min/max format: ${value}`);
  }

  public getCardSize(): number {
    return 3;
  }
}

// Configure the preview in the Lovelace card picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards = (window as any).customCards || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards.push({
  type: "apexcharts-card",
  name: "ApexCharts Card",
  preview: true,
  description: "A graph card based on ApexCharts",
});
