// Dependency-free, deterministic PNG generation. No third-party assets or fonts.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../public/', import.meta.url);
await mkdir(out, { recursive: true });
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, crc]);
}
for (const [name, n] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable.png', 512], ['apple-touch-icon.png', 180]]) {
  const data = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xx = (x - n / 2) / n, yy = (y - n / 2) / n;
    const ellipse = (xx * xx) / .105 + (yy * yy) / .035;
    const eye = ellipse < 1 && ellipse > .68;
    const iris = Math.hypot(xx, yy) < .085;
    const color = eye || iris ? [241, 246, 233] : [24, 65, 64];
    const i = y * (n * 4 + 1) + 1 + x * 4;
    data.set([...color, 255], i);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(new URL(name, out), png);
}
await writeFile(new URL('favicon.svg', out), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#184140"/><path d="M12 32Q32 9 52 32Q32 55 12 32Z" fill="none" stroke="#f1f6e9" stroke-width="4"/><circle cx="32" cy="32" r="7" fill="#f1f6e9"/></svg>');
