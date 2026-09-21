import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

if (process.platform !== 'darwin') throw Error('macOS packages must be built on macOS.');

const builder = join('node_modules', '.bin', 'electron-builder');
const extra = process.argv.slice(2);
const builds = [
  ['--mac', 'zip', '--arm64', '--x64', '--publish', 'never'],
  ['--mac', 'pkg', '--arm64', '--publish', 'never'],
  ['--mac', 'pkg', '--x64', '--publish', 'never']
];

for (const args of builds) execFileSync(builder, [...args, ...extra], { stdio: 'inherit' });
