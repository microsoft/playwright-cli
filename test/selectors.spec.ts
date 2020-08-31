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

it('should generate for text', async ({ page, output }) => {
  await setContentAndWait(page, `<div>Text</div>`);
  const selector = await hoverOverElement(page, 'div');
  expect(selector).toBe('text="Text"');
});

it('should use ordinal for identical nodes', async ({ page, output }) => {
  await setContentAndWait(page, `<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
  const selector = await hoverOverElement(page, 'div[mark="1"]');
  expect(selector).toBe('//div[3][normalize-space(.)=\'Text\']');
});

it('should prefer data-testid', async ({ page, output }) => {
  await setContentAndWait(page, `<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
  const selector = await hoverOverElement(page, 'div[data-testid="a"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle first non-unique data-testid', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div data-testid=a mark=1>
      Text
    </div>
    <div data-testid=a>
      Text
    </div>`);
  const selector = await hoverOverElement(page, 'div[mark="1"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle second non-unique data-testid', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div data-testid=a>
      Text
    </div>
    <div data-testid=a mark=1>
      Text
    </div>`);
  const selector = await hoverOverElement(page, 'div[mark="1"]');
  expect(selector).toBe('//div[2][normalize-space(.)=\'Text\']');
});

it('should use readable id', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div></div>
    <div id=first-item mark=1></div>
  `);
  const selector = await hoverOverElement(page, 'div[mark="1"]');
  expect(selector).toBe('div[id="first-item"]');
});

it('should not use generated id', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div></div>
    <div id=aAbBcCdDeE mark=1></div>
  `);
  const selector = await hoverOverElement(page, 'div[mark="1"]');
  expect(selector).toBe('//div[2]');
});

it('should separate selectors by >>', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div>
      <div>Text</div>
    </div>
    <div id="id">
      <div>Text</div>
    </div>
  `);
  const selector = await hoverOverElement(page, '#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=\"Text\"');
});

it('should trim long text', async ({ page, output }) => {
  await setContentAndWait(page, `
    <div>
      <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
    <div id="id">
    <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
  `);
  const selector = await hoverOverElement(page, '#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=/.*Text that goes on and on and o.*/');
});

it('should use nested ordinals', async ({ page, output }) => {
  await setContentAndWait(page, `
    <a><b></b></a>
    <a>
      <b>
        <c>
        </c>
      </b>
      <b>
        <c mark=1></c>
      </b>
    </a>
    <a><b></b></a>
  `);
  const selector = await hoverOverElement(page, 'c[mark="1"]');
  expect(selector).toBe('//b[2]/c');
});
