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

import { fixtures} from './playwright.fixtures';
const { it, expect } = fixtures;

it('should print the correct imports and context options', async ({ runCLI }) => {
  const cli = runCLI(['codegen', 'wikipedia.org']);
  const expectedResult = `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
})();`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options for custom settings', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', 'codegen', 'wikipedia.org']);
  const expectedResult = `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    colorScheme: 'light'
  });
})();`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});


it('should print the correct context options when using a device', async ({ runCLI }) => {
  const cli = runCLI(['--device=Pixel 2', 'codegen', 'wikipedia.org'])
  const expectedResult = `const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    ...devices['Pixel 2'],
  });
})();`
  await cli.waitFor(expectedResult)
  expect(cli.text()).toContain(expectedResult)
});

it('should print the correct context options when using a device and additional options', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--device=Pixel 2', 'codegen', 'wikipedia.org']);
  const expectedResult = `const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    ...devices['Pixel 2'],
    colorScheme: 'light'
  });
})();`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});