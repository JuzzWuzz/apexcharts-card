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
  ChartCardYAxisConfig,
  DataPoint,
  DataTypeMap,
  MinMaxPoint,
  MinMaxType,
} from "./types";
import * as pjson from "../package.json";
import {
  formatApexDate,
  formatValueAndUom,
  getDataTypeConfig,
  getDefaultDataTypeConfig,
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
import {
  ChartCardAllYAxisConfigExternal,
  ChartCardConfigExternal,
  ChartCardYAxisConfigExternal,
} from "./types-config";
import exportedTypeSuite from "./types-config-ti";
import {
  DEFAULT_DATA,
  DEFAULT_DATA_TYPE_ID,
  DEFAULT_FLOAT_PRECISION,
  DEFAULT_UPDATE_DELAY,
  DEFAULT_Y_AXIS_ID,
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
  private _dataTypeMap: DataTypeMap = new Map();

  @property({ attribute: false })
  private _series: ChartCardSeries[] = [];

  @property({ attribute: false })
  private _yaxis: ChartCardYAxisConfig[] = [];

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

      // console.log("##########");
      // console.log("CONFIG:");
      // console.log(this._config);
      // console.log(JSON.stringify(this._config));
      // console.log("##########");
      // console.log();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `/// apexcharts-card version ${pjson.version} /// ${e.message}`,
      );
    }
  }

  private generateYAxes(
    conf: ChartCardConfig,
    multiYAxis: boolean,
  ): ChartCardYAxisConfig[] {
    const yAxes = conf.yAxes ?? [];
    return yAxes.map((yaxis, index) => {
      if (yaxis.id === DEFAULT_Y_AXIS_ID) {
        throw Error(
          `Cannot use '${DEFAULT_Y_AXIS_ID}' for the Y-Axis ID as its reserved by the system`,
        );
      }
      const yaxisConfig: ChartCardYAxisConfig = mergeDeep(
        {
          multiYAxis: multiYAxis,
          index: index,
          id: DEFAULT_Y_AXIS_ID,
          float_precision: DEFAULT_FLOAT_PRECISION,
          min_type: MinMaxType.AUTO,
          max_type: MinMaxType.AUTO,
        },
        conf.all_yaxis_config,
        yaxis,
      );

      // Validate the DataTypeID if supplied
      const dataTypeId = yaxisConfig.dataTypeId;
      if (dataTypeId !== undefined && !this._dataTypeMap.has(dataTypeId)) {
        throw Error(
          `Data Type '${dataTypeId}' requested but not found in config`,
        );
      }

      // Set Min/Max values
      [
        yaxisConfig.min_value,
        yaxisConfig.min_type,
      ] = this._getTypeOfMinMax(yaxisConfig.min_value);
      [
        yaxisConfig.max_value,
        yaxisConfig.max_type,
      ] = this._getTypeOfMinMax(yaxisConfig.max_value);

      return yaxisConfig;
    });
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
      const graphColors = conf.color_list || DEFAULT_COLORS;

      // Build up the map of DataTypes based on the array
      conf.dataTypes?.forEach((dataType) => {
        if (dataType.id === DEFAULT_DATA_TYPE_ID) {
          throw Error(
            `Cannot use '${DEFAULT_DATA_TYPE_ID}' for the Data Type ID as its reserved by the system`,
          );
        }
        const dataTypeConfig = mergeDeep(getDefaultDataTypeConfig(), dataType);
        this._dataTypeMap.set(dataType.id, dataTypeConfig);
      });
      // console.log("##########");
      // console.log("Data Types:");
      // console.log(this._dataTypeMap);

      // Init the basics of the Y-Axis
      const multiYAxis = (conf.yAxes?.length ?? 1) > 1;
      this._yaxis = this.generateYAxes(conf, multiYAxis);

      console.log("##########");
      console.log("Pre-Series Y-Axis:");
      console.log(this._yaxis);

      // Do Series Config load
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
                show: {
                  legend_value: true,
                  legend_function: "last",
                  in_chart: true,
                  in_header: true,
                  name_in_header: true,
                },
                yAxisIndex: -1,
                index: index,
              },
              conf.all_series_config,
              series.config,
            );
            // Set the series chart type
            seriesConfig.type = conf.chart_type
              ? undefined
              : seriesConfig.type || DEFAULT_SERIE_TYPE;

            // console.log("##########");
            // console.log("Series Config:");
            // console.log(seriesConfig);

            /**
             * Figure out the Y-Axis
             */
            console.log("##########");
            console.log("Series Y-Axis Config:");
            const yAxisId = seriesConfig.yAxisId ?? index.toString();
            console.log(`Requesting Y-Axis: '${yAxisId}'`);
            const yAxis = this._yaxis.find((yAxis) => yAxis.id === yAxisId);
            if (yAxis === undefined) {
              throw Error(
                `Requested Y-Axis ID '${yAxisId}', that does not exist`,
              );
            }
            seriesConfig.yAxisIndex = yAxis.index;
            console.log("Final Y-Axis:");
            console.log(this._yaxis);

            /**
             * Load the series data
             */
            const seriesData: Array<DataPoint> = series.data ?? DEFAULT_DATA;
            const seriesMinMax: MinMaxPoint = seriesData.reduce(
              (acc: MinMaxPoint, cur: DataPoint) => {
                if (
                  cur[1] !== null &&
                  (acc.min[1] === null || cur[1] < acc.min[1])
                ) {
                  acc.min = cur;
                }
                if (
                  cur[1] !== null &&
                  (acc.max[1] === null || cur[1] > acc.max[1])
                ) {
                  acc.max = cur;
                }
                return acc;
              },
              {
                min: [
                  0,
                  null,
                ],
                max: [
                  0,
                  null,
                ],
              },
            );

            // console.log("##########");
            // console.log("Series Min & Max:");
            // console.log(seriesMinMax);

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

            // console.log("##########");
            // console.log("Series Header Value");
            // console.log(seriesHeaderValue);

            /**
             * Load the series color
             */
            const seriesColor =
              seriesConfig.color ?? graphColors[index % graphColors.length];

            // console.log("##########");
            // console.log("Series Color:");
            // console.log(seriesColor);

            // console.log("##########");

            return {
              config: seriesConfig,
              data: seriesData,
              minMaxPoint: seriesMinMax,
              headerValue: seriesHeaderValue,
              color: seriesColor,
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
        getLayoutConfig(
          conf,
          this._dataTypeMap,
          this._series,
          this._yaxis,
          now,
          start,
          end,
        ),
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
        const formatted = formatValueAndUom(
          s.headerValue,
          getDataTypeConfig(this._dataTypeMap, s.config.dataTypeId),
        );
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
        getLayoutConfig(this._config, this._dataTypeMap),
      );
      this._apexChart.render();
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
