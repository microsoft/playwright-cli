#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const fs = require('fs');
const path = require('path');

const { program } = require('playwright-core/lib/tools/cli-client/program');
const coreBundle = require('playwright-core/lib/coreBundle');
const { tools, registry } = coreBundle;

const packageJson = require('./package.json');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

main();

async function main() {
  await notifyAboutUpdate().catch(() => {});
  program({ embedderVersion: packageJson.version });
}

async function notifyAboutUpdate() {
  if (process.env.NO_UPDATE_NOTIFIER || process.env.CI)
    return;

  const cache = readCache();
  const stale = !cache || (Date.now() - cache.lastCheck) > ONE_DAY_MS;
  if (!stale)
    return;

  const latest = await fetchLatestVersion();
  if (!latest)
    return;
  writeCache({ lastCheck: Date.now(), latestVersion: latest });

  if (tools.compareSemver(latest, packageJson.version) > 0)
    printNotice(packageJson.version, latest);
}

async function fetchLatestVersion() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`https://registry.npmjs.org/${packageJson.name}/latest`, { signal: controller.signal });
      if (!res.ok)
        return undefined;
      const json = await res.json();
      return typeof json.version === 'string' ? json.version : undefined;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return undefined;
  }
}

/**
 * 
 * @param {string} current 
 * @param {string} latest 
 */
function printNotice(current, latest) {
  const lines = [
    `Update available for ${packageJson.name}: ${current} → ${latest}`,
    `Run \`npm install -g ${packageJson.name}@latest\` (global) or`,
    `\`npm install ${packageJson.name}@latest\` (local) to update.`,
  ];
  const width = Math.max(...lines.map(line => line.length));
  const top = `╭${'─'.repeat(width + 2)}╮`;
  const bottom = `╰${'─'.repeat(width + 2)}╯`;
  process.stderr.write('\n' + top + '\n');
  for (const line of lines)
    process.stderr.write(`│ ${line.padEnd(width)} │\n`);
  process.stderr.write(bottom + '\n\n');
}

function cacheFile() {
  return path.join(registry.defaultRegistryDirectory, 'cli-update-check.json');
}

function readCache() {
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    if (typeof data.lastCheck === 'number' && typeof data.latestVersion === 'string')
      return data;
  } catch {
  }
  return undefined;
}

/**
 * @param {*} data 
 */
function writeCache(data) {
  try {
    const file = cacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch {
  }
}
