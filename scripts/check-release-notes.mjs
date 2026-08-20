import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const heading = `## [${pkg.version}]`;

if (!changelog.includes(heading)) {
  console.error(`CHANGELOG.md 缺少当前版本章节：${heading}`);
  process.exit(1);
}

console.log(`Release notes verified: ${pkg.version}`);
