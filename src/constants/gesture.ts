/** Shared with Rust runtime (`vector.rs`, `gesture.rs`, `state.rs`). Keep in sync. */

export const DEFAULT_GESTURE_MIN_SCORE = 0.62;
export const MIN_RAW_PATH_LENGTH = 24;
export const MIN_PATH_LENGTH_RATIO = 0.65;

/** Ignore short adjacent-octant jitter at corners (not whole edges). */
export const MIN_VECTOR_SEGMENT_LENGTH = 4;

/** Drop / merge segments shorter than this share of total length. */
export const MIN_SEGMENT_LENGTH_RATIO = 0.08;

/** Direction vs length score blend. */
export const DIRECTION_SCORE_WEIGHT = 0.55;
export const LENGTH_SCORE_WEIGHT = 0.45;

/** Exact octant = 1.0; adjacent octant (↗ for →) is nearly as good. */
export const ADJACENT_DIRECTION_MATCH_SCORE = 0.95;

/** log-ratio tolerance per aligned segment (≈ ±75%). */
export const LENGTH_RATIO_TOLERANCE = 1.05;

export const MIN_GESTURE_SEGMENTS = 1;

/** Thumbnail / legacy preview helpers. */
export const GESTURE_PREVIEW_POINT_COUNT = 48;
