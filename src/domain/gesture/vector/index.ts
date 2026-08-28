export {
  extractGestureVector,
  quantizeDirection,
  rawPathLength,
  type GestureVector,
} from "./extract";
export {
  directionUnitVector,
  directionsCompatible,
} from "./directions";
export {
  matchGestureVector,
  passesGestureVectorChecks,
  prepareGestureVectorForMatch,
} from "./match";
export { normalizeGestureVector } from "./normalize";
export {
  gestureDisplayPoints,
  vectorToPreviewPoints,
  vectorToStrokePoints,
} from "./render";
export { directionArrow, formatGestureVector } from "./labels";
export { resolveGestureVector } from "./resolve";
