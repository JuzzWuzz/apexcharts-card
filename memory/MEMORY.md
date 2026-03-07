# Project Memory

## Workflow Preferences
- **Never auto-commit.** Only create commits when the user explicitly asks.
  When asked, draw up a commit based on everything done since the last commit.

## Project Overview
Custom Home Assistant Lovelace card (fork of RomRider/apexcharts-card).
Uses LitElement + ApexCharts v5, TypeScript, Rollup build.
Data comes via MQTT; card publishes requests, entity attributes carry responses.

## Key Files
- `src/apexcharts-card.ts` — Main LitElement card component
- `src/apex-layouts.ts` — ApexCharts layout/options builder
- `src/utils.ts` — Pure utility functions (date math, formatting)
- `src/types.ts` — Runtime types (CardConfig, CardSeries, etc.)
- `src/types-config.ts` — Config schema types (Period, Resolution, DataTypeGroup, etc.)
- `src/types-config-ti.ts` — Auto-generated ts-interface-checker suite (don't edit)
- `src/styles.ts` — All CSS for the card
- `src/const.ts` — Constants

## Local Dependency
`juzz-ha-helper` is a local file dep (`file:../juzz-ha-helper`) providing
`HomeAssistant`, `DataType`, `DataTypeConfig`, `getDataTypeConfig`, etc.

## Build
`npm run build` — rimraf dist → ts-interface-builder → eslint --fix → rollup
`npm start` — rollup watch mode

## Tech Notes
- eslint stack intentionally held at v8 / @typescript-eslint v7 (v9/v10 has breaking flat config changes)
