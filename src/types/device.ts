import type { ButtonId } from "./profile";

export type DeviceInfo = {
  vendorId: number;
  productId: number;
  productName: string;
  manufacturer: string;
  path: string;
  isHuge: boolean;
};

export type ButtonMeta = {
  id: ButtonId;
  hiddenFromMacos: boolean;
};

export type LastReport = {
  hex: string;
  buttons: string[];
  dx: number;
  dy: number;
  wheel: number;
  pan: number;
  ignored: boolean;
  tsMs: number;
};

export type InstalledApp = {
  name: string;
  bundleId: string;
  path: string;
};

export type InstalledAppWithIcon = InstalledApp & { icon?: string };
