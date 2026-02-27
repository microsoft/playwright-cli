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

const fs = require('fs');
const os = require('os');
const path = require('path');

function readArgValue(args, key) {
  const inlinePrefix = `${key}=`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === key)
      return { value: args[i + 1], index: i, inline: false };
    if (args[i].startsWith(inlinePrefix)) {
      return {
        value: args[i].slice(inlinePrefix.length),
        index: i,
        inline: true,
      };
    }
  }
  return null;
}

function writeArgValue(args, details, key, value) {
  if (details.inline)
    args[details.index] = `${key}=${value}`;
  else
    args[details.index + 1] = value;
}

function looksLikePath(value) {
  return path.isAbsolute(value) || value.startsWith('./') || value.startsWith('../') || value.includes(path.sep);
}

function looksLikeChromeProfileDir(dirPath) {
  const profileName = path.basename(dirPath);
  if (/^(Default|Profile\s+\d+|Guest Profile|System Profile)$/.test(profileName))
    return true;
  return fs.existsSync(path.join(dirPath, 'Preferences'));
}

function browserIsKnownNonChromium(args, existingConfig, env) {
  const browserArg = readArgValue(args, '--browser');
  const explicitBrowser = browserArg?.value || existingConfig?.browser?.browserName || env.PLAYWRIGHT_MCP_BROWSER;
  return ['firefox', 'webkit'].includes(explicitBrowser);
}

function mergeConfigWithProfileDirectory(configPath, profileDirectory) {
  const resolvedConfigPath = configPath ? path.resolve(configPath) : null;
  const baseConfig = resolvedConfigPath && fs.existsSync(resolvedConfigPath)
    ? JSON.parse(fs.readFileSync(resolvedConfigPath, 'utf8'))
    : {};

  const browser = baseConfig.browser || {};
  const launchOptions = browser.launchOptions || {};
  const args = Array.isArray(launchOptions.args) ? [...launchOptions.args] : [];
  if (!args.some(arg => typeof arg === 'string' && arg.startsWith('--profile-directory=')))
    args.push(`--profile-directory=${profileDirectory}`);

  const mergedConfig = {
    ...baseConfig,
    browser: {
      ...browser,
      launchOptions: {
        ...launchOptions,
        args,
      },
    },
  };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-profile-'));
  const mergedConfigPath = path.join(tempDir, 'cli.config.json');
  fs.writeFileSync(mergedConfigPath, JSON.stringify(mergedConfig, null, 2));
  return mergedConfigPath;
}

function normalizeProfileArgumentForCli(args, env = process.env) {
  const profileArg = readArgValue(args, '--profile');
  if (!profileArg?.value || !looksLikePath(profileArg.value))
    return args;

  const providedPath = path.resolve(profileArg.value);
  if (!looksLikeChromeProfileDir(providedPath))
    return args;

  const configArg = readArgValue(args, '--config');
  const existingConfigPath = configArg?.value;
  const resolvedConfigPath = existingConfigPath ? path.resolve(existingConfigPath) : null;
  const existingConfig = resolvedConfigPath && fs.existsSync(resolvedConfigPath)
    ? JSON.parse(fs.readFileSync(resolvedConfigPath, 'utf8'))
    : {};

  if (browserIsKnownNonChromium(args, existingConfig, env))
    return args;

  const userDataDir = path.dirname(providedPath);
  const profileDirectory = path.basename(providedPath);
  writeArgValue(args, profileArg, '--profile', userDataDir);

  const mergedConfigPath = mergeConfigWithProfileDirectory(existingConfigPath, profileDirectory);
  if (configArg)
    writeArgValue(args, configArg, '--config', mergedConfigPath);
  else
    args.push(`--config=${mergedConfigPath}`);

  return args;
}

module.exports = {
  normalizeProfileArgumentForCli,
};
