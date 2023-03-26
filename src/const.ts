import { HistoryPoint } from "./types";

export const DEFAULT_SERIE_TYPE = "line";

export const DEFAULT_FLOAT_PRECISION = 1;

export const DEFAULT_COLORS = [
  "var(--accent-color)",
  "#3498db",
  "#e74c3c",
  "#9b59b6",
  "#f1c40f",
  "#2ecc71",
  "#1abc9c",
  "#34495e",
  "#e67e22",
  "#7f8c8d",
  "#27ae60",
  "#2980b9",
  "#8e44ad",
];

export const NO_VALUE = "N/A";

export const DEFAULT_UPDATE_DELAY = 1500;
export const DEFAULT_AREA_OPACITY = 0.7;

export const DEFAULT_DATA: Array<HistoryPoint> = [];
export const DEFAULT_MIN_POINT: HistoryPoint = [
  0,
  null,
];
export const DEFAULT_MAX_POINT: HistoryPoint = [
  0,
  null,
];
