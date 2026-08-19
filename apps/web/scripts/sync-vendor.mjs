import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const vendorDir = path.join(root, 'public/vendor');
await mkdir(vendorDir, { recursive: true });
await Promise.all([
  copyFile(path.join(root, 'node_modules/marked/lib/marked.umd.js'), path.join(vendorDir, 'marked.umd.js')),
  copyFile(path.join(root, 'node_modules/dompurify/dist/purify.min.js'), path.join(vendorDir, 'purify.min.js')),
  copyFile(path.join(root, 'node_modules/turndown/lib/turndown.browser.umd.js'), path.join(vendorDir, 'turndown.umd.js')),
  copyFile(path.join(root, 'node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js'), path.join(vendorDir, 'turndown-plugin-gfm.js')),
  copyFile(path.join(root, 'node_modules/lucide/dist/umd/lucide.min.js'), path.join(vendorDir, 'lucide.min.js'))
]);
console.log(`Web vendor files: ${vendorDir}`);
