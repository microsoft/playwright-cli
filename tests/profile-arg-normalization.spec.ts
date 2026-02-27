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

import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';

const { normalizeProfileArgumentForCli } = require('../profile-arg-normalization');

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readConfigPath(args: string[]): string | undefined {
  const configEntry = args.find(arg => arg.startsWith('--config='));
  return configEntry?.slice('--config='.length);
}

test('rewrites profile directory path to user-data-dir and injects profile-directory', async () => {
  const root = createTempDir('profile-normalize-');
  const profileDir = path.join(root, 'Profile 2');
  fs.mkdirSync(profileDir, { recursive: true });

  const args = normalizeProfileArgumentForCli(['open', `--profile=${profileDir}`], {});
  expect(args).toContain(`--profile=${root}`);

  const configPath = readConfigPath(args);
  expect(configPath).toBeTruthy();
  const config = JSON.parse(fs.readFileSync(configPath!, 'utf8'));
  expect(config.browser.launchOptions.args).toContain('--profile-directory=Profile 2');
});

test('does not rewrite when browser is known non-chromium', async () => {
  const root = createTempDir('profile-normalize-firefox-');
  const profileDir = path.join(root, 'Profile 2');
  fs.mkdirSync(profileDir, { recursive: true });

  const args = normalizeProfileArgumentForCli([
    'open',
    '--browser=firefox',
    `--profile=${profileDir}`,
  ], {});

  expect(args).toEqual([
    'open',
    '--browser=firefox',
    `--profile=${profileDir}`,
  ]);
});

test('preserves existing config and appends profile-directory', async () => {
  const root = createTempDir('profile-normalize-config-');
  const profileDir = path.join(root, 'Default');
  fs.mkdirSync(profileDir, { recursive: true });

  const existingConfigPath = path.join(root, 'existing.json');
  fs.writeFileSync(existingConfigPath, JSON.stringify({
    browser: {
      browserName: 'chrome',
      launchOptions: {
        args: ['--disable-dev-shm-usage'],
      },
    },
    outputMode: 'stdout',
  }, null, 2));

  const args = normalizeProfileArgumentForCli([
    'open',
    `--profile=${profileDir}`,
    `--config=${existingConfigPath}`,
  ], {});

  expect(args).toContain(`--profile=${root}`);
  const mergedConfigPath = readConfigPath(args);
  expect(mergedConfigPath).toBeTruthy();

  const mergedConfig = JSON.parse(fs.readFileSync(mergedConfigPath!, 'utf8'));
  expect(mergedConfig.outputMode).toBe('stdout');
  expect(mergedConfig.browser.launchOptions.args).toEqual(expect.arrayContaining([
    '--disable-dev-shm-usage',
    '--profile-directory=Default',
  ]));
});
