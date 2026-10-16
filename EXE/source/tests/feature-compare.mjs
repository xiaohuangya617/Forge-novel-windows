import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oldHtml = fs.readFileSync(path.join(root, 'baseline', 'old-exe', 'index.html'), 'utf8');
const currentHtml = fs.readFileSync(path.join(root, 'electron', 'resources', 'app', 'index.html'), 'utf8');
const oldMain = fs.readFileSync(path.join(root, 'baseline', 'old-exe', 'main.js'), 'utf8');
const currentMain = fs.readFileSync(path.join(root, 'electron', 'resources', 'app', 'main.js'), 'utf8');
const oldPreload = fs.readFileSync(path.join(root, 'baseline', 'old-exe', 'preload.js'), 'utf8');
const currentPreload = fs.readFileSync(path.join(root, 'electron', 'resources', 'app', 'preload.js'), 'utf8');
const ids = html => new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]));
const buttons = html => new Set([...html.matchAll(/<button\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]));
const oldIds = ids(oldHtml), currentIds = ids(currentHtml);
const oldButtons = buttons(oldHtml), currentButtons = buttons(currentHtml);
const missing = set => [...set].filter(x => !currentIds.has(x));
const missingButtons = [...oldButtons].filter(x => !currentButtons.has(x));
const currentOnly = [...currentIds].filter(x => !oldIds.has(x));
const channels = source => new Set([...source.matchAll(/(?:ipcMain\.(?:handle|on)|ipcRenderer\.(?:invoke|send|on))\(\s*["']([^"']+)["']/g)].map(m => m[1]));
const bridgeKeys = source => {
  const body = source.match(/exposeInMainWorld\(\s*["']novelData["']\s*,\s*\{([\s\S]*?)\}\s*\);/);
  return body ? [...body[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g)].map(m => m[1]) : [];
};
const oldChannels = channels(oldMain + oldPreload), currentChannels = channels(currentMain + currentPreload);
const oldBridge = new Set(bridgeKeys(oldPreload)), currentBridge = new Set(bridgeKeys(currentPreload));
const report = {
  version: '9.0',
  old: { ids: oldIds.size, buttons: oldButtons.size },
  current: { ids: currentIds.size, buttons: currentButtons.size },
  missingIds: missing(oldIds),
  missingButtons,
  currentOnlyIds: currentOnly,
  ipc: {
    oldChannels: [...oldChannels],
    currentChannels: [...currentChannels],
    missingChannels: [...oldChannels].filter(x => !currentChannels.has(x)),
    oldBridgeKeys: [...oldBridge],
    currentBridgeKeys: [...currentBridge],
    missingBridgeKeys: [...oldBridge].filter(x => !currentBridge.has(x))
  },
  dialogCoverage: ['promptModal', 'confirmModal', 'secondInstanceModal'].map(id => ({ id, present: currentIds.has(id) })),
  notes: missing(oldIds).length === 0 && missingButtons.length === 0 ? ['旧 EXE DOM 功能入口已全部保留或由 9.0 新入口替代。'] : ['仍有旧 EXE DOM 入口未覆盖，请继续处理。']
};
const out = process.env.FEATURE_COMPARE_OUT ? path.resolve(process.env.FEATURE_COMPARE_OUT) : path.join(root, 'tests', '_tmp', 'feature-compare.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
if (report.missingIds.length || report.missingButtons.length || report.ipc.missingChannels.length || report.ipc.missingBridgeKeys.length) process.exitCode = 1;
