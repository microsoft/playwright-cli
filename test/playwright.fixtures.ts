/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as http from 'http'
import { Writable } from 'stream';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as playwright from 'playwright';
import { fixtures as baseFixtures } from '@playwright/test-runner';
import { ScriptController } from '../src/scriptController';
import { Page } from 'playwright';
import { TerminalOutput } from '../src/codegen/outputs';
import { JavaScriptLanguageGenerator } from '../src/codegen/languages';

type Parameters = {
  browserName: string;
}

type WorkerFixtures = {
  browserType: playwright.BrowserType<playwright.Browser>;
  browser: playwright.Browser;
  httpServer: httpServer;
};

type TestFixtures = {
  contextWrapper: { context: playwright.BrowserContext, output: WritableBuffer };
  page: playwright.Page;
  recorder: Recorder;
  runCLI: (args: string[]) => CLIMock;
};

export const fixtures = baseFixtures
    .declareParameters<Parameters>()
    .declareWorkerFixtures<WorkerFixtures>()
    .declareTestFixtures<TestFixtures>();

interface httpServer {
  setHandler: (handler: http.RequestListener) => void
  PREFIX: string
}

export function isChromium(browserName: string): boolean;
export function isChromium(parameters: { browserName: string }): boolean;
export function isChromium(parameters: string | { browserName: string }) {
  return (typeof parameters === 'string' ? parameters : parameters.browserName) === 'chromium';
}

export function isFirefox(browserName: string): boolean;
export function isFirefox(parameters: { browserName: string }): boolean;
export function isFirefox(parameters: string | { browserName: string }) {
  return (typeof parameters === 'string' ? parameters : parameters.browserName) === 'firefox';
}

export function isWebKit(browserName: string): boolean;
export function isWebKit(parameters: { browserName: string }): boolean;
export function isWebKit(parameters: string | { browserName: string }) {
  return (typeof parameters === 'string' ? parameters : parameters.browserName) === 'webkit';
}

export function isMac() {
  return process.platform === 'darwin';
}

fixtures.defineParameter('browserName', 'Browser type', 'chromium');

fixtures.defineWorkerFixture('browserType', async ({ browserName }, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

fixtures.defineWorkerFixture('browser', async ({ browserType }, test) => {
  const browser = await browserType.launch({
    headless: !process.env.HEADFUL
  });
  await test(browser);
  await browser.close();
});

fixtures.defineWorkerFixture('httpServer', async ({parallelIndex}, runTest) => {
  let handler = (req: http.IncomingMessage, res: http.ServerResponse) => res.end()
  const port = 8907 + parallelIndex * 2;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse)=> handler(req, res)).listen(port);
  await runTest({
    setHandler: newHandler => handler = newHandler,
    PREFIX: `http://127.0.0.1:${port}`,
  })
  server.close()
})

fixtures.defineTestFixture('contextWrapper', async ({ browser }, runTest, info) => {
  const context = await browser.newContext();
  const outputBuffer = new WritableBuffer();
  const output = new TerminalOutput(outputBuffer as any as Writable)
  const languageGenerator = new JavaScriptLanguageGenerator(output)
  new ScriptController('chromium', {}, {}, context, output, languageGenerator, true);
  await runTest({ context, output: outputBuffer });
  await context.close();
});

fixtures.defineTestFixture('recorder', async ({ contextWrapper }, runTest) => {
  const page = await contextWrapper.context.newPage();
  if (process.env.PWCONSOLE)
    page.on('console', console.log);
  await runTest(new Recorder(page, contextWrapper.output));
  await page.close();
});

fixtures.defineTestFixture('page', async ({ recorder }, runTest) => {
  await runTest(recorder.page);
});

function removeAnsiColors(input: string): string {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return input.replace(new RegExp(pattern, 'g'), '');
}

class WritableBuffer {
  lines: string[];
  private _callback: () => void;
  _text: string;

  constructor() {
    this.lines = [];
  }

  write(chunk: string) {
    if (chunk === '\u001B[F\u001B[2K') {
      this.lines.pop();
      return;
    }
    this.lines.push(...chunk.split('\n'));
    if (this._callback && chunk.includes(this._text))
      this._callback();
  }

  _waitFor(text: string): Promise<void> {
    if (this.lines.join('\n').includes(text))
      return Promise.resolve();
    this._text = text;
    return new Promise(f => this._callback = f);
  }

  data() {
    return this.lines.join('\n');
  }

  text() {
    return removeAnsiColors(this.data())
  }
}

class Recorder {
  page: playwright.Page;
  _output: WritableBuffer;
  _highlightCallback: Function
  _highlightInstalled: boolean
  _actionReporterInstalled: boolean
  _actionPerformedCallback: Function

  constructor(page: playwright.Page, output: WritableBuffer) {
    this.page = page;
    this._output = output;
    this._highlightCallback = () => { };
    this._highlightInstalled = false;
    this._actionReporterInstalled = false;
    this._actionPerformedCallback = () => { };
  }

  async setContentAndWait(content: string, url: string = 'about:blank') {
    await this.setPageContentAndWait(this.page, content, url);
  }

  async setPageContentAndWait(page: Page, content: string, url: string = 'about:blank') {
    let callback;
    const result = new Promise(f => callback = f);
    await page.goto(url);
    await page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => callback(arg));
    await Promise.all([
      result,
      page.setContent(content)
    ]);
  }

  async waitForOutput(text: string): Promise<void> {
    await this._output._waitFor(text);
  }

  output(): string {
    return this._output.text();
  }

  async waitForHighlight(action: () => Promise<void>): Promise<string> {
    if (!this._highlightInstalled) {
      this._highlightInstalled = true;
      await this.page.exposeBinding('_highlightUpdatedForTest', (source, arg) => this._highlightCallback(arg));
    }
    const [ generatedSelector ] = await Promise.all([
      new Promise<string>(f => this._highlightCallback = f),
      action()
    ]);
    return generatedSelector;
  }

  async waitForActionPerformed(): Promise<void> {
    if (!this._actionReporterInstalled) {
      this._actionReporterInstalled = true;
      await this.page.exposeBinding('_actionPerformedForTest', (source, arg) => this._actionPerformedCallback(arg));
    }
    await new Promise(f => this._actionPerformedCallback = f);
  }

  async hoverOverElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.dispatchEvent(selector, 'mousemove', { detail: 1 }));
  }

  async focusElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.focus(selector));
  }
}

fixtures.defineTestFixture('runCLI', async ({  }, runTest, info) => {
  let cli: CLIMock
  const cliFactory = (args: string[]) => {
    cli = new CLIMock(args);
    return cli
  }
  await runTest(cliFactory);
  cli.kill()
});

class CLIMock {
  private process: ChildProcessWithoutNullStreams
  private lines: string[]
  private waitForText: string
  private waitForCallback: () => void;
  exited: Promise<number>
  constructor(args: string[]) {
    this.lines = []
    this.process = spawn('node', [
      path.join(__dirname, '..', 'lib', 'cli.js'),
      ...args
    ], {
      env: {
        ...process.env,
        PWCLI_EXIT_FOR_TEST: '1'
      }
    });
    this.process.stdout.on('data', line => {
      this.lines.push(removeAnsiColors(line.toString()));
      if (this.waitForCallback && this.lines.join('\n').includes(this.waitForText))
        this.waitForCallback()
    })
    this.exited = new Promise(r => this.process.on('exit', r))
  }
  async waitFor(text: string): Promise<void> {
    if (this.lines.join('\n').includes(text))
      return Promise.resolve();
    this.waitForText = text;
    return new Promise(f => this.waitForCallback = f);
  }
  text() {
    return removeAnsiColors(this.lines.join('\n'))
  }
  kill() {
    this.process.kill()
  }
}