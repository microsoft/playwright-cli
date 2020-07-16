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

const playwright = require('playwright');
const { RecorderController } = require('../lib/recorder/recorderController');

class WritableBuffer {
  constructor() {
    this.lines = [];
  }

  write(chunk) {
    if (chunk === '\u001B[F\u001B[2K') {
      this.lines.pop();
      return;
    }
    this.lines.push(...chunk.split('\n'));
    if (this._callback && chunk.includes(this._text))
      this._callback();
  }

  waitFor(text) {
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

describe('Recorder', function() {
  let browser;
  beforeAll(async () => {
    browser = await playwright.chromium.launch();
  });
  afterAll(async () => {
    await browser.close();
  });

  async function start() {
    const state = {};
    state.context = await browser.newContext();
    state.output = new WritableBuffer();
    new RecorderController(state.context, state.output);
    state.page = await state.context.newPage();
    // Give it time to refresh. See RecorderScript for details.
    state.waitForReady = () => state.page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    return state;
  }

  it('should click', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<button onclick="console.log('click')">Submit</button>`);
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
    expect(message.text()).toBe('click');
    await context.close();
  });

  it('should click after document.open', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(``);
    await waitForReady();
    await page.evaluate(() => {
      document.open();
      document.write(`<button onclick="console.log('click')">Submit</button>`);
      document.close();
    });
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('click'),
      page.dispatchEvent('button', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="Submit"
  await page.click('text="Submit"');`);
    expect(message.text()).toBe('click');
    await context.close();
  });

  it('should fill', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<input id="input" name="name" oninput="console.log(input.value)"></input>`);
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('fill'),
      page.fill('input', 'John')
    ]);
    expect(output.text()).toContain(`
  // Fill input[name=name]
  await page.fill('input[name=name]', 'John');`);
    expect(message.text()).toBe('John');
    await context.close();
  });

  it('should press', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<input name="name" onkeypress="console.log('press')"></input>`);
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('press'),
      page.press('input', 'Shift+Enter')
    ]);
    expect(output.text()).toContain(`
  // Press Enter with modifiers
  await page.press('input[name=name]', 'Shift+Enter');`);
    expect(message.text()).toBe('press');
    await context.close();
  });

  it('should check', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<input id="checkbox" type="checkbox" name="accept" onchange="console.log(checkbox.checked)"></input>`);
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('check'),
      page.dispatchEvent('input', 'click', { detail: 1 })
    ]);
    await output.waitFor('check');
    expect(output.text()).toContain(`
  // Check input[name=accept]
  await page.check('input[name=accept]');`);
    expect(message.text()).toBe("true");
    await context.close();
  });

  it('should uncheck', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<input id="checkbox" type="checkbox" checked name="accept" onchange="console.log(checkbox.checked)"></input>`);
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('uncheck'),
      page.dispatchEvent('input', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Uncheck input[name=accept]
  await page.uncheck('input[name=accept]');`);
    expect(message.text()).toBe("false");
    await context.close();
  });

  it('should select', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent('<select id="age" onchange="console.log(age.selectedOptions[0].value)"><option value="1"><option value="2"></select>');
    await waitForReady();
    const [message] = await Promise.all([
      page.waitForEvent('console'),
      output.waitFor('select'),
      page.selectOption('select', '2')
    ]);
    expect(output.text()).toContain(`
  // Select select[id=age]
  await page.selectOption('select[id=age]', '2');`);
    expect(message.text()).toBe("2");
    await context.close();
  });

  it('should await popup', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent('<a target=_blank rel=noopener href="about:blank">link</a>');
    await waitForReady();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      output.waitFor('waitForEvent'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="link"
  const [popup1] = await Promise.all([
    page.waitForEvent('popup'),
    await page.click('text="link"');
  ]);`);
    expect(popup.url()).toBe('about:blank');
    await context.close();
  });

  it('should await navigation', async function() {
    const {page, output, context, waitForReady} = await start();
    await page.goto('about:blank');
    await page.setContent(`<a onclick="setTimeout(() => window.location.href='about:blank#foo', 1000)">link</a>`);
    await waitForReady();
    await Promise.all([
      page.waitForNavigation(),
      output.waitFor('waitForNavigation'),
      page.dispatchEvent('a', 'click', { detail: 1 })
    ]);
    expect(output.text()).toContain(`
  // Click text="link"
  await Promise.all([
    page.waitForNavigation({ url: 'about:blank#foo' }),
    page.click('text="link"')
  ]);`);
    expect(page.url()).toContain('about:blank#foo');
    await context.close();
  });
});
