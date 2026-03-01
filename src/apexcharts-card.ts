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
import { DateTime } from "luxon";
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
  isDateValid,
  mergeConfigTemplates,
  mergeDeep,
} from "./utils";
import ApexCharts from "apexcharts";
import { stylesApex } from "./styles";
import { HassEntity } from "home-assistant-js-websocket";
import { getLayoutConfig } from "./apex-layouts";
import { CardConfigExternal, Period, SeriesSetConfig } from "./types-config";
import { HomeAssistant, LovelaceCard, getDataTypeConfig } from "juzz-ha-helper";
import { mdiArrowLeft, mdiArrowRight, mdiReload } from "@mdi/js";
import { BUILD_NUMBER } from "./const";

declare const __RELEASE__: boolean;

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
  private _resizeObserver?: ResizeObserver;
  private _sizeObserver?: ResizeObserver;

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
  @state() private _timeDate?: DateTime;
  @state() private _lastUpdated: Date = new Date();
  private _timeViewingLiveData = true;

  // Graph display variables
  private _timeStart?: DateTime;
  private _timeEnd?: DateTime;
  @state() private _period: Period = Period.TWO_DAY;
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
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._sizeObserver?.disconnect();
    this._sizeObserver = undefined;
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
    // Clean up any previous size observer
    this._sizeObserver?.disconnect();
    this._sizeObserver = undefined;

    const graphEl = this.shadowRoot?.querySelector(
      "#graph",
    ) as HTMLElement | null;
    if (this._config && graphEl) {
      // ApexCharts 5.6+ Shadow DOM detection reads HOST.getBoundingClientRect()
      // when resolving "100%" width, but the HOST width includes card padding,
      // making the chart wider than the actual content area. We instead measure
      // #graph directly to get the correct inner content width.
      const measuredWidth = graphEl.getBoundingClientRect().width;
      const chartWidth = measuredWidth > 0 ? `${measuredWidth}px` : "100%";

      this._apexChart = new ApexCharts(
        graphEl,
        mergeDeep(getLayoutConfig(this._config, undefined, this._series), {
          chart: { height: "300px", width: chartWidth },
        }),
      );
      this._apexChart.render();

      // Keep chart correctly sized. We observe #graph (not the host) because
      // when ha-card renders its shadow DOM it applies padding that shrinks
      // #graph's width (e.g. 500→468px) without changing the host width — so
      // observing the host would miss that initial correction. Observing #graph
      // catches both the ha-card render correction and subsequent card resizes.
      this._sizeObserver = new ResizeObserver(() => {
        if (!this._apexChart) return;
        const w = graphEl.getBoundingClientRect().width;
        if (w > 0) {
          this._apexChart.updateOptions(
            { chart: { width: `${w}px` } },
            false,
            false,
          );
        }
      });
      this._sizeObserver.observe(graphEl);

      console.log(`initGraph(): true, width: ${chartWidth}`);
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
    if (!this._config || this._apexChart) return;

    // Pre-compute series before creating the chart so the initial render()
    // has real data. Without this, ApexCharts renders with empty series,
    // minXDiff=Infinity propagates into SVG x attribute calculations, and the
    // browser logs "Unexpected value Infinity parsing x attribute" warnings.
    if (this._entity) {
      this._series = generateSeries(
        this._entity,
        this._config,
        this._seriesSet,
      );
    }

    if (this.initGraph()) {
      // Restore the last used config if configured
      if (this._config.rememberOptions) {
        const lastPeriod = this._entity?.attributes?.period;
        const lastSeriesSet = this._entity?.attributes?.seriesSet;
        if (lastPeriod && lastSeriesSet) {
          const seriesSet = this._seriesSets.find(
            (seriesSet) => seriesSet.name === lastSeriesSet,
          );
          if (seriesSet) {
            this._period = lastPeriod;
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

    // If we have not yet initialised
    if (!this._apexChart) {
      return true;
    }

    // Only update on specific changes
    if (
      [
        "_config",
        "_timeDate",
        "_error",
        "_lastUpdated",
        "_period",
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

    // We have rendered but not yet initialised.
    if (this._config && !this._apexChart && this.isConnected) {
      console.log("updated() -- _initialLoad()");
      // ApexCharts 5.6+ uses Shadow DOM detection: it reads the HOST element's
      // getBoundingClientRect() (not #graph's clientWidth) to resolve "100%".
      // If the host has no layout yet, getDimensions() returns 0 and the chart
      // falls back to its 500px default.  We therefore observe the HOST element
      // (this) and delay init until it reports a non-zero width.
      if (this.getBoundingClientRect().width === 0) {
        this._resizeObserver?.disconnect();
        this._resizeObserver = new ResizeObserver(() => {
          if (
            this._config &&
            !this._apexChart &&
            this.getBoundingClientRect().width > 0
          ) {
            this._resizeObserver?.disconnect();
            this._resizeObserver = undefined;
            this._initialLoad();
          }
        });
        this._resizeObserver.observe(this);
      } else {
        this._initialLoad();
      }
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
            const dtTimeDate = DateTime.fromJSDate(timeDate);
            const dtTimeStart = DateTime.fromJSDate(timeStart);
            const dtTimeEnd = DateTime.fromJSDate(timeEnd);
            if (
              dtTimeDate.toMillis() !== (this._timeDate?.toMillis() ?? NaN) ||
              dtTimeStart.toMillis() !== (this._timeStart?.toMillis() ?? NaN) ||
              dtTimeEnd.toMillis() !== (this._timeEnd?.toMillis() ?? NaN) ||
              timeLiveData !== this._timeViewingLiveData
            ) {
              this._timeDate = dtTimeDate;
              this._timeStart = dtTimeStart;
              this._timeEnd = dtTimeEnd;
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
            const newSeriesSet = this._seriesSets.find(
              (seriesSet) => seriesSet.name === entitySeriesSet,
            );
            if (newSeriesSet) {
              this._seriesSet = newSeriesSet;
              this.initGraph();
              return true;
            }
          }
          return false;
        })();

        /**
         * Check if the Period has changed
         */
        const entityPeriod: Period = this._entity.attributes.period;
        const updatedControls = (() => {
          if (this._period !== entityPeriod) {
            this._period = entityPeriod;
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
        <button class="today-btn" @click=${this._pickToday}>Today</button>
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
          .options=${Object.values(Period)
            .filter(
              (p) =>
                ![
                  Period.WEEK,
                  Period.MONTH,
                ].includes(p),
            )
            .map((period) => ({
              value: period,
              label: getPeriodLabel(period),
            }))}
          @value-changed=${this._pickPeriod}
        ></ha-select>
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
          .options=${this._seriesSets.map((seriesSet) => ({
            value: seriesSet.name,
            label: seriesSet.name,
          }))}
          @value-changed=${this._pickSeriesSet}
        ></ha-select>
      </div>
    `;
  }

  private _renderLastUpdated(): TemplateResult {
    if (!this._config || !this._config.show.lastUpdated) {
      return html``;
    }
    const buildInfo = __RELEASE__
      ? html``
      : html`<div id="build_info">
          v${pjson.version}.bld${String(BUILD_NUMBER).padStart(2, "0")}
        </div>`;
    return html`
      ${buildInfo}
      <div id="last_updated">${formatApexDate(this._lastUpdated)}</div>
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

    const newDates = calculateNewDates(this._timeDate, this._period);
    this._timeStart = newDates.startDate;
    this._timeEnd = newDates.endDate;

    // Update the graphs
    this.callService();
  }

  private _updateDate(date: DateTime) {
    console.log(
      `updateDate(): ${this._timeDate?.toMillis() === date.toMillis() ? "skipping" : "running"}`,
    );

    // If the chosen date is the same, skip the update
    if (this._timeDate && this._timeDate.toMillis() === date.toMillis()) {
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
    this._period = period;
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

    const currentTime = DateTime.now();
    const duration = getPeriodDuration(this._period);
    const newDate = this._timeDate.plus(duration);
    console.log(`New Date: ${newDate.toISO()}... ${newDate > currentTime}`);

    if (newDate > currentTime) {
      this._timeViewingLiveData = true;
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
    const newDate = this._timeDate.minus(duration);
    this._timeViewingLiveData = false;

    this._updateDate(newDate);
  }

  /**
   * Set the date to the time right now
   */
  private _pickToday(): void {
    console.log("_pickToday()");
    this._timeViewingLiveData = true;
    this._updateDate(DateTime.now());
  }

  /**
   * Change the period of viewing
   */
  private _pickPeriod(ev): void {
    const value = ev.detail.value;
    console.log(
      `_pickPeriod(): ${value === this._period ? "skipping" : "running"}`,
    );
    if (value === this._period) return;
    this._updatePeriod(value);
  }

  /**
   * Change the series set to view
   */
  private _pickSeriesSet(ev): void {
    const value = ev.detail.value;
    console.log(
      `_pickSeriesSet(): ${
        value === this._seriesSet?.name ? "skipping" : "running"
      }`,
    );
    if (value === this._seriesSet?.name) return;
    this._seriesSet = this._seriesSets.find(
      (seriesSet) => seriesSet.name === value,
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
    const currentTime = DateTime.now();
    console.log(
      `_refresh(): ${this._timeEnd?.toISO()} -- ${currentTime.toISO()}. ${
        this._timeViewingLiveData
      }`,
    );

    if (
      this._timeViewingLiveData &&
      this._timeEnd &&
      currentTime > this._timeEnd
    ) {
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
      `Sending:\nDate: ${this._timeDate.toUTC().toISO()}\nStart: ${this._timeStart.toUTC().toISO()}\nEnd: ${this._timeEnd.toUTC().toISO()}\nViewing Live: ${
        this._timeViewingLiveData
      }\nPeriod: ${this._period}\nSeries Set: ${this._seriesSet.name}\nDataType Group: ${
        this._seriesSet.dataTypeGroup
      }`,
    );

    this._hass.callService("mqtt", "publish", {
      topic: `graphs/${this._config.entity}`,
      payload: JSON.stringify({
        dataTypeGroup: this._seriesSet.dataTypeGroup,
        period: this._period,
        series: this._seriesSet.series.map((seriesConfig) => {
          return {
            index: seriesConfig.index,
            clampNegative: seriesConfig.clampNegative,
            measurement: seriesConfig.measurement,
            device: seriesConfig.device,
            field: seriesConfig.field,
          };
        }),
        seriesSet: this._seriesSet.name,
        timeDate: this._timeDate.toUTC().toISO(),
        timeStart: this._timeStart.toUTC().toISO(),
        timeEnd: this._timeEnd.toUTC().toISO(),
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
