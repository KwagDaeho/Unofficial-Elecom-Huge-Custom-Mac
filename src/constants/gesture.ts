/** Shared with Rust runtime (`recognizer.rs`, `gesture.rs`, `state.rs`). Keep in sync. */
export const GESTURE_TEMPLATE_SIZE = 64;
export const GESTURE_SQUARE_SIZE = 250;
export const GESTURE_PREVIEW_POINT_COUNT = 48;
export const DEFAULT_GESTURE_MIN_SCORE = 0.88;
export const MIN_RAW_PATH_LENGTH = 24;

/** Used by TS match tests mirroring Rust shape checks. */
export const MIN_PATH_LENGTH_RATIO = 0.75;
export const MIN_TURNING_RATIO = 0.85;
export const MIN_TEMPLATE_TURNING = 0.35;
export const MIN_CORNER_ANGLE = Math.PI / 5;
export const MAX_CORNER_COUNT_DIFF_RATIO = 0.25;
export const MIN_CORNER_AXIS_RATIO = 0.28;
export const MAX_BEARING_DELTA = Math.PI / 3;
export const SIMPLIFY_EPSILON_RATIO = 0.04;
export const MIN_SIMPLIFY_EPSILON = 3;
