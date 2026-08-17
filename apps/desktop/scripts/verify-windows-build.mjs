import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unpackedDir = path.resolve(desktopDir, '../../dist/desktop/win-unpacked');
const requiredFiles = ['邻传.exe', 'ffmpeg.dll', 'resources.pak'];

for (const file of requiredFiles) {
  await access(path.join(unpackedDir, file));
}

console.log(`Windows runtime verified: ${unpackedDir}`);
