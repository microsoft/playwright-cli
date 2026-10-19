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
const os = require('os');
const path = require('path');

const { program } = require('playwright-core/lib/tools/cli-client/program');
const coreBundle = require('playwright-core/lib/coreBundle');
const { tools, registry } = coreBundle;
const { checkInstalledSkills, frame } = require('./skillCheck');

const packageJson = require('./package.json');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

main();

async function main() {
  await checkForUpdates().catch(() => {});
  program({ embedderVersion: packageJson.version });
}

async function checkForUpdates() {
  if (process.env.NO_UPDATE_NOTIFIER || process.env.CI)
    return;

  const cache = readCache();
  const stale = !cache || (Date.now() - cache.lastCheck) > ONE_DAY_MS;
  if (!stale)
    return;
  writeCache({ lastCheck: Date.now() });

  const command = process.argv.slice(2).find(arg => !arg.startsWith('-'));
  if (command !== 'install')
    checkInstalledSkills();

  const latest = await fetchLatestVersion();
  if (latest && tools.compareSemver(latest, packageJson.version) > 0)
    printNotice(packageJson.version, latest);
}

async function fetchLatestVersion() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const url = npmRegistry().replace(/\/?$/, '/') + packageJson.name.replace('/', '%2f') + '/latest';
      const res = await fetch(url, { signal: controller.signal });
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

// Resolves the registry npm would use for this package: the scoped registry wins
// over the default one, each looked up in env, project, user and global npmrc.
function npmRegistry() {
  const env = npmEnvConfig();
  const configs = [env, ...npmrcFiles(env).map(readNpmrc)];
  const scope = packageJson.name.split('/')[0];
  for (const key of [`${scope}:registry`, 'registry']) {
    for (const config of configs) {
      if (config[key])
        return config[key];
    }
  }
  return 'https://registry.npmjs.org/';
}

function npmEnvConfig() {
  /** @type {Record<string, string>} */
  const config = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value && /^npm_config_/i.test(name))
      config[name.substring('npm_config_'.length).toLowerCase()] = value;
  }
  return config;
}

/**
 * @param {Record<string, string>} env
 */
function npmrcFiles(env) {
  const nodeDir = path.dirname(process.execPath);
  const globalPrefix = env.prefix || process.env.PREFIX || (process.platform === 'win32' ? nodeDir : path.dirname(nodeDir));
  return [
    path.join(npmProjectDir(), '.npmrc'),
    env.userconfig || path.join(os.homedir(), '.npmrc'),
    env.globalconfig || path.join(globalPrefix, 'etc', 'npmrc'),
  ];
}

function npmProjectDir() {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'node_modules')))
      return dir;
    if (path.dirname(dir) === dir)
      return process.cwd();
  }
}

/**
 * @param {string} file
 */
function readNpmrc(file) {
  /** @type {Record<string, string>} */
  const config = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([^#;=\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (match)
        config[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
    }
  } catch {
  }
  return config;
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
