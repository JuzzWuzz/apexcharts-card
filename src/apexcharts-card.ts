import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import { StyleInfo, styleMap } from "lit/directives/style-map.js";
import moment, { Moment } from "moment";
import { CardConfig, CardSeries } from "./types";
import * as pjson from "../package.json";
import {
  calculateNewDates,
  formatApexDate,
  formatValueAndUom,
  generateBaseConfig,
  generateSeries,
  generateSeriesSets,
  getDateRangeLabel,
  getHeaderStateFunctionLabel,
  getLovelace,
  getPeriodDuration,
  getPeriodLabel,
  getResolutionLabel,
  getResolutionsForPeriod,
  isDateValid,
  mergeConfigTemplates,
  mergeDeep,
} from "./utils";
import ApexCharts from "apexcharts";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import {
  CardConfigExternal,
  Period,
  Resolution,
  SeriesSetConfig,
} from "./types-config";
import { HomeAssistant, LovelaceCard, getDataTypeConfig } from "juzz-ha-helper";
import { mdiArrowLeft, mdiArrowRight, mdiReload } from "@mdi/js";

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
  @state() private _error?: string;

  private _hass?: HomeAssistant;
  private _entity?: HassEntity;

  // Config variables
  @state() private _config?: CardConfig;
  private _seriesSets: SeriesSetConfig[] = [];
  private _series: CardSeries[] = [];

  // Time variables
  private _refreshTimer?: number;
  @state() private _timeDate?: Moment;
  @state() private _lastUpdated: Date = new Date();
  private _timeViewingLiveData = true;

  // Graph display variables
  private _timeStart?: Moment;
  private _timeEnd?: Moment;
  @state() private _period: Period = Period.TWO_DAY;
  @state() private _resolution: Resolution = Resolution.THIRTY_MINUTES;
  @state() private _seriesSet?: SeriesSetConfig;

  /**
   * Invoked when the component is added to the document's DOM.
   */
  public connectedCallback() {
    console.log("connectedCallback()");
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
    console.log("disconnectedCallback()");
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
    console.log("cancelTimer()");

    clearInterval(this._refreshTimer);
    this._refreshTimer = undefined;
  }

  private initGraph(): boolean {
    // Destroy any existing graph
    if (this._apexChart) {
      this._apexChart.destroy();
      this._apexChart = undefined;
    }
    if (this._config && this.shadowRoot?.querySelector("#graph")) {
      this._apexChart = new ApexCharts(
        this.shadowRoot.querySelector("#graph"),
        mergeDeep(getLayoutConfig(this._config), {
          chart: { height: "300px" },
        }),
      );
      this._apexChart.render();

      // We created the graph
      console.log("initGraph(): true");
      return true;
    }

    // Graph is not initialised
    console.log("initGraph(): false");
    return false;
  }

  private async _initialLoad() {
    console.log(
      `_initialLoad(): ${
        this._config && !this._apexChart ? "running" : "skipping"
      }`,
    );
    if (this._config && !this._apexChart && this.initGraph()) {
      // Restore the last used config if configured
      if (this._config.rememberOptions) {
        const lastPeriod = this._entity?.attributes?.period;
        const lastResolution = this._entity?.attributes?.resolution;
        const lastSeriesSet = this._entity?.attributes?.seriesSet;
        if (lastPeriod && lastResolution && lastSeriesSet) {
          const seriesSet = this._seriesSets.find(
            (seriesSet) => seriesSet.name === lastSeriesSet,
          );
          if (seriesSet) {
            const supportedResolutions = getResolutionsForPeriod(
              lastPeriod,
              seriesSet.dataTypeGroup,
            );
            if (supportedResolutions.includes(lastResolution)) {
              this._period = lastPeriod;
              this._resolution = lastResolution;
              this._seriesSet = seriesSet;
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
      this._updateData(true);
    }
  }

  /**
   * Sets the config for the card
   */
  public setConfig(config: CardConfigExternal) {
    console.log("setConfig()");

    let configDup: CardConfigExternal = JSON.parse(JSON.stringify(config));
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
      this._updatePeriod(conf.period, false);

      // Now update the config
      this._config = conf;

      // Compute the SeriesSets
      this._seriesSets = generateSeriesSets(this._config);

      // Set the series set to the first item if we have one
      if (this._seriesSets.length > 0) {
        this._seriesSet = this._seriesSets[0];
      }

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
        console.log("shouldUpdate() -- _updateData()");
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
        "_error",
        "_lastUpdated",
        "_period",
        "_resolution",
        "_seriesSet",
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
      console.log("updated() -- _initialLoad()");
      this._initialLoad();
    }
  }

  private async _updateData(newEntityState = false) {
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
       * Get the times as known by the entity
       */
      const timeStart = new Date(this._entity.attributes.timeStart);
      const timeEnd = new Date(this._entity.attributes.timeEnd);

      /**
       * Entity has been updated, so check our config is correct
       */
      if (newEntityState) {
        /**
         * Update the dates if these differ to our set
         */
        const timeDate = new Date(this._entity.attributes.timeDate);
        const timeLiveData: boolean = this._entity.attributes.timeLiveData;
        const updatedTimes = (() => {
          if (
            isDateValid(timeDate) &&
            isDateValid(timeStart) &&
            isDateValid(timeEnd)
          ) {
            const momentTimeDate = moment(timeDate);
            const momentTimeStart = moment(timeStart);
            const momentTimeEnd = moment(timeEnd);
            if (
              !momentTimeDate.isSame(this._timeDate) ||
              !momentTimeStart.isSame(this._timeStart) ||
              !momentTimeEnd.isSame(this._timeEnd) ||
              timeLiveData !== this._timeViewingLiveData
            ) {
              this._timeDate = momentTimeDate;
              this._timeStart = momentTimeStart;
              this._timeEnd = momentTimeEnd;
              this._timeViewingLiveData = timeLiveData;
              return true;
            }
          }
          return false;
        })();

        /**
         * Check if the SeriesSet has changed
         */
        const entitySeriesSet = this._entity.attributes.seriesSet;
        const updatedSeriesSet = (() => {
          if (entitySeriesSet !== this._seriesSet?.name) {
            this._seriesSet = this._seriesSets.find(
              (seriesSet) => seriesSet.name === entitySeriesSet,
            );
            this.initGraph();
            return true;
          }
          return false;
        })();

        /**
         * Check if the Period or Resolution has changed
         */
        const entityPeriod: Period = this._entity.attributes.period;
        const entityResolution: Resolution = this._entity.attributes.resolution;
        const updatedControls = (() => {
          if (
            this._period !== entityPeriod ||
            this._resolution !== entityResolution
          ) {
            this._period = entityPeriod;
            this._resolution = entityResolution;
            return true;
          }
          return false;
        })();

        /**
         * Request an update if anything changed
         */
        if (updatedTimes || updatedSeriesSet || updatedControls) {
          this.requestUpdate();
        }
      }

      /**
       * Compute the Series
       */
      this._series = generateSeries(
        this._entity,
        this._config,
        this._seriesSet,
      );

      /**
       * Get the YAxes
       */
      const yAxes = this._seriesSet?.yAxes ?? [];

      this._apexChart?.updateOptions(
        getLayoutConfig(
          this._config,
          this._seriesSet?.dataTypeGroup,
          this._series,
          yAxes,
          now,
          timeStart,
          timeEnd,
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
          ${this._renderSeriesSelection()} ${this._renderLastUpdated()}
        </div>
      </ha-card>
    `;
  }

  private _renderTitle(): TemplateResult {
    if (
      !this._config ||
      !this._config.header.show ||
      (!this._config.header.title && !this._config.header.appendSeriesSetName)
    ) {
      return html``;
    }

    return html`<div id="header__title">
      <span
        >${[
          this._config.header.title,
          this._config.header.appendSeriesSetName
            ? this._seriesSet?.name
            : undefined,
        ]
          .filter((s) => s !== undefined)
          .join(": ")}</span
      >
    </div>`;
  }

  private _renderDateSelector(): TemplateResult {
    if (
      !this._config ||
      !this._config.showDateSelector ||
      !this._timeStart ||
      !this._timeEnd
    ) {
      return html``;
    }

    return html`
      <div id="date-selector">
        <div id="date">
          ${getDateRangeLabel(this._timeStart, this._timeEnd, this._period)}
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
      !this._config.showDateSelector ||
      !this._timeStart ||
      !this._timeEnd
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
          ${getResolutionsForPeriod(
            this._period,
            this._seriesSet?.dataTypeGroup,
          ).map((resolution) => {
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
          getDataTypeConfig(s.config.dataType),
          s.config.clampNegative,
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

  private _renderSeriesSelection(): TemplateResult {
    if (!this._config || this._seriesSets.length <= 1) {
      return html``;
    }

    return html`
      <div id="series-selector">
        <ha-select
          .label=${"Series"}
          .value=${this._seriesSet?.name}
          @selected=${this._pickSeriesSet}
        >
          ${this._seriesSets.map(
            (seriesSet) =>
              html`<mwc-list-item .value=${seriesSet.name}
                >${seriesSet.name}</mwc-list-item
              >`,
          )}</ha-select
        >
      </div>
    `;
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
    console.log(
      `_triggerUpdate(): ${!this._timeDate ? "skipping" : "running"}`,
    );
    if (!this._timeDate) return;

    const newDates = calculateNewDates(
      this._timeDate,
      this._period,
      this._resolution,
    );
    this._timeStart = newDates.startDate;
    this._timeEnd = newDates.endDate;

    // Update the graphs
    this.callService();
  }

  private _updateDate(date: moment.Moment) {
    console.log(
      `updateDate(): ${this._timeDate === date ? "skipping" : "running"}`,
    );

    // If the chosen date is the same, skip the update
    if (this._timeDate === date) {
      return;
    }

    // Update the date
    this._timeDate = date;

    // Trigger an update
    this._triggerUpdate();
  }

  /**
   * Update the period being observed
   * @param period
   */
  private _updatePeriod(period: Period, callRefresh = true) {
    console.log("_updatePeriod()");

    // Update the period
    this._period = period;

    // Get the resolutions supported by this period
    const supportedResolutions = getResolutionsForPeriod(
      this._period,
      this._seriesSet?.dataTypeGroup,
    );

    /**
     * Grab the last resolution (coarsest) if one is not definend or the one defined is not in the supported list
     * If we are updating the resolution, that function will call a refresh
     * Otherwise call for a refresh
     */
    if (!supportedResolutions.includes(this._resolution)) {
      this._updateResolution(supportedResolutions.pop(), callRefresh);
    } else if (callRefresh) {
      this._refresh();
    }
  }

  /**
   * Update the resolution being observed
   * @param resolution
   */
  private _updateResolution(resolution?: Resolution, callRefresh = true) {
    console.log("_updateResolution()");

    // Ensure that the resolution is not undefined
    if (!resolution) {
      return;
    }

    // Get the resolutions supported by this period
    const supportedResolutions = getResolutionsForPeriod(
      this._period,
      this._seriesSet?.dataTypeGroup,
    );

    // Make sure that resolution is in the supported set
    if (!supportedResolutions.includes(resolution)) {
      return;
    }

    // Update the resolution
    this._resolution = resolution;

    // Refresh the data
    if (callRefresh) {
      this._refresh();
    }
  }

  /**
   * Handle the `Next` button being pressed (Advance the day)
   */
  private _pickNext(): void {
    console.log(`_pickNext(): ${!this._timeDate ? "skipping" : "running"}"`);
    if (!this._timeDate) return;

    const currentTime = moment();
    const duration = getPeriodDuration(this._period);
    const newDate = this._timeDate.clone().add(duration);
    console.log(
      `New Date: ${newDate.toISOString()}... ${newDate.isAfter(currentTime)}`,
    );

    if (newDate.isAfter(currentTime)) {
      this._timeViewingLiveData = false;
      this._updateDate(currentTime);
    } else {
      this._updateDate(newDate);
    }
  }

  /**
   * Handle the `Previous` button being pressed (Recede the day)
   */
  private _pickPrevious(): void {
    console.log(`_pickPrevious(): ${!this._timeDate ? "skipping" : "running"}`);
    if (!this._timeDate) return;
    const duration = getPeriodDuration(this._period);
    const newDate = this._timeDate.clone().subtract(duration);
    this._timeViewingLiveData = false;

    this._updateDate(newDate);
  }

  /**
   * Set the date to the time right now
   */
  private _pickToday(): void {
    console.log("_pickToday()");
    this._timeViewingLiveData = true;
    this._updateDate(moment());
  }

  /**
   * Change the period of viewing
   */
  private _pickPeriod(ev): void {
    console.log(
      `_pickPeriod(): ${
        ev.target.value === this._period ? "skipping" : "running"
      }`,
    );
    if (ev.target.value === this._period) return;
    this._updatePeriod(ev.target.value);
  }

  /**
   * Change the resolution of viewing
   */
  private _pickResolution(ev): void {
    console.log(
      `_pickResolution(): ${
        ev.target.value === this._resolution ? "skipping" : "running"
      }`,
    );
    if (ev.target.value === this._resolution) return;
    this._updateResolution(ev.target.value);
  }

  /**
   * Change the series set to view
   */
  private _pickSeriesSet(ev): void {
    console.log(
      `_pickSeriesSet(): ${
        ev.target.value === this._seriesSet?.name ? "skipping" : "running"
      }`,
    );
    if (ev.target.value === this._seriesSet?.name) return;
    this._seriesSet = this._seriesSets.find(
      (seriesSet) => seriesSet.name === ev.target.value,
    );
    this._updatePeriod(this._period, false);
    this.initGraph();
    this._updateData();
    this.callService();
  }

  /**
   * Refresh the graph data. Either auto or manual
   */
  private _refresh(): void {
    const currentTime = moment();
    console.log(
      `_refresh(): ${this._timeEnd?.toISOString()} -- ${currentTime.toISOString()}. ${
        this._timeViewingLiveData
      }`,
    );

    if (this._timeViewingLiveData && currentTime.isAfter(this._timeEnd)) {
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
        !this._config ||
        !this._hass ||
        !this._seriesSet ||
        !this._timeDate ||
        !this._timeStart ||
        !this._timeEnd
          ? "skipping"
          : "running"
      }`,
    );

    if (
      !this._config ||
      !this._hass ||
      !this._seriesSet ||
      !this._timeDate ||
      !this._timeStart ||
      !this._timeEnd ||
      !this._hass.connected
    ) {
      return;
    }

    console.log(
      `Sending:\nDate: ${this._timeDate.toISOString()}\nStart: ${this._timeStart.toISOString()}\nEnd: ${this._timeEnd.toISOString()}\nViewing Live: ${
        this._timeViewingLiveData
      }\nPeriod: ${this._period}\nResolution: ${
        this._resolution
      }\nSeries Set: ${this._seriesSet.name}\nDataType Group: ${
        this._seriesSet.dataTypeGroup
      }`,
    );

    this._hass.callService("mqtt", "publish", {
      topic: `graphs/${this._config.entity}`,
      payload: JSON.stringify({
        dataTypeGroup: this._seriesSet.dataTypeGroup,
        period: this._period,
        resolution: this._resolution,
        series: this._seriesSet.series.map((seriesConfig) => {
          return {
            index: seriesConfig.index,
            clampNegative: seriesConfig.clampNegative,
            measurement: seriesConfig.measurement,
            device: seriesConfig.device,
            channel: seriesConfig.channel,
          };
        }),
        seriesSet: this._seriesSet.name,
        timeDate: this._timeDate.toISOString(),
        timeStart: this._timeStart.toISOString(),
        timeEnd: this._timeEnd.toISOString(),
        timeLiveData: this._timeViewingLiveData,
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
