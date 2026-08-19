import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const execFileAsync = promisify(execFile);
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktopDir, '../..');
const source = path.join(root, 'public/logo.svg');
const output = path.join(desktopDir, 'build/icons');
const iconset = path.join(output, 'icon.iconset');
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const MAC_ICON_SCALE = 0.805;

function macIcon(size) {
  const innerSize = Math.max(1, Math.round(size * MAC_ICON_SCALE));
  const remaining = size - innerSize;
  const before = Math.floor(remaining / 2);
  const after = remaining - before;
  return sharp(source)
    .resize(innerSize, innerSize)
    .extend({ top: before, bottom: after, left: before, right: after, background: { r: 0, g: 0, b: 0, alpha: 0 } });
}

await rm(output, { recursive: true, force: true });
await mkdir(iconset, { recursive: true });

const pngFiles = new Map();
for (const size of sizes) {
  const filename = path.join(output, `icon-${size}.png`);
  await sharp(source).resize(size, size).png().toFile(filename);
  pngFiles.set(size, filename);
}
await macIcon(1024).png().toFile(path.join(output, 'icon.png'));
await writeFile(path.join(output, 'icon.ico'), await pngToIco([16, 32, 48, 64, 128, 256].map(size => pngFiles.get(size))));

if (process.platform === 'darwin') {
  const macFiles = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']
  ];
  for (const [size, name] of macFiles) await macIcon(size).png().toFile(path.join(iconset, name));
  await execFileAsync('iconutil', ['-c', 'icns', iconset, '-o', path.join(output, 'icon.icns')]);
  await rm(iconset, { recursive: true, force: true });
}

console.log(`Desktop icons: ${output}`);
