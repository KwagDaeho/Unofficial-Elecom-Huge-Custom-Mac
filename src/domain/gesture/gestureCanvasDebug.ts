const TAG = "[gesture-canvas]";

export const gcLog = (
  step: string,
  detail?: Record<string, unknown>,
): void => {
  if (!import.meta.env.DEV) {
    return;
  }
  if (detail === undefined) {
    console.log(TAG, step);
    return;
  }
  console.log(TAG, step, detail);
};
