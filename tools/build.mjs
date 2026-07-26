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
for (const src of order) {
  out = out.replace(new RegExp(`[ \\t]*<script src="${src.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}"></script>\\n?`), '');
}
/* setupShot lives in the capture harness, which isn't shipped; stub it so the
   boot path is identical to the served build */
out = out.replace('</body>', `<script>\nfunction setupShot() { return false; }\n${bundle}\n</script>\n</body>`);
if (out.includes('<script src=')) throw new Error('a <script src> survived inlining');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist', 'norbert-unfinished.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + ' KB');
