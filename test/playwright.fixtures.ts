/**
 * Copyright Microsoft Corporation. All rights reserved.
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
import * as playwright from 'playwright';
import { parameters, fixtures as baseFixtures} from '@playwright/test-runner';
import { ScriptController } from '../lib/scriptController';

type WorkerFixtures = {
  browserType: playwright.BrowserType<playwright.Browser>;
  browserName: string;
  browser: playwright.Browser;
  httpServer: httpServer;
};

type TestFixtures = {
  contextWrapper: { context: playwright.BrowserContext, output: WritableBuffer };
  page: playwright.Page;
  recorder: Recorder;
};

export const fixtures = baseFixtures.extend<WorkerFixtures, TestFixtures>();
export const it = fixtures.it;
export const describe = fixtures.describe;
export const expect = fixtures.expect;

interface httpServer {
  setHandler: (handler: http.RequestListener) => void
  PREFIX: string
}

export function isChromium() {
  return parameters.browserName === 'chromium';
}

export function isMac() {
  return process.platform === 'darwin';
}

fixtures.registerWorkerFixture('browserType', async ({ browserName }, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

fixtures.registerWorkerFixture('browserName', async ({ }, test) => {
  await test(process.env.BROWSER || 'chromium');
});

fixtures.registerWorkerFixture('browser', async ({ browserType }, test) => {
  const browser = await browserType.launch({
    headless: !process.env.HEADFUL
  });
  await test(browser);
  await browser.close();
});

fixtures.registerWorkerFixture('httpServer', async ({parallelIndex}, runTest) => {
  let handler = (req: http.IncomingMessage, res: http.ServerResponse) => res.end()
  const port = 8907 + parallelIndex * 2;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse)=> handler(req, res)).listen(port);
  await runTest({
    setHandler: newHandler => handler = newHandler,
    PREFIX: `http://127.0.0.1:${port}`,
  })
  server.close()
})

fixtures.registerFixture('contextWrapper', async ({ browser }, runTest, info) => {
  const context = await browser.newContext();
  const output = new WritableBuffer();
  new ScriptController('chromium', {}, {}, context, output, true);
  await runTest({ context, output });
  await context.close();
});

fixtures.registerFixture('recorder', async ({ contextWrapper }, runTest) => {
  const page = await contextWrapper.context.newPage();
  if (process.env.PWCONSOLE)
    page.on('console', console.log);
  await runTest(new Recorder(page, contextWrapper.output));
  await page.close();
});

fixtures.registerFixture('page', async ({ recorder }, runTest) => {
  await runTest(recorder.page);
});

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
    const pattern = [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|');
    return this.data().replace(new RegExp(pattern, 'g'), '');
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
    let callback;
    const result = new Promise(f => callback = f);
    await this.page.goto(url);
    await this.page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => callback(arg));
    await Promise.all([
      result,
      this.page.setContent(content)
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
