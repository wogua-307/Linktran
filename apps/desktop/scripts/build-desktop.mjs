import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktopDir, '../..');
const pkg = JSON.parse(await readFile(path.join(desktopDir, 'package.json'), 'utf8'));
const versionRoot = path.join(root, 'dist/desktop', pkg.version);
const builderCli = path.join(root, 'node_modules/electron-builder/out/cli/cli.js');
const mode = process.argv[2] || 'dir';
const rootPkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const electronVersion = String(rootPkg.devDependencies.electron).replace(/^[^0-9]*/, '');

async function cachedElectron(platform, arch) {
  const roots = process.platform === 'darwin'
    ? [path.join(os.homedir(), 'Library/Caches/electron')]
    : process.platform === 'win32'
      ? [path.join(process.env.LOCALAPPDATA || '', 'electron/Cache')]
      : [path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'electron')];
  const filename = `electron-v${electronVersion}-${platform}-${arch}.zip`;
  for (const cacheRoot of roots) {
    try {
      const entries = await readdir(cacheRoot, { recursive: true });
      const match = entries.find(entry => path.basename(entry) === filename);
      if (match) return path.join(cacheRoot, match);
    } catch { /* Electron downloads normally when no local cache exists. */ }
  }
  return '';
}

async function build(args, folder, platform, arch) {
  const output = path.join(versionRoot, folder);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const electronDist = await cachedElectron(platform, arch);
  const configArgs = [`--config.directories.output=${output}`];
  if (electronDist) configArgs.push(`--config.electronDist=${electronDist}`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [builderCli, ...args, ...configArgs], {
      cwd: desktopDir,
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`electron-builder exited with code ${code}`)));
  });
}

if (mode === 'mac') {
  await build(['--mac', '--x64'], 'mac-x64', 'darwin', 'x64');
  await build(['--mac', '--arm64'], 'mac-arm64', 'darwin', 'arm64');
} else if (mode === 'win') {
  await build(['--win', '--x64'], 'windows', 'win32', 'x64');
} else if (mode === 'dir') {
  await build(['--dir'], '.build', process.platform, process.arch);
} else {
  throw new Error(`Unknown desktop build mode: ${mode}`);
}

console.log(`Desktop build archive: ${versionRoot}`);
