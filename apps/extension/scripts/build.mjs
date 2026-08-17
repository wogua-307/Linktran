import { cp, mkdir, rm, watch } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(appRoot, 'src');
const output = path.join(appRoot, 'dist');

async function build() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  console.log(`Extension build: ${output}`);
}

await build();
if (process.argv.includes('--watch')) {
  console.log('Watching extension sources...');
  for await (const event of watch(source, { recursive: true })) {
    if (event.filename) await build();
  }
}
