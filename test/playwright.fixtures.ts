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

declare global {
	interface WorkerState {
		browserType: playwright.BrowserType<playwright.Browser>;
		browserName: string;
		browser: playwright.Browser;
	}
	interface TestState {
		context: playwright.BrowserContext;
		page: playwright.Page;
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

registerFixture('context', async ({ browser }, runTest, info) => {
	const context = await browser.newContext();
	await runTest(context);
	await context.close();
});

registerFixture('page', async ({ context }, runTest) => {
	const page = await context.newPage();
	await runTest(page);
});
