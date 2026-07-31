/* Bundle the whole game into one self-contained HTML file.
 *   node tools/bundle.js [out.html] [--artifact]
 *
 * The game is already dependency-free — no CDNs, no fonts, no images — so
 * bundling is just inlining css/style.css and the nine js modules into
 * index.html in their original order.
 *
 * --artifact strips the <!DOCTYPE>/<html>/<head>/<body> shell (the publishing
 * wrapper provides its own skeleton) but keeps <title> and the viewport meta.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const artifact = args.includes('--artifact');
const out = args.find((a) => !a.startsWith('--')) ||
  path.join(root, 'dist', artifact ? 'fantasy-kritter-artifact.html' : 'fantasy-kritter.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// inline the stylesheet
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

// inline every script in place, preserving order
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  // a literal </script> inside the code would end the inline tag early
  return '<script>\n' + js.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
});

if (artifact) {
  // keep only what belongs inside the wrapper's <body>
  const title = (html.match(/<title>.*?<\/title>/) || [''])[0];
  const viewport = (html.match(/<meta name="viewport"[^>]*>/) || [''])[0];
  const bodyStart = html.indexOf('<body>') + '<body>'.length;
  const bodyEnd = html.indexOf('</body>');
  const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  html = title + '\n' + viewport + '\n' + style + '\n' + html.slice(bodyStart, bodyEnd);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote %s (%d kB)', out, Math.round(html.length / 1024));
