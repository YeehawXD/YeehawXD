/* Inline every script into one self-contained HTML file.

   The game already has no external assets -- no images, no fonts, no audio --
   so concatenating the sources in load order produces a single file you can
   double-click, email, drop on itch, or wrap in Electron for Steam. */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const order = html.match(/<script src="([^"]+)"><\/script>/g)
  .map(t => t.match(/src="([^"]+)"/)[1]);

let bundle = '';
for (const src of order) {
  if (src === 'src/shots.js') continue;             // capture harness, not shipped
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  bundle += `\n/* ===== ${src} ===== */\n${code}\n`;
}

let out = html;
for (const src of order) out = out.replace(`<script src="${src}"></script>\n`, '');
out = out.replace('</body>', `<script>\n${bundle}\n</script>\n</body>`);
/* setupShot lives in the harness; stub it so the boot path is unchanged */
out = out.replace('<script>\n\n/* ===== src/util.js', '<script>\nfunction setupShot() { return false; }\n\n/* ===== src/util.js');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist', 'norbert-unfinished.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + ' KB');
