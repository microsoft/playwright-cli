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
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { test, expect } from '@playwright/test';

type CliResult = {
  output: string;
  error: string;
  exitCode: number | null;
};

async function runCli(configPath: string, ...args: string[]): Promise<CliResult> {
  const cliPath = path.join(__dirname, '../playwright-cli.js');

  return new Promise<CliResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const childProcess = spawn(process.execPath, [cliPath, '--config', configPath, ...args], {
      env: {
        ...process.env,
        PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST: test.info().outputPath(),
      },
      cwd: test.info().outputPath(),
    });

    childProcess.stdout?.on('data', (data) => { stdout += data.toString(); });
    childProcess.stderr?.on('data', (data) => { stderr += data.toString(); });
    childProcess.on('close', (code) => { resolve({ output: stdout.trim(), error: stderr.trim(), exitCode: code }); });
    childProcess.on('error', reject);
  });
}

async function startPlaywrightServer(port: number): Promise<ChildProcess> {
  const playwrightCoreBin = require.resolve('playwright/package.json')
      .replace('package.json', 'cli.js');

  const server = spawn(process.execPath, [playwrightCoreBin, 'run-server', '--port', String(port), '--host', '127.0.0.1']);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Playwright server on port ${port} did not start`)), 10000);
    const onData = (data: Buffer) => {
      if (data.toString().includes('Listening on')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout?.on('data', onData);
    server.stderr?.on('data', onData);
    server.on('error', reject);
  });

  return server;
}

test('open data URL via remoteEndpoint', async ({}) => {
  const port = 39300 + Math.floor(Math.random() * 600);
  const server = await startPlaywrightServer(port);

  const configPath = path.join(test.info().outputPath(), 'cli.config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    browser: {
      remoteEndpoint: `ws://127.0.0.1:${port}`,
      launchOptions: { chromiumSandbox: false },
    },
  }));

  try {
    const result = await runCli(configPath, 'open', '--browser=chromium', 'data:text/html,hello');
    expect(result.output).toContain('hello');
    expect(result.exitCode).toBe(0);
  } finally {
    server.kill();
  }
});
