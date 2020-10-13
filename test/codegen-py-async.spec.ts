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

import * as fs from 'fs';
import * as path from 'path';
import { it, expect } from './fixtures';

const emptyHTML = new URL('file://' + path.join(__dirname, 'assets', 'empty.html')).toString()

it('should print the correct imports and context options', async ({ runCLI }) => {
  const cli = runCLI(['codegen', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
from playwright import async_playwright

async def run(playwright):
    browser = await playwright.chromium.launch(headless=False)
    context = await browser.newContext()`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options for custom settings', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', 'codegen', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
from playwright import async_playwright

async def run(playwright):
    browser = await playwright.chromium.launch(headless=False)
    context = await browser.newContext(colorScheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options when using a device', async ({ runCLI }) => {
  const cli = runCLI(['--device=Pixel 2', 'codegen', '--target=python-async', emptyHTML])
  const expectedResult = `import asyncio
from playwright import async_playwright

async def run(playwright):
    browser = await playwright.chromium.launch(headless=False)
    context = await browser.newContext(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult)
  expect(cli.text()).toContain(expectedResult)
});

it('should print the correct context options when using a device and additional options', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--device=Pixel 2', 'codegen', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
from playwright import async_playwright

async def run(playwright):
    browser = await playwright.chromium.launch(headless=False)
    context = await browser.newContext(**playwright.devices["Pixel 2"], colorScheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should save the codegen output to a file if specified', async ({ runCLI, testInfo }) => {
  const tmpFile = testInfo.outputPath('script.js');
  const cli = runCLI(['codegen', '--target=python-async', '--output', tmpFile, emptyHTML]);
  await cli.exited;
  const content = await fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`import asyncio
from playwright import async_playwright

async def run(playwright):
    browser = await playwright.chromium.launch(headless=False)
    context = await browser.newContext()

    # Open new page
    page = await context.newPage()

    # Go to ${emptyHTML}
    await page.goto("${emptyHTML}")

    # Close page
    await page.close()

    # ---------------------
    await context.close()
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())`);
});