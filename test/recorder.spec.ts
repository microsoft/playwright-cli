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

import { setContentAndWait, hoverOverElement } from './playwright.fixtures';

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
