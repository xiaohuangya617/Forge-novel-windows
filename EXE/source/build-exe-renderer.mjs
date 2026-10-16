import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.join(here, 'web-source', 'AI小说生成器9.0源码');
const buildScript = path.join(sourceRoot, 'build.mjs');
const outputPath = path.join(here, 'electron', 'resources', 'app', 'index.html');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
execFileSync(process.execPath, [buildScript, outputPath], { cwd: here, stdio: 'inherit' });
console.log(`built Electron renderer: ${outputPath}`);

