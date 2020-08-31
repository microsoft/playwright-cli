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

import * as playwright from 'playwright';
import { registerFixture, registerWorkerFixture } from '@playwright/test-runner';
import { RecorderController } from '../lib/recorder/recorderController';
import { Page } from 'playwright';

declare global {
  interface WorkerState {
    browserType: playwright.BrowserType<playwright.Browser>;
    browserName: string;
    browser: playwright.Browser;
  }
  interface TestState {
    contextWrapper: { context: playwright.BrowserContext, output: WritableBuffer };
    pageWrapper: PageWrapper;
  }
}

registerWorkerFixture('browserType', async ({ browserName }, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

registerWorkerFixture('browserName', async ({ }, test) => {
  await test('chromium');
});

registerWorkerFixture('browser', async ({ browserType }, test) => {
  const browser = await browserType.launch();
  await test(browser);
  await browser.close();
});

registerFixture('contextWrapper', async ({ browser }, runTest, info) => {
  const context = await browser.newContext();
  const output = new WritableBuffer();
  new RecorderController(context, output);
  await runTest({ context, output });
  await context.close();
});

registerFixture('pageWrapper', async ({ contextWrapper }, runTest) => {
  const page = await contextWrapper.context.newPage();
  await runTest(new PageWrapper(page, contextWrapper.output));
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

  waitFor(text: string): Promise<void> {
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

class PageWrapper {
  page: playwright.Page;
  output: WritableBuffer;

  constructor(page: Page, output: WritableBuffer) {
    this.page = page;
    this.output = output;
  }

  async setContentAndWait(content: string) {
    let callback;
    const result = new Promise(f => callback = f);
    await this.page.goto('about:blank');
    await this.page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => callback(arg));
    await Promise.all([
      result,
      this.page.setContent(content)
    ]);
  }

  async hoverOverElement(selector: string): Promise<string> {
    let callback: (selector: string) => void;
    const result = new Promise<string>(f => callback = f);
    await this.page.exposeBinding('_highlightUpdatedForTest', (source, arg) => callback(arg))
    const [ generatedSelector ] = await Promise.all([
      result,
      this.page.dispatchEvent(selector, 'mousemove', { detail: 1 })
    ]);
    return generatedSelector;
  }
}
