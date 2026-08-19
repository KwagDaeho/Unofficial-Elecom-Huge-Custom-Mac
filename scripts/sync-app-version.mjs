#!/usr/bin/env node
/**
 * App version SSOT is package.json `"version"`.
 * Syncs src-tauri/tauri.conf.json, src-tauri/Cargo.toml, and README.md.
 *
 *   node scripts/sync-app-version.mjs          # write
 *   node scripts/sync-app-version.mjs --check  # fail if drifted
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`package.json version is not x.y.z: ${version}`);
}

const tauriPath = join(root, "src-tauri/tauri.conf.json");
const cargoPath = join(root, "src-tauri/Cargo.toml");
const readmePath = join(root, "README.md");

const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
const cargo = readFileSync(cargoPath, "utf8");
const cargoMatch = cargo.match(/^version = "([^"]+)"/m);
const cargoVersion = cargoMatch?.[1];
const readme = readFileSync(readmePath, "utf8");

const drifted = [];
if (tauri.version !== version) drifted.push(`tauri.conf.json (${tauri.version})`);
if (cargoVersion !== version) drifted.push(`Cargo.toml (${cargoVersion})`);
if (!readme.includes(`v${version}`) || !readme.includes(`-${version}-aarch64.dmg`)) {
  drifted.push("README.md");
}

if (checkOnly) {
  if (drifted.length) {
    console.error(
      `version drift vs package.json ${version}: ${drifted.join(", ")}\nrun: npm run version:sync`,
    );
    process.exit(1);
  }
  process.exit(0);
}

const prev = tauri.version;
const tauriRaw = readFileSync(tauriPath, "utf8");
writeFileSync(
  tauriPath,
  tauriRaw.replace(/("version"\s*:\s*")[^"]+"/, `$1${version}"`),
);

writeFileSync(
  cargoPath,
  cargo.replace(/^version = "[^"]+"/m, `version = "${version}"`),
);

if (prev && prev !== version) {
  writeFileSync(
    readmePath,
    readme.replaceAll(`v${prev}`, `v${version}`).replaceAll(prev, version),
  );
}

console.log(`synced app version ${version}`);
