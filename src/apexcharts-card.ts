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
  formatApexDate,
  formatValueAndUom,
  generateBaseConfig,
  generateDataTypeMap,
  generateSeries,
  generateYAxes,
  getDataTypeConfig,
  getLovelace,
  mergeConfigTemplates,
  mergeDeep,
} from "./utils";
import ApexCharts from "apexcharts";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import { ChartCardConfigExternal, Periods } from "./types-config";
import { HomeAssistant, LovelaceCard } from "juzz-ha-helper";

/* eslint no-console: 0 */
console.info(
  `%c APEXCHARTS-CARD %c v${pjson.version} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ApexCharts = ApexCharts;

@customElement("apexcharts-card")
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ChartsCard extends LitElement {
  private _apexChart?: ApexCharts;

  private _updating = false;
  private _error?: string;

  private _hass?: HomeAssistant;
  private _entity?: HassEntity;

  @state() private _config?: ChartCardConfig;
  private _dataTypeMap: DataTypeMap = new Map();
  private _yaxis: ChartCardYAxisConfig[] = [];
  private _series: ChartCardSeries[] = [];

  @state() private _lastUpdated: Date = new Date();

  // Time Controls
  private _refreshTimer?: number;
  private _date?: Moment;
  private _startDate?: Moment;
  private _endDate?: Moment;
  private _period?: Periods;
  private _resolution?: "PT1M" | "PT5M" | "PT15M" | "PT30M" | "P1D" | "P1M";

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
    if (this._config && this._hass && !this._refreshTimer) {
      this._pickToday();
      this._refreshTimer = setInterval(() => {
        this.callServiceRefresh();
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

      this._updateData();

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

    const entityState = hass.states[this._config.entity];
    if (entityState === undefined) {
      return;
    }
    if (this._entity !== entityState) {
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
      this._period = conf.period;

      // Now update the config
      this._config = conf;

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
    const entityId = this._config.entity;
    const oldHass = changedProps.get("_hass") as HomeAssistant | undefined;
    if (
      oldHass &&
      this._hass &&
      oldHass.states[entityId] !== this._hass.states[entityId]
    ) {
      this._updateData();
    }

    // If we have not yet initialised
    if (this._config && !this._apexChart) {
      return true;
    }

    // Only update on specific changes
    if (
      [
        "_config",
        "_lastUpdated",
      ].some((key) => changedProps.has(key)) &&
      this._config &&
      this._apexChart
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
    if (!this._config || !this._apexChart || !this._entity || this._updating) {
      return;
    }

    this._updating = true;
    const now = new Date();

    try {
      /**
       * Compute the time range
       */
      const start = new Date(this._entity.attributes.start);
      const end = new Date(this._entity.attributes.end);

      /**
       * Compute the DataType Map
       */
      this._dataTypeMap = generateDataTypeMap(this._config);

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
      <div id="time-selector">
        <div id="date" class="lol">
          ${this._period === Periods.DAY
            ? this._startDate.format("D MMMM YYYY")
            : this._period === Periods.MONTH
            ? this._startDate.format("MMMM YYYY")
            : `${this._startDate.format("D MMM")} -
                  ${this._endDate.format("D MMM")}
                  `}
        </div>
        <ha-icon-button-prev @click=${this._pickPrevious}></ha-icon-button-prev>
        <ha-icon-button-next @click=${this._pickNext}></ha-icon-button-next>
        <mwc-button class="lol" dense outlined @click=${this._pickToday}>
          Today
        </mwc-button>
        <mwc-button dense outlined @click=${this._refresh}>
          Refresh
        </mwc-button>
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
   * Helper to get a duration value to add/subtract a time value
   */
  private _getDuration(): moment.Duration {
    switch (this._period) {
      case Periods.DAY:
      case Periods.TWO_DAY:
        return moment.duration(1, "day");
      case Periods.WEEK:
        return moment.duration(1, "week");
      case Periods.MONTH:
        return moment.duration(1, "month");
      case Periods.YEAR:
        return moment.duration(1, "year");
      default:
        return moment.duration(0, "second");
    }
  }

  /**
   * Update the Start & End date values
   */
  private _updateDates(): void {
    if (!this._date) return;

    switch (this._period) {
      case Periods.DAY:
        this._startDate = this._date.clone().startOf("day");
        this._endDate = this._date.clone().add(1, "day").startOf("day");
        this._resolution = "PT15M";
        break;
      case Periods.TWO_DAY:
        this._startDate = this._date.clone().subtract(1, "day").startOf("day");
        this._endDate = this._date.clone().add(1, "day").startOf("day");
        this._resolution = "PT30M";
        break;
      case Periods.WEEK:
        this._startDate = this._date.clone().startOf("isoWeek");
        this._endDate = this._date.clone().add(1, "week").startOf("isoWeek");
        this._resolution = "P1D";
        break;
      case Periods.MONTH:
        this._startDate = this._date.clone().startOf("month");
        this._endDate = this._date.clone().add(1, "month").startOf("month");
        this._resolution = "P1D";
        break;
      case Periods.YEAR:
        this._startDate = this._date.clone().startOf("month");
        this._endDate = this._date.clone().add(1, "month").startOf("month");
        this._resolution = "P1M";
        break;
    }

    // Update the graphs
    this.callService();
  }

  /**
   * Handle the `Next` button being pressed (Advance the day)
   */
  private _pickNext(): void {
    if (!this._date) return;
    const newDate = this._date.clone().add(this._getDuration());
    if (newDate.isAfter(moment().add(1, "day").startOf("day"))) {
      return;
    }
    this._date = newDate;
    this._updateDates();
  }

  /**
   * Handle the `Previous` button being pressed (Recede the day)
   */
  private _pickPrevious(): void {
    if (!this._date) return;
    this._date = this._date.clone().subtract(this._getDuration());
    this._updateDates();
  }

  /**
   * Set the date to the time right now
   */
  private _pickToday(): void {
    this._date = moment();
    this._updateDates();
  }

  /**
   * Call for a refresh of the existing config on the system
   */
  private _refresh(): void {
    this.callServiceRefresh();
  }

  /**
   * Change the period of viewing
   */
  private _pickPeriod(ev: CustomEvent): void {
    this._period = ev.detail.value;
    this._updateDates();
  }

  /**
   * Service Calls
   */

  /**
   * Call the service to change graph data
   */
  private callService(): void {
    if (
      !this._config ||
      !this._hass ||
      !this._startDate ||
      !this._endDate ||
      !this._resolution
    ) {
      return;
    }

    this._hass.callService("mqtt", "publish", {
      topic: `graphs/${this._config.entity.replace(
        "button.graph_entities_",
        "",
      )}/change`,
      payload: JSON.stringify({
        timeGroup: this._resolution,
        timeStart: this._startDate.toISOString(),
        timeEnd: this._endDate.toISOString(),
      }),
    });
  }

  /**
   * Press the button which refreshes the data
   */
  private callServiceRefresh(): void {
    if (!this._config || !this._hass) {
      return;
    }

    this._hass.callService("button", "press", {
      entity_id: this._config.entity,
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
