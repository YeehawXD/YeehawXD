/* Stage the game into both app shells.
 *
 *   node tools/app.js
 *
 * The web game is the single source of truth: js/ and css/ are edited, and the
 * iOS and desktop projects only ever contain a generated copy. That is why this
 * script exists rather than the shells reaching into ../../js — an Xcode bundle
 * and an asar archive both need the files inside themselves, and a checked-in
 * copy that is edited by hand is a copy that drifts.
 *
 * Writes:
 *   dist/fantasy-kritter.html
 *   app/ios/FantasyKritter/web/index.html      (blue folder ref in the target)
 *   app/desktop/web/index.html                 (packed by electron-builder)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { build } = require('./bundle');

const root = path.join(__dirname, '..');

const HEADER = (target) => `<!-- GENERERET FIL — rediger ikke.
     Bygget af tools/app.js fra index.html, css/ og js/.
     Kør \`node tools/app.js\` igen efter enhver ændring i spillet.
     Mål: ${target} -->\n`;

const targets = [
  { file: 'dist/fantasy-kritter.html', label: 'web (én fil)' },
  { file: 'app/ios/FantasyKritter/web/index.html', label: 'iOS / Xcode' },
  { file: 'app/desktop/web/index.html', label: 'desktop / Electron' },
];

const html = build();

// A truncated or empty bundle would still "build" in both shells and fail as a
// blank screen at runtime, which is the worst place to find out.
const required = ['window.COC', 'CritterArt', 'id="s-title"'];
const missing = required.filter((r) => html.indexOf(r) === -1);
if (missing.length) {
  console.error('bundle looks wrong — missing: ' + missing.join(', '));
  process.exit(1);
}

console.log('bundling the game (%d kB)…', Math.round(html.length / 1024));
for (const t of targets) {
  const out = path.join(root, t.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, HEADER(t.label) + html);
  console.log('  %s  → %s', t.label.padEnd(20), t.file);
}

// The icons are rendered by a separate, slower tool (it needs a browser), so
// check rather than run — a missing icon is a silent grey square otherwise.
const icons = [
  'app/ios/FantasyKritter/Assets.xcassets/AppIcon.appiconset/icon-1024.png',
  'app/desktop/build/icon.ico',
  'app/desktop/build/icon.icns',
  'app/desktop/build/icon.png',
];
const noIcons = icons.filter((f) => !fs.existsSync(path.join(root, f)));
if (noIcons.length) {
  console.warn('\napp-ikoner mangler (%d) — kør: node tools/icon.js', noIcons.length);
} else {
  console.log('\napp-ikoner er på plads.');
}
