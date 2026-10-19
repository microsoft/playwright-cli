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
const { spawn } = require('child_process');

const { program } = require('playwright-core/lib/tools/cli-client/program');
const coreBundle = require('playwright-core/lib/coreBundle');
const { tools, registry } = coreBundle;
const { checkInstalledSkills, frame } = require('./skillCheck');

const packageJson = require('./package.json');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const UPDATE_CHECK_COMMANDS = new Set(['open', 'attach', 'list', 'install', 'install-browser']);

main();

async function main() {
  await checkForUpdates().catch(() => {});
  program({ embedderVersion: packageJson.version });
}

async function checkForUpdates() {
  if (process.env.NO_UPDATE_NOTIFIER || process.env.CI)
    return;

  // The check spawns npm, so keep its cost to the commands that start a workflow.
  const command = process.argv.slice(2).find(arg => !arg.startsWith('-'));
  if (!command || !UPDATE_CHECK_COMMANDS.has(command))
    return;

  const cache = readCache();
  const stale = !cache || (Date.now() - cache.lastCheck) > ONE_DAY_MS;
  if (!stale)
    return;
  writeCache({ lastCheck: Date.now() });

  if (command !== 'install')
    checkInstalledSkills();

  const latest = await fetchLatestVersion();
  if (latest && tools.compareSemver(latest, packageJson.version) > 0)
    printNotice(packageJson.version, latest);
}

// Asks npm, so that the user's registry, proxy and auth configuration is respected.
/** @returns {Promise<string | undefined>} */
function fetchLatestVersion() {
  return new Promise(resolve => {
    const child = spawn(`npm view ${packageJson.name} version --json --no-update-notifier`, {
      shell: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    child.stdout.on('data', data => stdout += data);
    // On Windows, killing the shell leaves npm running: stop listening to it
    // so that the CLI does not wait for npm before exiting.
    const timeout = setTimeout(() => {
      child.kill();
      child.unref();
      child.stdout.destroy();
      resolve(undefined);
    }, 1500);
    child.on('error', () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      try {
        const version = JSON.parse(stdout);
        resolve(code === 0 && typeof version === 'string' ? version : undefined);
      } catch {
        resolve(undefined);
      }
    });
  });
}

/**
 *
 * @param {string} current
 * @param {string} latest
 */
function printNotice(current, latest) {
  process.stderr.write('\n' + frame([
    `Update available for ${packageJson.name}: ${current} → ${latest}`,
    `Run \`npm install -g ${packageJson.name}@latest\` (global) or`,
    `\`npm install --save-dev ${packageJson.name}@latest\` (local) to update.`,
  ]) + '\n');
}

function cacheFile() {
  const dir = process.env.PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST || registry.defaultRegistryDirectory();
  return path.join(dir, 'cli-update-check.json');
}

function readCache() {
  const file = cacheFile();
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof data.lastCheck === 'number')
      return data;
  } catch {
  }
  return undefined;
}

/**
 * @param {*} data
 */
function writeCache(data) {
  const file = cacheFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch {
  }
}
