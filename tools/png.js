/* Minimal PNG + ICO writers.
 *
 * The app icons are rendered by the game's own drawing code on a canvas, which
 * hands back raw RGBA pixels. Turning those into files needs an encoder, and
 * pulling in a dependency for it would break the "no node_modules" property the
 * rest of this repo has. A PNG is a short header, one zlib stream of filtered
 * scanlines, and three CRCs — small enough to just write.
 *
 * encodeRGBA is used for everything except the iOS app icon: App Store
 * validation rejects an icon with an alpha channel, so that one goes through
 * encodeRGB, which drops the channel rather than flattening it (the icon is
 * drawn fully opaque to begin with).
 */
'use strict';
const zlib = require('zlib');

// ---------------------------------------------------------------- crc32
const CRC = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/* colorType 6 = RGBA, 2 = RGB. `rgba` is always the source format; when
 * channels is 3 the alpha byte is skipped per pixel. */
function encode(rgba, w, h, channels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;                        // bit depth
  ihdr[9] = channels === 4 ? 6 : 2;   // colour type
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // deflate / adaptive / no interlace

  // one filter byte (0 = None) in front of every scanline
  const raw = Buffer.alloc(h * (1 + w * channels));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    let s = y * w * 4;
    for (let x = 0; x < w; x++, s += 4) {
      raw[p++] = rgba[s];
      raw[p++] = rgba[s + 1];
      raw[p++] = rgba[s + 2];
      if (channels === 4) raw[p++] = rgba[s + 3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

exports.encodeRGBA = (rgba, w, h) => encode(rgba, w, h, 4);
exports.encodeRGB = (rgba, w, h) => encode(rgba, w, h, 3);

/* A .ico is a directory of images; since Vista each entry may be a whole PNG
 * file rather than a DIB, which is what we emit. `images` is
 * [{ size, png }] and must be ordered small to large. */
exports.ico = function (images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir[o] = img.size >= 256 ? 0 : img.size;      // 0 means 256
    dir[o + 1] = img.size >= 256 ? 0 : img.size;
    dir[o + 2] = 0;                                // palette size
    dir[o + 3] = 0;                                // reserved
    dir.writeUInt16LE(1, o + 4);                   // colour planes
    dir.writeUInt16LE(32, o + 6);                  // bits per pixel
    dir.writeUInt32BE(0, o + 8);
    dir.writeUInt32LE(img.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.png.length;
  });

  return Buffer.concat([header, dir].concat(images.map((i) => i.png)));
};

/* macOS .icns: a magic word, a total length, then one typed entry per size.
 * The ic07..ic10 types take PNG payloads directly. */
const ICNS_TYPE = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
exports.icns = function (images) {
  const entries = images
    .filter((i) => ICNS_TYPE[i.size])
    .map((i) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(i.png.length + 8, 0);
      return Buffer.concat([Buffer.from(ICNS_TYPE[i.size], 'ascii'), len, i.png]);
    });
  const body = Buffer.concat(entries);
  const total = Buffer.alloc(4);
  total.writeUInt32BE(body.length + 8, 0);
  return Buffer.concat([Buffer.from('icns', 'ascii'), total, body]);
};
