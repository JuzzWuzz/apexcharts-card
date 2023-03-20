import {
  LitElement,
  html,
  TemplateResult,
  PropertyValues,
  CSSResultGroup,
} from "lit";
import { property, customElement, eventOptions } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import {
  ChartCardConfig,
  ChartCardSeriesConfig,
  ChartCardYAxis,
  EntityCachePoints,
  HistoryPoint,
  minmax_type,
} from "./types";
import * as pjson from "../package.json";
import {
  computeColor,
  computeColors,
  computeName,
  computeTextColor,
  formatApexDate,
  formatValueAndUom,
  getLovelace,
  log,
  mergeConfigTemplates,
  mergeDeep,
  myFormatNumber,
} from "./utils";
import ApexCharts from "apexcharts";
import { Ripple } from "@material/mwc-ripple";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import GraphEntry from "./graphEntry";
import { createCheckers } from "ts-interface-checker";
import {
  ChartCardExternalConfig,
  ChartCardAllSeriesExternalConfig,
} from "./types-config";
import exportedTypeSuite from "./types-config-ti";
import {
  DEFAULT_FLOAT_PRECISION,
  // DEFAULT_FLOAT_PRECISION,
  DEFAULT_UPDATE_DELAY,
  NO_VALUE,
} from "./const";
import { DEFAULT_COLORS, DEFAULT_SERIE_TYPE } from "./const";
import tinycolor from "@ctrl/tinycolor";
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
  private _seriesConfig: ChartCardSeriesConfig[] = [];

  @property({ attribute: false })
  private _yAxisConfig: ChartCardYAxis[] = [];

  private _graphs: GraphEntry[] = [];

  private _entity?: HassEntity;

  private _colors: string[] = [];

  @property({ attribute: false }) private _headerState: (number | null)[] = [];

  private _dataLoaded = false;

  private _updateDelay: number = DEFAULT_UPDATE_DELAY;

  @property({ attribute: false }) _lastUpdated: Date = new Date();

  @property({ type: Boolean }) private _warning = false;

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
      this._updating = true;
      this._updateData();
    }
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (this._config && this._hass && this.isConnected && !this._loaded) {
      this._initialLoad();
    }
  }

  private _firstDataLoad() {
    if (
      this._updating ||
      this._dataLoaded ||
      !this._apexChart ||
      !this._config ||
      !this._hass
    )
      return;
    this._dataLoaded = true;
    this._updating = true;
    this._updateData();
  }

  public set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (!this._config || !hass) return;

    const entityState = hass.states[this._config.entity];
    if (entityState === undefined) {
      this._warning = true;
      return;
    } else if (this._warning) {
      this._warning = false;
      this._reset();
    }
    if (this._entity !== entityState) {
      this._entity = entityState;
      this.lolConfig();
      if (!this._updating) {
        if (!this._dataLoaded) {
          this._firstDataLoad();
        } else {
          this._updating = true;
          // give time to HA's recorder component to write the data in the history
          setTimeout(() => {
            this._updateData();
          }, this._updateDelay);
        }
      }
    }
  }

  private _reset() {
    if (this._apexChart) {
      this._apexChart.destroy();
      this._apexChart = undefined;
      this._loaded = false;
      this._dataLoaded = false;
      this._updating = false;
    }
    if (this._config && this._hass && !this._loaded) {
      this._initialLoad();
    }
  }

  public setConfig(config: ChartCardExternalConfig) {
    let configDup: ChartCardExternalConfig = JSON.parse(JSON.stringify(config));
    if (configDup.config_templates) {
      configDup.config_templates =
        configDup.config_templates && Array.isArray(configDup.config_templates)
          ? configDup.config_templates
          : [configDup.config_templates];
      configDup = mergeConfigTemplates(getLovelace(), configDup);
      console.log(JSON.stringify(configDup));
    }
    try {
      const { ChartCardExternalConfig } = createCheckers(exportedTypeSuite);
      ChartCardExternalConfig.strictCheck(configDup);

      this._config = mergeDeep(
        {
          useCompress: false,
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
    // Full reset only happens in editor mode
    this._reset();
  }

  private lolConfig() {
    if (!this._config || !this._entity) return;

    try {
      const index = 0;
      const seriesConfig = this._entity.attributes
        .config as ChartCardAllSeriesExternalConfig;

      // Create a combined config
      let mergedSeriesConfig: ChartCardSeriesConfig = mergeDeep(
        {
          index: index,
          extend_to: "end",
          show: {
            legend_value: true,
            legend_function: "last",
            in_chart: true,
            in_header: true,
            name_in_header: true,
          },
        },
        this._config.all_series_config,
      );
      console.log("$$$$$$$$$$$$$$$$$$$$$$$$$");
      console.log(mergeDeep(mergedSeriesConfig));
      mergedSeriesConfig = mergeDeep(mergedSeriesConfig, seriesConfig);
      console.log("----------------------");
      console.log(mergeDeep(mergedSeriesConfig));
      console.log("$$$$$$$$$$$$$$$$$$$$$$$$$");

      console.log(this._config?.chart_type);
      mergedSeriesConfig.type = this._config?.chart_type
        ? undefined
        : mergedSeriesConfig.type || DEFAULT_SERIE_TYPE;

      console.log("##########");
      console.log("Series CONFIG:");
      console.log(mergedSeriesConfig);
      console.log("##########");
      console.log();

      this._seriesConfig = [mergedSeriesConfig];
      this._graphs = [new GraphEntry(index)];

      const defColors = this._config?.color_list || DEFAULT_COLORS;
      this._colors[index] =
        mergedSeriesConfig.color ?? defColors[index % defColors.length];
      this._colors = this._colors.slice(0, this._seriesConfig.length ?? 0);

      this._yAxisConfig = [this._generateYAxisConfig(mergedSeriesConfig)];
      console.log("YAxis Config");
      console.log(mergeDeep(this._yAxisConfig));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `/// apexcharts-card version ${pjson.version} /// ${e.message}`,
      );
    }
    // Full reset only happens in editor mode
    this._reset();
  }

  private _generateYAxisConfig(config: ChartCardSeriesConfig): ChartCardYAxis {
    const yAxis = mergeDeep(config.yaxis);

    // Set Min/Max values
    [
      yAxis.min,
      yAxis.min_type,
    ] = this._getTypeOfMinMax(yAxis.min);
    [
      yAxis.max,
      yAxis.max_type,
    ] = this._getTypeOfMinMax(yAxis.max);

    // Set the formatter
    yAxis.labels_formatter = function (value) {
      return formatValueAndUom(
        value,
        config.clamp_negative,
        config.unit,
        config.unit_step,
        config.unit_array,
        yAxis.decimalsInFloat,
      ).join(config.unit_separator ?? " ");
    };

    return yAxis;
  }

  static get styles(): CSSResultGroup {
    return stylesApex;
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;
    if (this._warning || this._entity === undefined) {
      return this._renderWarnings();
    }

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

  private _renderWarnings(): TemplateResult {
    return html`
      <ha-card class="warning">
        <hui-warning>
          <div style="font-weight: bold;">apexcharts-card</div>
          ${!this._entity
            ? html` <div>Entity not available: ${this._config?.entity}</div> `
            : html``}
        </hui-warning>
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
    return html`<div
      id="header__title"
      class="disabled"
      @focus="${(ev) => {
        this.handleRippleFocus(ev, "title");
      }}"
      @blur="${(ev) => {
        this.handleRippleBlur(ev, "title");
      }}"
      @mousedown="${(ev) => {
        this.handleRippleActivate(ev, "title");
      }}"
      @mouseup="${(ev) => {
        this.handleRippleDeactivate(ev, "title");
      }}"
      @touchstart="${(ev) => {
        this.handleRippleActivate(ev, "title");
      }}"
      @touchend="${(ev) => {
        this.handleRippleDeactivate(ev, "title");
      }}"
      @touchcancel="${(ev) => {
        this.handleRippleDeactivate(ev, "title");
      }}"
    >
      <span>${this._config?.header?.title}</span>
      <mwc-ripple unbounded id="ripple-title"></mwc-ripple>
    </div>`;
  }

  private _renderStates(): TemplateResult {
    return html`
      <div id="header__states">
        ${this._seriesConfig.map((series, index) => {
          if (series.show.in_header) {
            const valueRaw = this._headerState?.[index];
            let value: string | number | null | undefined = valueRaw;
            let uom: string | undefined = undefined;
            [
              value,
              uom,
            ] = formatValueAndUom(
              value,
              series.clamp_negative,
              series.unit,
              series.unit_step,
              series.unit_array,
              series.float_precision,
            );
            return html`
              <div
                id="states__state"
                class="disabled"
                @focus="${(ev) => {
                  this.handleRippleFocus(ev, index);
                }}"
                @blur="${(ev) => {
                  this.handleRippleBlur(ev, index);
                }}"
                @mousedown="${(ev) => {
                  this.handleRippleActivate(ev, index);
                }}"
                @mouseup="${(ev) => {
                  this.handleRippleDeactivate(ev, index);
                }}"
                @touchstart="${(ev) => {
                  this.handleRippleActivate(ev, index);
                }}"
                @touchend="${(ev) => {
                  this.handleRippleDeactivate(ev, index);
                }}"
                @touchcancel="${(ev) => {
                  this.handleRippleDeactivate(ev, index);
                }}"
              >
                <div id="state__value">
                  <span
                    id="state"
                    style="${this._computeHeaderStateColor(series)}"
                    >${valueRaw === 0 ? 0 : value || NO_VALUE}</span
                  >
                  <span id="uom">${uom}</span>
                </div>
                ${series.show.name_in_header
                  ? html`<div id="state__name">
                      ${computeName(index, this._seriesConfig)}
                    </div>`
                  : ""}
                <mwc-ripple unbounded id="ripple-${index}"></mwc-ripple>
              </div>
            `;
          } else {
            return html``;
          }
        })}
      </div>
    `;
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
      const layout = getLayoutConfig(
        this._config,
        this._seriesConfig,
        this._yAxisConfig,
        this._hass,
      );
      this._apexChart = new ApexCharts(graph, layout);
      this._apexChart.render();
      this._firstDataLoad();
    }
  }

  private async _updateData() {
    if (!this._config || !this._apexChart || !this._graphs || !this._entity)
      return;

    const now = new Date();
    this._lastUpdated = now;

    try {
      const start = new Date(this._entity.attributes.start);
      const end = new Date(this._entity.attributes.end);

      // Update the actual graphs data
      this._graphs.map((graph) => {
        graph._updateData(this._entity);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphData: any = { series: [] };
      this._graphs.forEach((graph, index) => {
        if (!graph) return [];
        const inHeader = this._seriesConfig[index].show.in_header;
        if (inHeader) {
          if (inHeader === "after_now" || inHeader === "before_now") {
            // before_now / after_now
            this._headerState[index] = graph.nowValue(
              now.getTime(),
              inHeader === "before_now",
            );
          } else {
            if (this._seriesConfig[index].show.legend_function === "sum") {
              this._headerState[index] = graph.sumStates;
            } else {
              this._headerState[index] = graph.lastState;
            }
          }
        }
        if (!this._seriesConfig[index].show.in_chart) {
          return;
        }
        if (graph.history.length === 0) {
          graphData.series.push({ data: [] });
          return;
        }
        const data: EntityCachePoints = [...graph.history];
        if (
          this._seriesConfig[index].type !== "column" &&
          this._seriesConfig[index].extend_to
        ) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const lastPoint = data.slice(-1)[0]!;
          if (
            this._seriesConfig[index].extend_to === "end" &&
            lastPoint[0] < end.getTime()
          ) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            data.push([
              end.getTime(),
              lastPoint[1],
            ]);
          } else if (
            this._seriesConfig[index].extend_to === "now" &&
            lastPoint[0] < now.getTime()
          ) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            data.push([
              now.getTime(),
              lastPoint[1],
            ]);
          }
        }
        graphData.series.push({ data });
        return;
      });
      graphData.annotations = this._computeAnnotations(start, end, now);
      if (this._yAxisConfig) {
        graphData.yaxis = this._computeYAxisAutoMinMax(start, end);
        console.log("Graph Data.YAxis");
        console.log(graphData.yaxis);
      }
      graphData.xaxis = {
        min: start.getTime(),
        max: end.getTime(),
      };
      graphData.colors = this._computeChartColors();
      this._headerState = [...this._headerState];
      this._apexChart?.updateOptions(graphData, false, false);
    } catch (err) {
      log(err);
    }
    this._updating = false;
  }

  private _computeAnnotations(start: Date, end: Date, now: Date) {
    return {
      ...this._computeMinMaxPointsAnnotations(start, end),
      ...this._computeNowAnnotation(now),
    };
  }

  private _computeMinMaxPointsAnnotations(start: Date, end: Date) {
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    return {
      points: this._seriesConfig.flatMap((series, index) => {
        if (series.show.extremas) {
          const { min, max } = this._graphs[series.index]?.minMaxWithTimestamp(
            start.getTime(),
            end.getTime(),
          ) || {
            min: [
              0,
              null,
            ],
            max: [
              0,
              null,
            ],
          };
          const bgColor = computeColor(this._colors[index]);
          const txtColor = computeTextColor(bgColor);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extremas: any = [];
          if (
            min[0] &&
            [
              "min",
              "min+time",
              true,
              "time",
            ].includes(series.show.extremas)
          ) {
            const withTime =
              series.show.extremas === "time" ||
              series.show.extremas === "min+time";
            extremas.push(
              ...this._getPointAnnotationStyle(
                min,
                bgColor,
                txtColor,
                series,
                index,
                sameDay,
                withTime,
              ),
            );
          }
          if (
            max[0] &&
            [
              "max",
              "max+time",
              true,
              "time",
            ].includes(series.show.extremas)
          ) {
            const withTime =
              series.show.extremas === "time" ||
              series.show.extremas === "max+time";
            extremas.push(
              ...this._getPointAnnotationStyle(
                max,
                bgColor,
                txtColor,
                series,
                index,
                sameDay,
                withTime,
              ),
            );
          }
          return extremas;
        } else {
          return [];
        }
      }),
    };
  }

  private _getPointAnnotationStyle(
    value: HistoryPoint,
    bgColor: string,
    txtColor: string,
    series: ChartCardSeriesConfig,
    index: number,
    sameDay: boolean,
    withTime: boolean,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points: any = [];
    const multiYAxis = this._yAxisConfig.length > 1;
    points.push({
      x: value[0],
      y: value[1],
      seriesIndex: index,
      yAxisIndex: multiYAxis ? index : 0,
      marker: {
        strokeColor: bgColor,
        fillColor: "var(--card-background-color)",
      },
      label: {
        text: myFormatNumber(
          value[1],
          this._hass?.locale,
          series.float_precision,
        ),
        borderColor: "var(--card-background-color)",
        borderWidth: 2,
        style: {
          background: bgColor,
          color: txtColor,
        },
      },
    });
    if (withTime) {
      let bgColorTime = tinycolor(computeColor("var(--card-background-color)"));
      bgColorTime =
        bgColorTime.isValid && bgColorTime.getLuminance() > 0.5
          ? bgColorTime.darken(20)
          : bgColorTime.lighten(20);
      const txtColorTime = computeTextColor(bgColorTime.toHexString());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let options: any = { timeStyle: "medium" };
      if (!sameDay) {
        options.dateStyle = "medium";
      }
      options = {
        ...options,
        ...{ hourCycle: "h23" },
      };
      points.push({
        x: value[0],
        y: value[1],
        seriesIndex: index,
        yAxisIndex: multiYAxis ? index : 0,
        marker: {
          size: 0,
        },
        label: {
          text: `${Intl.DateTimeFormat("en", options).format(value[0])}`,
          borderColor: "var(--card-background-color)",
          offsetY: -22,
          borderWidth: 0,
          style: {
            background: bgColorTime.toHexString(),
            color: txtColorTime,
            fontSize: "8px",
            fontWeight: 200,
          },
        },
      });
    }
    return points;
  }

  private _computeNowAnnotation(now: Date) {
    if (this._config?.now?.show) {
      const color = computeColor(
        this._config.now.color || "var(--primary-color)",
      );
      const textColor = computeTextColor(color);
      return {
        xaxis: [
          {
            x: now.getTime(),
            strokeDashArray: 3,
            label: {
              text: this._config.now.label,
              borderColor: color,
              style: {
                color: textColor,
                background: color,
              },
            },
            borderColor: color,
          },
        ],
      };
    }
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _computeYAxisAutoMinMax(start: Date, end: Date) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    this._yAxisConfig.map((yaxis) => {
      if (
        yaxis.min_type !== minmax_type.FIXED ||
        yaxis.max_type !== minmax_type.FIXED
      ) {
        const minMax = this._graphs.map((graph) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const lMinMax = graph.minMaxWithTimestampForYAxis(
            start.getTime(),
            end.getTime(),
          );
          return lMinMax;
        });
        let min: number | null = null;
        let max: number | null = null;
        minMax?.forEach((elt) => {
          if (!elt) return;
          if (min === undefined || min === null) {
            min = elt.min[1];
          } else if (elt.min[1] !== null && min > elt.min[1]) {
            min = elt.min[1];
          }
          if (max === undefined || max === null) {
            max = elt.max[1];
          } else if (elt.max[1] !== null && max < elt.max[1]) {
            max = elt.max[1];
          }
        });
        if (yaxis.align_to !== undefined) {
          if (min !== null && yaxis.min_type !== minmax_type.FIXED) {
            if (min % yaxis.align_to !== 0) {
              min =
                min >= 0
                  ? min - (min % yaxis.align_to)
                  : -(yaxis.align_to + (min % yaxis.align_to) - min);
            }
          }
          if (max !== null && yaxis.max_type !== minmax_type.FIXED) {
            if (max % yaxis.align_to !== 0) {
              max =
                max >= 0
                  ? yaxis.align_to - (max % yaxis.align_to) + max
                  : (max % yaxis.align_to) - max;
            }
          }
        }

        if (min !== null && yaxis.min_type !== minmax_type.FIXED) {
          yaxis.min = this._getMinMaxBasedOnType(
            true,
            min,
            yaxis.min as number,
            yaxis.min_type,
          );
        }
        if (max !== null && yaxis.max_type !== minmax_type.FIXED) {
          yaxis.max = this._getMinMaxBasedOnType(
            false,
            max,
            yaxis.max as number,
            yaxis.max_type,
          );
        }
      }
    });

    return this._yAxisConfig.map((yAxis) => {
      // Construct the ApexConfig and remove items not permitted
      const apexConfig = mergeDeep(yAxis.apex_config);
      delete apexConfig.min;
      delete apexConfig.max;
      delete apexConfig.decimalsInFloat;

      const mergedConfig = mergeDeep(
        {
          decimalsInFloat: yAxis?.decimals ?? DEFAULT_FLOAT_PRECISION,
          labels: {
            formatter: yAxis.label_formatter,
          },
        },
        yAxis,
        apexConfig,
      );
      delete mergedConfig.align_to;
      delete mergedConfig.apex_config;
      delete mergedConfig.decimals;
      delete mergedConfig.min_type;
      delete mergedConfig.max_type;
      delete mergedConfig.label_formatter;

      return mergedConfig as ApexYAxis;
    });
  }

  private _getMinMaxBasedOnType(
    isMin: boolean,
    value: number,
    configMinMax: number,
    type: minmax_type,
  ): number {
    switch (type) {
      case minmax_type.AUTO:
        return value;
      case minmax_type.SOFT:
        if (
          (isMin && value > configMinMax) ||
          (!isMin && value < configMinMax)
        ) {
          return configMinMax;
        } else {
          return value;
        }
      case minmax_type.ABSOLUTE:
        return value + configMinMax;
      default:
        return value;
    }
  }

  private _getTypeOfMinMax(
    value?: "auto" | number | string,
  ): [number | undefined, minmax_type] {
    const regexFloat = /[+-]?\d+(\.\d+)?/g;
    if (typeof value === "number") {
      return [
        value,
        minmax_type.FIXED,
      ];
    } else if (value === undefined || value === "auto") {
      return [
        undefined,
        minmax_type.AUTO,
      ];
    }
    if (typeof value === "string" && value !== "auto") {
      const matched = value.match(regexFloat);
      if (!matched || matched.length !== 1) {
        throw new Error(`Bad yaxis min/max format: ${value}`);
      }
      const floatValue = parseFloat(matched[0]);
      if (value.startsWith("~")) {
        return [
          floatValue,
          minmax_type.SOFT,
        ];
      } else if (value.startsWith("|") && value.endsWith("|")) {
        return [
          floatValue,
          minmax_type.ABSOLUTE,
        ];
      }
    }
    throw new Error(`Bad yaxis min/max format: ${value}`);
  }

  private _computeChartColors(): (string | (({ value }) => string))[] {
    const defaultColors: (string | (({ value }) => string))[] = computeColors(
      this._colors,
    );
    return defaultColors.slice(0, this._seriesConfig.length);
  }

  private _computeHeaderStateColor(series: ChartCardSeriesConfig): string {
    return this._config?.header?.colorize_states &&
      this._colors &&
      this._colors.length > 0
      ? `color: ${this._colors[series.index]};`
      : "";
  }

  // backward compatibility
  @eventOptions({ passive: true })
  private handleRippleActivate(evt: Event, index: number | string): void {
    const r = this.shadowRoot?.getElementById(`ripple-${index}`) as Ripple;
    r && typeof r.startFocus === "function" && r.startPress(evt);
  }

  private handleRippleDeactivate(_, index: number | string): void {
    const r = this.shadowRoot?.getElementById(`ripple-${index}`) as Ripple;
    r && typeof r.startFocus === "function" && r.endPress();
  }

  private handleRippleFocus(_, index: number | string): void {
    const r = this.shadowRoot?.getElementById(`ripple-${index}`) as Ripple;
    r && typeof r.startFocus === "function" && r.startFocus();
  }

  private handleRippleBlur(_, index: number | string): void {
    const r = this.shadowRoot?.getElementById(`ripple-${index}`) as Ripple;
    r && typeof r.startFocus === "function" && r.endFocus();
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
