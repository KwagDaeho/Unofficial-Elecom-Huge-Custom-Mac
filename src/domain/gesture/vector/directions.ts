/** 0=E, 1=NE, 2=N, … 7=SE (screen coords, y down). */

export const directionsCompatible = (left: number, right: number): boolean => {
  if (left === right) {
    return true;
  }
  const diff = Math.abs(left - right);
  return diff <= 1 || diff === 7;
};

/** Cardinals (E/N/W/S) — trackball corners often insert these between diagonals. */
export const isCardinalDirection = (direction: number): boolean => {
  return direction % 2 === 0;
};

export const directionUnitVector = (direction: number): { x: number; y: number } => {
  const angle = direction * (Math.PI / 4);
  return { x: Math.cos(angle), y: -Math.sin(angle) };
};
