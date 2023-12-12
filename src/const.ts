import { DataPoint, MinMaxPoint } from "./types-config";

export const DEFAULT_SERIES_TYPE = "line";

// Y-Axis Config
export const DEFAULT_Y_AXIS_ID = "default";

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

export const DEFAULT_AREA_OPACITY = 0.7;

export const DEFAULT_DATA: Array<DataPoint> = [];

export const DEFAULT_MIN_MAX: MinMaxPoint = {
  min: [
    0,
    0,
  ],
  max: [
    0,
    0,
  ],
};
