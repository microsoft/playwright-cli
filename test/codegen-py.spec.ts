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
import { fixtures} from './playwright.fixtures';
const { it, expect } = fixtures;

const emptyHTML = new URL('file://' + path.join(__dirname, 'assets', 'empty.html')).toString()

it('should print the correct imports and context options', async ({ runCLI }) => {
  const cli = runCLI(['codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.newContext()`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options for custom settings', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', 'codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.newContext(colorScheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options when using a device', async ({ runCLI }) => {
  const cli = runCLI(['--device=Pixel 2', 'codegen', '--target=python', emptyHTML])
  const expectedResult = `from playwright import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.newContext(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult)
  expect(cli.text()).toContain(expectedResult)
});

it('should print the correct context options when using a device and additional options', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--device=Pixel 2', 'codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.newContext(**playwright.devices["Pixel 2"], colorScheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should save the codegen output to a file if specified', async ({ runCLI, tmpDir }) => {
  const tmpFile = path.join(tmpDir, 'script.js');
  const cli = runCLI(['codegen', '--target=python', '--output', tmpFile, emptyHTML]);
  await cli.exited;
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`from playwright import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.newContext()

    # Open new page
    page = context.newPage()

    # Go to ${emptyHTML}
    page.goto("${emptyHTML}")

    # Close page
    page.close()

    # ---------------------
    browser.close()

with sync_playwright() as playwright:
    run(playwright)`);
});
