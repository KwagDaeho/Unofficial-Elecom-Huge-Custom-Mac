/** Shared with Rust runtime (`recognizer.rs`, `gesture.rs`, `state.rs`). Keep in sync. */

export const DEFAULT_GESTURE_MIN_SCORE = 0.72;
export const MIN_RAW_PATH_LENGTH = 24;

/** $1 Unistroke resample + normalization (Wobbrock et al.). */
export const GESTURE_TEMPLATE_SIZE = 64;
export const GESTURE_SQUARE_SIZE = 250;

/** Legacy 8-direction vector preview helpers. */
export const MIN_PATH_LENGTH_RATIO = 0.65;
export const MIN_VECTOR_SEGMENT_LENGTH = 4;
export const MIN_SEGMENT_LENGTH_RATIO = 0.08;
export const DIRECTION_SCORE_WEIGHT = 0.55;
export const LENGTH_SCORE_WEIGHT = 0.45;
export const ADJACENT_DIRECTION_MATCH_SCORE = 0.95;
export const LENGTH_RATIO_TOLERANCE = 1.05;
export const MIN_GESTURE_SEGMENTS = 1;
export const GESTURE_PREVIEW_POINT_COUNT = 48;
