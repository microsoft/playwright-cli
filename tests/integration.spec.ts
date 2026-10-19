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
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { test as baseTest, expect } from '@playwright/test';
import type { AddressInfo } from 'net';

type CliResult = {
  output: string;
  error: string;
  exitCode: number | null;
};

type NpmRegistry = {
  url: string;
  status: number;
  hang: boolean;
  requests: string[];
};

const test = baseTest.extend<{ npmRegistry: NpmRegistry }>({
  npmRegistry: async ({}, use) => {
    const registry: NpmRegistry = { url: '', status: 200, hang: false, requests: [] };
    const server = http.createServer((req, res) => {
      registry.requests.push(req.url!);
      if (registry.hang)
        return;
      res.statusCode = registry.status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        'name': '@playwright/cli',
        'dist-tags': { latest: '99.0.0' },
        'versions': { '99.0.0': { name: '@playwright/cli', version: '99.0.0' } },
      }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    registry.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await use(registry);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  },
});

// Enables the update check and points npm at the test registry, isolated from
// the npm config of the machine running the tests.
function updateCheckEnv(npmRegistry: NpmRegistry): Record<string, string> {
  return {
    'CI': '',
    'NO_UPDATE_NOTIFIER': '',
    'npm_config_registry': npmRegistry.url,
    'npm_config_@playwright:registry': '',
    'npm_config_userconfig': test.info().outputPath('user-npmrc'),
    'npm_config_globalconfig': test.info().outputPath('global-npmrc'),
    'npm_config_cache': test.info().outputPath('npm-cache'),
  };
}

async function runCli(args: string[], env: Record<string, string> = {}): Promise<CliResult> {
  const cliPath = path.join(__dirname, '../playwright-cli.js');

  return new Promise<CliResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const childProcess = spawn(process.execPath, [cliPath, ...args], {
      env: {
        ...process.env,
        PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST: test.info().outputPath(),
        ...env,
      },
      cwd: test.info().outputPath(),
    });

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      resolve({
        output: stdout.trim(),
        error: stderr.trim(),
        exitCode: code,
      });
    });

    childProcess.on('error', reject);
  });
}

test('open data URL', async ({}) => {
  expect(await runCli(['open', 'data:text/html,hello', '--persistent'])).toEqual(expect.objectContaining({
    output: expect.stringContaining('hello'),
    exitCode: 0,
  }));

  expect(await runCli(['delete-data'])).toEqual(expect.objectContaining({
    output: expect.stringContaining('Deleted user data for'),
    exitCode: 0,
  }));
});

test('warns when installed skill is out of date', async ({ npmRegistry }) => {
  expect(await runCli(['install', '--skills'], { NO_UPDATE_NOTIFIER: '1' })).toEqual(expect.objectContaining({
    exitCode: 0,
  }));

  const skillFile = path.join(test.info().outputPath(), '.claude', 'skills', 'playwright-cli', 'SKILL.md');
  fs.appendFileSync(skillFile, 'x');

  const env = updateCheckEnv(npmRegistry);
  expect(await runCli(['list'], env)).toEqual(expect.objectContaining({
    error: expect.stringContaining('does not match the tool version'),
  }));

  expect(await runCli(['list'], env)).toEqual(expect.objectContaining({
    error: expect.not.stringContaining('does not match the tool version'),
  }));
});

test('does not warn when installed skill only differs in line endings', async ({ npmRegistry }) => {
  expect(await runCli(['install', '--skills'], { NO_UPDATE_NOTIFIER: '1' })).toEqual(expect.objectContaining({
    exitCode: 0,
  }));

  const skillFile = path.join(test.info().outputPath(), '.claude', 'skills', 'playwright-cli', 'SKILL.md');
  fs.writeFileSync(skillFile, fs.readFileSync(skillFile, 'utf8').replace(/\n/g, '\r\n'));

  expect(await runCli(['list'], updateCheckEnv(npmRegistry))).toEqual(expect.objectContaining({
    error: expect.not.stringContaining('does not match the tool version'),
  }));
});

test('caches the update check in the default registry directory', async ({ npmRegistry }) => {
  // Redirect the home/cache directories so the real user cache is untouched, and
  // leave PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST empty so the default path is used.
  const home = test.info().outputPath('home');
  fs.mkdirSync(home, { recursive: true });
  const env = {
    ...updateCheckEnv(npmRegistry),
    PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST: '',
    HOME: home,
    USERPROFILE: home,
    XDG_CACHE_HOME: path.join(home, '.cache'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
  };

  expect(await runCli(['list'], env)).toEqual(expect.objectContaining({ exitCode: 0 }));

  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory())
        walk(full);
      else if (entry.name === 'cli-update-check.json')
        found.push(full);
    }
  };
  walk(home);

  expect(found).toHaveLength(1);
  expect(JSON.parse(fs.readFileSync(found[0], 'utf8')).lastCheck).toEqual(expect.any(Number));
});

test('update check asks npm for the latest version on setup commands only', async ({ npmRegistry }) => {
  const env = updateCheckEnv(npmRegistry);
  expect(await runCli(['--version'], env)).toEqual(expect.objectContaining({
    error: '',
    exitCode: 0,
  }));
  expect(npmRegistry.requests).toEqual([]);

  expect(await runCli(['list'], env)).toEqual(expect.objectContaining({
    error: expect.stringContaining('Update available for @playwright/cli'),
    exitCode: 0,
  }));
  expect(npmRegistry.requests).toEqual(['/@playwright%2fcli']);
});

test('update check on install does not warn about the skills being installed', async ({ npmRegistry }) => {
  expect(await runCli(['install', '--skills'], { NO_UPDATE_NOTIFIER: '1' })).toEqual(expect.objectContaining({
    exitCode: 0,
  }));

  const skillFile = path.join(test.info().outputPath(), '.claude', 'skills', 'playwright-cli', 'SKILL.md');
  fs.appendFileSync(skillFile, 'x');

  const result = await runCli(['install', '--skills'], updateCheckEnv(npmRegistry));
  expect(result.exitCode).toBe(0);
  expect(result.error).toContain('Update available for @playwright/cli');
  expect(result.error).not.toContain('does not match the tool version');
  expect(npmRegistry.requests).toEqual(['/@playwright%2fcli']);
});

test('update check uses the scoped registry from project .npmrc', async ({ npmRegistry }) => {
  fs.writeFileSync(test.info().outputPath('package.json'), '{}');
  fs.writeFileSync(test.info().outputPath('.npmrc'), `@playwright:registry=${npmRegistry.url}/scoped/`);

  expect(await runCli(['list'], updateCheckEnv(npmRegistry))).toEqual(expect.objectContaining({
    error: expect.stringContaining('Update available for @playwright/cli'),
    exitCode: 0,
  }));
  expect(npmRegistry.requests).toEqual(['/scoped/@playwright%2fcli']);
});

test('update check failure is silent', async ({ npmRegistry }) => {
  npmRegistry.status = 401;
  expect(await runCli(['list'], updateCheckEnv(npmRegistry))).toEqual(expect.objectContaining({
    error: '',
    exitCode: 0,
  }));
  expect(npmRegistry.requests).toEqual(['/@playwright%2fcli']);
});

test('update check does not wait for a hanging registry', async ({ npmRegistry }) => {
  npmRegistry.hang = true;
  const start = Date.now();
  expect(await runCli(['list'], updateCheckEnv(npmRegistry))).toEqual(expect.objectContaining({
    error: '',
    exitCode: 0,
  }));
  expect(Date.now() - start).toBeLessThan(10000);
});
