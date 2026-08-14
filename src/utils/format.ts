import type { DeviceInfo, Dict } from "../types";

/** `(1.00×, 1000)` style label for speed sliders. */
export function formatSpeedPair(mult: number, base: number): string {
  return `(${mult.toFixed(2)}×, ${Math.round(base * mult)})`;
}

export function hexPid(id: number) {
  return `0x${id.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function connectedLabel(
  connected: DeviceInfo | null,
  dict: Dict,
): string {
  if (!connected) return dict.notConnected;
  return `${connected.productName} (${hexPid(connected.vendorId)}:${hexPid(connected.productId)})`;
}
