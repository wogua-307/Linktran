import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(desktopDir, 'package.json'), 'utf8'));
const unpackedDir = path.resolve(desktopDir, `../../dist/desktop/${pkg.version}/windows/win-unpacked`);
const requiredFiles = ['邻传.exe', 'ffmpeg.dll', 'resources.pak'];

for (const file of requiredFiles) {
  await access(path.join(unpackedDir, file));
}

console.log(`Windows runtime verified: ${unpackedDir}`);
