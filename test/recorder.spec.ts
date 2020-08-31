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

import { registerFixture } from '@playwright/test-runner';
import { RecorderController } from '../lib/recorder/recorderController';
import './playwright.fixtures.ts';
import { Page } from 'playwright';

declare global {
	interface TestState {
		output: WritableBuffer;
	}
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

registerFixture('output', async ({ context }, runTest) => {
  const output = new WritableBuffer();
  new RecorderController(context, output);
	await runTest(output);
});

it('should click', async ({ page, output }) => {
  await setContentAndWait(page, `<button onclick="console.log('click')">Submit</button>`);

  const selector = await hoverOverElement(page, 'button');
  expect(selector).toBe('text="Submit"');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('click'),
    page.dispatchEvent('button', 'click', { detail: 1 })
  ]);
  expect(output.text()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
  expect(message.text()).toBe('click');
});

it('should fill', async ({ page, output }) => {
  await setContentAndWait(page, `<input id="input" name="name" oninput="console.log(input.value)"></input>`);

  const selector = await hoverOverElement(page, 'input');
  expect(selector).toBe('input[name="name"]');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('fill'),
    page.fill('input', 'John')
  ]);
  expect(output.text()).toContain(`
  // Fill input[name="name"]
  await page.fill('input[name="name"]', 'John');`);
  expect(message.text()).toBe('John');
});

it('should press', async ({ page, output }) => {
  await setContentAndWait(page, `<input name="name" onkeypress="console.log('press')"></input>`);

  const selector = await hoverOverElement(page, 'input');
  expect(selector).toBe('input[name="name"]');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('press'),
    page.press('input', 'Shift+Enter')
  ]);
  expect(output.text()).toContain(`
  // Press Enter with modifiers
  await page.press('input[name="name"]', 'Shift+Enter');`);
  expect(message.text()).toBe('press');
});

it('should check', async ({ page, output }) => {
  await setContentAndWait(page, `<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);

  const selector = await hoverOverElement(page, 'input');
  expect(selector).toBe('input[name="accept"]');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('check'),
    page.dispatchEvent('input', 'click', { detail: 1 })
  ]);
  await output.waitFor('check');
  expect(output.text()).toContain(`
  // Check input[name="accept"]
  await page.check('input[name="accept"]');`);
  expect(message.text()).toBe("true");
});

it('should uncheck', async ({ page, output }) => {
  await setContentAndWait(page, `<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);

  const selector = await hoverOverElement(page, 'input');
  expect(selector).toBe('input[name="accept"]');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('uncheck'),
    page.dispatchEvent('input', 'click', { detail: 1 })
  ]);
  expect(output.text()).toContain(`
  // Uncheck input[name="accept"]
  await page.uncheck('input[name="accept"]');`);
  expect(message.text()).toBe("false");
});

it('should select', async ({ page, output }) => {
  await setContentAndWait(page, '<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');

  const selector = await hoverOverElement(page, 'select');
  expect(selector).toBe('select[id="age"]');

  const [message] = await Promise.all([
    page.waitForEvent('console'),
    output.waitFor('select'),
    page.selectOption('select', '2')
  ]);
  expect(output.text()).toContain(`
  // Select select[id="age"]
  await page.selectOption('select[id="age"]', '2');`);
  expect(message.text()).toBe("2");
});

it('should await popup', async ({ page, output }) => {
  await setContentAndWait(page, '<a target=_blank rel=noopener href="about:blank">link</a>');

  const selector = await hoverOverElement(page, 'a');
  expect(selector).toBe('text="link"');

  const [popup] = await Promise.all([
    page.context().waitForEvent('page'),
    output.waitFor('waitForEvent'),
    page.dispatchEvent('a', 'click', { detail: 1 })
  ]);
  expect(output.text()).toContain(`
  // Click text="link"
  const [popup1] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('text="link"');
  ]);`);
  expect(popup.url()).toBe('about:blank');
});

it('should await navigation', async ({ page, output }) => {
  await setContentAndWait(page, `<a onclick="setTimeout(() => window.location.href='about:blank#foo', 1000)">link</a>`);

  const selector = await hoverOverElement(page, 'a');
  expect(selector).toBe('text="link"');

  await Promise.all([
    page.waitForNavigation(),
    output.waitFor('waitForNavigation'),
    page.dispatchEvent('a', 'click', { detail: 1 })
  ]);
  expect(output.text()).toContain(`
  // Click text="link"
  await Promise.all([
    page.waitForNavigation(/*{ url: 'about:blank#foo' }*/),
    page.click('text="link"')
  ]);`);
  expect(page.url()).toContain('about:blank#foo');
});

async function setContentAndWait(page: Page, content: string) {
  let callback;
  const result = new Promise(f => callback = f);
  await page.goto('about:blank');
  await page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => callback(arg));
  await Promise.all([
    result,
    page.setContent(content)
  ]);
}

async function hoverOverElement(page: Page, selector: string): Promise<string> {
  let callback: (selector: string) => void;
  const result = new Promise<string>(f => callback = f);
  await page.exposeBinding('_highlightUpdatedForTest', (source, arg) => callback(arg))
  const [ generatedSelector ] = await Promise.all([
    result,
    page.dispatchEvent(selector, 'mousemove', { detail: 1 })
  ]);
  return generatedSelector;
}
