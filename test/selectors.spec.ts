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

import './playwright.fixtures';

it('should generate for text', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`<div>Text</div>`);
  const selector = await pageWrapper.hoverOverElement('div');
  expect(selector).toBe('text="Text"');
});

it('should use ordinal for identical nodes', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`<div>Text</div><div>Text</div><div mark=1>Text</div><div>Text</div>`);
  const selector = await pageWrapper.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[3][normalize-space(.)=\'Text\']');
});

it('should prefer data-testid', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`<div>Text</div><div>Text</div><div data-testid=a>Text</div><div>Text</div>`);
  const selector = await pageWrapper.hoverOverElement('div[data-testid="a"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle first non-unique data-testid', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div data-testid=a mark=1>
      Text
    </div>
    <div data-testid=a>
      Text
    </div>`);
  const selector = await pageWrapper.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('div[data-testid="a"]');
});

it('should handle second non-unique data-testid', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div data-testid=a>
      Text
    </div>
    <div data-testid=a mark=1>
      Text
    </div>`);
  const selector = await pageWrapper.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[2][normalize-space(.)=\'Text\']');
});

it('should use readable id', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div></div>
    <div id=first-item mark=1></div>
  `);
  const selector = await pageWrapper.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('div[id="first-item"]');
});

it('should not use generated id', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div></div>
    <div id=aAbBcCdDeE mark=1></div>
  `);
  const selector = await pageWrapper.hoverOverElement('div[mark="1"]');
  expect(selector).toBe('//div[2]');
});

it('should separate selectors by >>', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div>
      <div>Text</div>
    </div>
    <div id="id">
      <div>Text</div>
    </div>
  `);
  const selector = await pageWrapper.hoverOverElement('#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=\"Text\"');
});

it('should trim long text', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
    <div>
      <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
    <div id="id">
    <div>Text that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on</div>
    </div>
  `);
  const selector = await pageWrapper.hoverOverElement('#id > div');
  expect(selector).toBe('div[id=\"id\"] >> text=/.*Text that goes on and on and o.*/');
});

it('should use nested ordinals', async ({ pageWrapper }) => {
  await pageWrapper.setContentAndWait(`
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
  const selector = await pageWrapper.hoverOverElement('c[mark="1"]');
  expect(selector).toBe('//b[2]/c');
});
