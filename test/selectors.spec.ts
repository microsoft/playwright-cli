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

import { it, expect, describe } from './playwright.fixtures';

it('should generate for text', async ({ recorder }) => {
  await recorder.setContentAndWait(`<div>Text</div>`);
  const selector = await recorder.hoverOverElement('div');
  expect(selector).toBe('text="Text"');
});

it('should use ordinal for identical nodes', async ({ recorder }) => {
  await recorder.setContentAndWait(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
  const selector = await recorder.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[3][normalize-space(.)=\'Text\']');
});

it('should prefer data-testid', async ({ recorder }) => {
  await recorder.setContentAndWait(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
  const selector = await recorder.hoverOverElement('div[data-testid="a"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle first non-unique data-testid', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div data-testid=a mark=1>
      Text
    </div>
    <div data-testid=a>
      Text
    </div>`);
  const selector = await recorder.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle second non-unique data-testid', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div data-testid=a>
      Text
    </div>
    <div data-testid=a mark=1>
      Text
    </div>`);
  const selector = await recorder.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[2][normalize-space(.)=\'Text\']');
});

it('should use readable id', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div></div>
    <div id=first-item mark=1></div>
  `);
  const selector = await recorder.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('div[id="first-item"]');
});

it('should not use generated id', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div></div>
    <div id=aAbBcCdDeE mark=1></div>
  `);
  const selector = await recorder.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[2]');
});

it('should separate selectors by >>', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div>
      <div>Text</div>
    </div>
    <div id="id">
      <div>Text</div>
    </div>
  `);
  const selector = await recorder.hoverOverElement('#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=\"Text\"');
});

it('should trim long text', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <div>
      <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
    <div id="id">
    <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
  `);
  const selector = await recorder.hoverOverElement('#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=/.*Text that goes on and on and o.*/');
});

it('should use nested ordinals', async ({ recorder }) => {
  await recorder.setContentAndWait(`
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
  const selector = await recorder.hoverOverElement('c[mark="1"]');
  expect(selector).toBe('//b[2]/c');
});


it('should not use input[value]', async ({ recorder }) => {
  await recorder.setContentAndWait(`
    <input value="one">
    <input value="two" mark="1">
    <input value="three">
  `);
  const selector = await recorder.hoverOverElement('input[mark="1"]');
  expect(selector).toBe('//input[2]');
});

describe("should prioritise input element attributes correctly", () => {
  it('name', async ({ recorder }) => {
    await recorder.setContentAndWait(`<input name="foobar" type="text"/>`);
    expect(await recorder.hoverOverElement('input')).toBe('input[name="foobar"]');
  });
  it('placeholder', async ({ recorder }) => {
    await recorder.setContentAndWait(`<input placeholder="foobar" type="text"/>`);
    expect(await recorder.hoverOverElement('input')).toBe('input[placeholder="foobar"]');
  });
  it('type', async ({ recorder }) => {
    await recorder.setContentAndWait(`<input type="text"/>`);
    expect(await recorder.hoverOverElement('input')).toBe('input[type="text"]');
  });
})