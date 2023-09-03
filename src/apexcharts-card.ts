import {
  LitElement,
  html,
  TemplateResult,
  PropertyValues,
  CSSResultGroup,
} from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import { StyleInfo, styleMap } from "lit/directives/style-map.js";
import moment, { Moment } from "moment";
import {
  ChartCardConfig,
  ChartCardSeries,
  ChartCardYAxisConfig,
  DataTypeMap,
} from "./types";
import * as pjson from "../package.json";
import {
  calculateNewDates,
  formatApexDate,
  formatValueAndUom,
  generateBaseConfig,
  generateDataTypeMap,
  generateSeries,
  generateYAxes,
  getDataTypeConfig,
  getDateRangeLabel,
  getHeaderStateFunctionLabel,
  getLovelace,
  getPeriodDuration,
  getPeriodLabel,
  getResolutionLabel,
  getResolutionsForPeriod,
  mergeConfigTemplates,
  mergeDeep,
} from "./utils";
import ApexCharts from "apexcharts";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import { ChartCardConfigExternal, Period, Resolution } from "./types-config";
import { HomeAssistant, LovelaceCard } from "juzz-ha-helper";
import { mdiArrowLeft, mdiArrowRight, mdiReload } from "@mdi/js";

/* eslint no-console: 0 */
console.info(
  `%c APEXCHARTS-CARD %c v${pjson.version} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ApexCharts = ApexCharts;

@customElement("apexcharts-card2")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ChartsCard extends LitElement {
  private _apexChart?: ApexCharts;

  private _updating = false;
  private _error?: string;

  private _hass?: HomeAssistant;
  private _entity?: HassEntity;

  // Config variables
  @state() private _config?: ChartCardConfig;
  private _dataTypeMap: DataTypeMap = new Map();
  private _yaxis: ChartCardYAxisConfig[] = [];
  private _series: ChartCardSeries[] = [];

  // Time variables
  private _refreshTimer?: number;
  @state() private _date?: Moment;
  @state() private _lastUpdated: Date = new Date();
  private _viewingLiveData = true;

  // Graph display variables
  private _startDate?: Moment;
  private _endDate?: Moment;
  @state() private _period: Period = Period.TWO_DAY;
  @state() private _resolution: Resolution = Resolution.THIRTY_MINUTES;

  /**
   * Invoked when the component is added to the document's DOM.
   */
  public connectedCallback() {
    super.connectedCallback();

    if (this._config && this._hass) {
      if (this._apexChart) {
        window.requestAnimationFrame(() => {
          this._updateData();
        });

        this.initTimer();
      } else {
        this._initialLoad();
      }
    }
  }

  /**
   * Invoked when the component is removed from the document's DOM.
   */
  disconnectedCallback() {
    super.disconnectedCallback();

    this._updating = false;
    this.cancelTimer();
  }

  private initTimer(): void {
    console.log("initTimer()");

    if (this._config && this._hass && !this._refreshTimer) {
      this._pickToday();
      this._refreshTimer = setInterval(() => {
        this._refresh();
      }, this._config.autoRefreshTime * 1000);
    }
  }

  private cancelTimer(): void {
    clearInterval(this._refreshTimer);
    this._refreshTimer = undefined;
  }

  private async _initialLoad() {
    if (
      this._config &&
      !this._apexChart &&
      this.shadowRoot?.querySelector("#graph")
    ) {
      const graph = this.shadowRoot.querySelector("#graph");
      const layout = getLayoutConfig(this._config, this._dataTypeMap);
      this._apexChart = new ApexCharts(
        graph,
        mergeDeep(layout, { chart: { height: "300px" } }),
      );
      this._apexChart.render();

      // Restore the last used config if configured
      if (this._config.rememberOptions) {
        const lastPeriod = this._entity?.attributes?.period;
        const lastResolution = this._entity?.attributes?.resolution;
        if (lastPeriod && lastResolution) {
          const supportedResolutions = getResolutionsForPeriod(lastPeriod);
          if (supportedResolutions.includes(lastResolution)) {
            this._period = lastPeriod;
            this._resolution = lastResolution;
          }
        }
      }

      // Refresh the data
      this._refresh();

      // Update the graph data
      this._updateData();

      // Init the timer
      this.initTimer();
    }
  }

  /**
   * Called whenever the HASS object changes
   * This is done often when states change
   */
  public set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (!this._config || !hass) return;

    // Update the graph entity if it has changed
    const entityState = hass.states[this._config.entity];
    if (entityState && this._entity !== entityState) {
      this._entity = entityState;
      this._updateData();
    }
  }

  /**
   * Sets the config for the card
   */
  public setConfig(config: ChartCardConfigExternal) {

    let configDup: ChartCardConfigExternal = JSON.parse(JSON.stringify(config));
    if (configDup.configTemplates) {
      configDup.configTemplates =
        configDup.configTemplates && Array.isArray(configDup.configTemplates)
          ? configDup.configTemplates
          : [configDup.configTemplates];
      configDup = mergeConfigTemplates(getLovelace(), configDup);
    }
    try {
      // Generate the base config
      const conf = generateBaseConfig(configDup);

      // Set the time data
      this._updatePeriod(conf.period);

      // Now update the config
      this._config = conf;

      /**
       * Compute the DataType Map
       */
      this._dataTypeMap = generateDataTypeMap(this._config);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this._error = error.message;
      console.error(
        `/// apexcharts-card version ${pjson.version} /// ${this._error}`,
      );
    }
  }

  /**
   * Called to determine whether an update cycle is required.
   * Use the entity item to check if the `changedProps` contains our element and return `true`
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._config) {
      return false;
    }

    // Check if the entity we are tracking has changed
    const oldHass = changedProps.get("_hass") as HomeAssistant | undefined;
    if (oldHass && this._hass) {
      // Check if the main graph entity has changed
      const entityId = this._config.entity;
      if (oldHass.states[entityId] !== this._hass.states[entityId]) {
        this._updateData();
      }
    }

    // If we have not yet initialised
    if (!this._apexChart) {
      return true;
    }

    // Only update on specific changes
    if (
      [
        "_config",
        "_date",
        "_lastUpdated",
        "_period",
        "_resolution",
      ].some((key) => changedProps.has(key))
    ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Called whenever the component’s update finishes and the element's DOM has been updated and rendered.
   */
  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    // We have rendered but not yet initialised
    if (this._config && !this._apexChart && this.isConnected) {
      this._initialLoad();
    }
  }

  private async _updateData() {
    console.log(
      `_updateData(): ${
        !this._config || !this._apexChart || !this._entity || this._updating
          ? "skipping"
          : "running"
      }`,
    );

    if (!this._config || !this._apexChart || !this._entity || this._updating) {
      return;
    }

    this._updating = true;
    const now = new Date();

    try {
      /**
       * Compute the time range
       */
      const start = new Date(this._entity.attributes.timeStart);
      const end = new Date(this._entity.attributes.timeEnd);


      /**
       * Compute the Y-Axes
       */
      this._yaxis = generateYAxes(this._config, this._dataTypeMap);

      /**
       * Compute the Series
       */
      this._series = generateSeries(this._config, this._yaxis, this._entity);

      this._apexChart?.updateOptions(
        getLayoutConfig(
          this._config,
          this._dataTypeMap,
          this._series,
          this._yaxis,
          now,
          start,
          end,
          this._period,
        ),
        false,
        false,
      );

      /**
       * Reset the error now
       */
      this._error = undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this._error = error.message;
      console.error(
        `/// apexcharts-card version ${pjson.version} /// ${this._error}`,
      );
    }
    this._lastUpdated = now;
    this._updating = false;
  }

  static get styles(): CSSResultGroup {
    return stylesApex;
  }

  /**
   * Render the card
   */
  protected render(): TemplateResult {
    if (this._error !== undefined) {
      const errorCard = document.createElement(
        "hui-error-card",
      ) as LovelaceCard;
      errorCard.setConfig({
        type: "error",
        error: this._error,
      });
      return html`${errorCard}`;
    }

    const spinnerClass: ClassInfo = {
      "lds-ring":
        this._config && this._config.show.loading && this._updating
          ? true
          : false,
    };

    return html`
      <ha-card>
        <div class="card-content">
          ${this._renderTitle()} ${this._renderDateSelector()}
          ${this._renderControls()}
          <div id="spinner-wrapper">
            <div id="spinner" class=${classMap(spinnerClass)}></div>
          </div>
          ${this._renderStates()}
          <div id="graph"></div>
          ${this._renderLastUpdated()}
        </div>
      </ha-card>
    `;
  }

  private _renderTitle(): TemplateResult {
    if (
      !this._config ||
      !this._config.header.show ||
      !this._config.header?.title
    ) {
      return html``;
    }
    return html`<div id="header__title">
      <span>${this._config.header.title}</span>
    </div>`;
  }

  private _renderDateSelector(): TemplateResult {
    if (
      !this._config ||
      !this._startDate ||
      !this._endDate ||
      !this._config.showDateSelector
    ) {
      return html``;
    }

    return html`
      <div id="date-selector">
        <div id="date">
          ${getDateRangeLabel(this._startDate, this._endDate, this._period)}
        </div>
        <mwc-button dense outlined @click=${this._pickToday}>
          Today
        </mwc-button>
        <ha-icon-button
          .path=${mdiArrowLeft}
          @click=${this._pickPrevious}
        ></ha-icon-button>
        <ha-icon-button
          .path=${mdiArrowRight}
          @click=${this._pickNext}
        ></ha-icon-button>
        <ha-icon-button
          .path=${mdiReload}
          @click=${this._refresh}
        ></ha-icon-button>
      </div>
    `;
  }

  private _renderControls(): TemplateResult {
    if (
      !this._config ||
      !this._startDate ||
      !this._endDate ||
      !this._config.showDateSelector
    ) {
      return html``;
    }

    return html`
      <div id="graph-controls">
        <ha-select
          .label=${"Period"}
          .value=${this._period}
          @selected=${this._pickPeriod}
        >
          ${Object.values(Period)
            .filter(
              (p) =>
                ![
                  Period.WEEK,
                  Period.MONTH,
                ].includes(p),
            )
            .map(
              (period) =>
                html`<mwc-list-item .value=${period}
                  >${getPeriodLabel(period)}</mwc-list-item
                >`,
            )}</ha-select
        >
        <ha-select
          .label=${"Resolution"}
          .value=${this._resolution}
          @selected=${this._pickResolution}
        >
          ${getResolutionsForPeriod(this._period).map((resolution) => {
            if (resolution === this._resolution) {
              return html` <mwc-list-item
                .value=${resolution}
                aria-selected="true"
                selected
                activated
              >
                ${getResolutionLabel(resolution)}</mwc-list-item
              >`;
            } else {
              return html` <mwc-list-item
                .value=${resolution}
                aria-selected="false"
              >
                ${getResolutionLabel(resolution)}</mwc-list-item
              >`;
            }
          })}</ha-select
        >
      </div>
    `;
  }

  private _renderStates(): TemplateResult {
    if (
      !this._config ||
      !this._config.header.show ||
      !this._config.header.showStates
    ) {
      return html``;
    }
    const conf = this._config;
    const seriesStates = this._series
      .filter((s) => s.config.show.inHeader)
      .map((s) => {
        const formatted = formatValueAndUom(
          s.headerValue,
          getDataTypeConfig(this._dataTypeMap, s.config.dataTypeId),
        );
        const styles: StyleInfo = {
          color: conf.header.colorizeStates ? s.color : "",
        };
        return html`
          <div id="states__state">
            <div id="state__value">
              <span id="state" style=${styleMap(styles)}>
                ${formatted.value}
              </span>
              <span id="uom">${formatted.unitOfMeasurement}</span>
              <span id="function"
                >(${getHeaderStateFunctionLabel(
                  s.config.show.legendFunction,
                )})</span
              >
            </div>
            ${s.config.show.nameInHeader
              ? html`<div id="state__name">${s.config.name ?? ""}</div>`
              : html``}
          </div>
        `;
      });
    return html`<div id="header__states">${seriesStates}</div>`;
  }

  private _renderLastUpdated(): TemplateResult {
    if (!this._config || !this._config.show.lastUpdated) {
      return html``;
    }
    return html`
      <div id="lastUpdated">${formatApexDate(this._lastUpdated)}</div>
    `;
  }

  public getCardSize(): number {
    return 3;
  }

  /**
   * Button clicking functions
   */

  /**
   * Update the Start & End date values and call for an update
   */
  private _triggerUpdate(): void {
    if (!this._date) return;

    const newDates = calculateNewDates(
      this._date,
      this._period,
      this._resolution,
    );
    this._startDate = newDates.startDate;
    this._endDate = newDates.endDate;

    // Update the graphs
    this.callService();
  }

  private _updateDate(date: moment.Moment) {
    console.log(
      `updateDate(): ${this._date === date ? "skipping" : "running"}`,
    );

    // If the chosen date is the same, skip the update
    if (this._date === date) {
      return;
    }

    // Update the date
    this._date = date;

    // Trigger an update
    this._triggerUpdate();
  }

  /**
   * Update the period being observed
   * @param period
   */
  private _updatePeriod(period: Period) {
    console.log("_updatePeriod()");

    // Update the period
    this._period = period;

    // Get the resolutions supported by this period
    const supportedResolutions = getResolutionsForPeriod(this._period);

    /**
     * Grab the last resolution (coarsest) if one is not definend or the one defined is not in the supported list
     * If we are updating the resolution, that function will call a refresh
     * Otherwise call for a refresh
     */
    if (!supportedResolutions.includes(this._resolution)) {
      this._updateResolution(supportedResolutions.pop());
    } else {
      this._refresh();
    }
  }

  /**
   * Update the resolution being observed
   * @param resolution
   */
  private _updateResolution(resolution?: Resolution) {
    console.log("_updateResolution()");

    // Ensure that the resolution is not undefined
    if (!resolution) {
      return;
    }

    // Get the resolutions supported by this period
    const supportedResolutions = getResolutionsForPeriod(this._period);

    // Make sure that resolution is in the supported set
    if (!supportedResolutions.includes(resolution)) {
      return;
    }

    // Update the resolution
    this._resolution = resolution;

    // Refresh the data
    this._refresh();
  }

  /**
   * Handle the `Next` button being pressed (Advance the day)
   */
  private _pickNext(): void {
    if (!this._date) return;

    const currentTime = moment();
    const duration = getPeriodDuration(this._period);
    const newDate = this._date.clone().add(duration);
    console.log(
      `New Date: ${newDate.toISOString()}... ${newDate.isAfter(currentTime)}`,
    );

    if (newDate.isAfter(currentTime)) {
      this._viewingLiveData = false;
      this._updateDate(currentTime);
    } else {
      this._updateDate(newDate);
    }
  }

  /**
   * Handle the `Previous` button being pressed (Recede the day)
   */
  private _pickPrevious(): void {
    if (!this._date) return;
    const duration = getPeriodDuration(this._period);
    const newDate = this._date.clone().subtract(duration);
    this._viewingLiveData = false;

    this._updateDate(newDate);
  }

  /**
   * Set the date to the time right now
   */
  private _pickToday(): void {
    this._viewingLiveData = true;
    this._updateDate(moment());
  }

  /**
   * Change the period of viewing
   */
  private _pickPeriod(ev): void {
    if (ev.target.value === this._period) return;
    this._updatePeriod(ev.target.value);
  }

  /**
   * Change the resolution of viewing
   */
  private _pickResolution(ev): void {
    if (ev.target.value === this._resolution) return;
    this._updateResolution(ev.target.value);
  }

  /**
   * Refresh the graph data. Either auto or manual
   */
  private _refresh(): void {
    const currentTime = moment();
    console.log(
      `_refresh(): ${this._endDate?.toISOString()} -- ${currentTime.toISOString()}. ${
        this._viewingLiveData
      }`,
    );

    if (this._viewingLiveData && currentTime.isAfter(this._endDate)) {
      this._updateDate(currentTime);
    } else {
      this._triggerUpdate();
    }
  }

  /**
   * Service Calls
   */

  /**
   * Call the service to change graph data
   */
  private callService(): void {
    console.log(
      `--------------------------callService(): ${
        !this._config || !this._hass || !this._startDate || !this._endDate
          ? "skipping"
          : "running"
      }`,
    );

    if (!this._config || !this._hass || !this._startDate || !this._endDate) {
      return;
    }

    this._hass.callService("mqtt", "publish", {
      topic: `graphs2/${this._config.entity}`,
      payload: JSON.stringify({
        period: this._period,
        resolution: this._resolution,
        timeStart: this._startDate.toISOString(),
        timeEnd: this._endDate.toISOString(),
        series: this._series.map((series) => {
          return {
            index: series.config.index,
            measurement: series.config.measurement,
            device: series.config.device,
            channel: series.config.channel,
          };
        }),
      }),
    });
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
