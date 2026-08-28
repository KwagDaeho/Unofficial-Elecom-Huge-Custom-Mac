const DIRECTION_ARROWS = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"] as const;

export const directionArrow = (direction: number): string => {
  return DIRECTION_ARROWS[direction % 8] ?? "?";
};

export const formatGestureVector = (
  directions: number[],
  segmentLengths: number[],
  lang: "ko" | "en",
): string => {
  if (directions.length === 0) {
    return lang === "ko" ? "(없음)" : "(none)";
  }
  const parts = directions.map((direction, index) => {
    const arrow = directionArrow(direction);
    const pct = Math.round((segmentLengths[index] ?? 0) * 100);
    return `${arrow} ${pct}`;
  });
  return parts.join("  ");
};
