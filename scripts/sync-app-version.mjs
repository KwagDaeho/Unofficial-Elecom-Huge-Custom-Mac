#!/usr/bin/env node
/**
 * App version SSOT: package.json `"version"`.
 * Contact SSOT: src/meta/app.json.
 *
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
const appMeta = JSON.parse(
  readFileSync(join(root, "src/meta/app.json"), "utf8"),
);
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

const versionTag = `v${version}`;
const dmgName = `Unofficial-Elecom-Huge-Custom-Mac-${version}-aarch64.dmg`;
const { contact } = appMeta;

const contactLine = `Email: [${contact.email}](mailto:${contact.email}) · Kakao: [${contact.kakaoDisplay}](${contact.kakaoUrl}) · GitHub: [${contact.githubRepo}](${contact.githubUrl})`;

/** @param {string} source */
function syncReadme(source) {
  const badgeUrl = `https://img.shields.io/badge/Download-macOS%20DMG%20(${encodeURIComponent(versionTag)})-0A7EA4?style=for-the-badge&logo=apple&logoColor=white`;
  const dmgUrl = `${contact.githubUrl}/releases/download/${versionTag}/${dmgName}`;

  let next = source;

  next = next.replace(
    /\[!\[Download for macOS\]\([^)]*\)\]\([^)]*\)/,
    `[![Download for macOS](${badgeUrl})](${dmgUrl})`,
  );

  next = next.replace(
    /Unofficial-Elecom-Huge-Custom-Mac-[\d.]+-aarch64\.dmg/g,
    dmgName,
  );

  next = next.replace(/git checkout v[\d.]+/g, `git checkout ${versionTag}`);

  next = next.replace(/GitHub DMG \(v[\d.]+\)/g, `GitHub DMG (${versionTag})`);

  next = next.replace(
    /\*\*Development \/ test environment \(v[\d.]+\)\*\*/g,
    `**Development / test environment (${versionTag})**`,
  );

  next = next.replace(
    /\*\*개발·테스트 환경 \(v[\d.]+\)\*\*/g,
    `**개발·테스트 환경 (${versionTag})**`,
  );

  next = next.replace(/### Coverage \(v[\d.]+\)/g, `### Coverage (${versionTag})`);
  next = next.replace(/### 지원 범위 \(v[\d.]+\)/g, `### 지원 범위 (${versionTag})`);

  next = next.replace(/\| v[\d.]+ DMG \|/g, `| ${versionTag} DMG |`);

  next = next.replace(/^Email: .+$/m, contactLine);

  return next;
}

const syncedReadme = syncReadme(readme);

const drifted = [];
if (tauri.version !== version) drifted.push(`tauri.conf.json (${tauri.version})`);
if (cargoVersion !== version) drifted.push(`Cargo.toml (${cargoVersion})`);
if (syncedReadme !== readme) drifted.push("README.md");

if (checkOnly) {
  if (drifted.length) {
    console.error(
      `drift vs package.json ${version}: ${drifted.join(", ")}\nrun: npm run version:sync`,
    );
    process.exit(1);
  }
  process.exit(0);
}

const tauriRaw = readFileSync(tauriPath, "utf8");
writeFileSync(
  tauriPath,
  tauriRaw.replace(/("version"\s*:\s*")[^"]+"/, `$1${version}"`),
);

writeFileSync(
  cargoPath,
  cargo.replace(/^version = "[^"]+"/m, `version = "${version}"`),
);

writeFileSync(readmePath, syncedReadme);

console.log(`synced app version ${version}`);
