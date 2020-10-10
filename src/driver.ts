/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

const { installDebugController } = require('playwright/lib/debug/debugController');
const { DispatcherConnection } = require('playwright/lib/dispatchers/dispatcher');
const { PlaywrightDispatcher } = require('playwright/lib/dispatchers/playwrightDispatcher');
const { installBrowsersWithProgressBar } = require('playwright/lib/install/installer');
const { Transport } = require('playwright/lib/protocol/transport');
const { Electron } = require('playwright/lib/server/electron/electron');
const { Playwright } = require('playwright/lib/server/playwright');
const { gracefullyCloseAll } = require('playwright/lib/server/processLauncher');
const { installTracer } = require('playwright/lib/trace/tracer');

export async function installWithProgressBar(location: string) {
  await installBrowsersWithProgressBar(location);
}

export function printApiJson() {
  console.log(JSON.stringify(require('playwright/api.json')));
}

export function runServer() {
  installDebugController();
  installTracer();

  const dispatcherConnection = new DispatcherConnection();
  const transport = new Transport(process.stdout, process.stdin);
  transport.onclose = async () => {
    // Force exit after 30 seconds.
    setTimeout(() => process.exit(0), 30000);
    // Meanwhile, try to gracefully close all browsers.
    await gracefullyCloseAll();
    process.exit(0);
  };
  transport.onmessage = (message: string) => dispatcherConnection.dispatch(JSON.parse(message));
  dispatcherConnection.onmessage = (message: string) => transport.send(JSON.stringify(message));

  console.log(require('playwright/browsers.json')['browsers']);
  const playwright = new Playwright(__dirname, require('playwright/browsers.json')['browsers']);
  (playwright as any).electron = new Electron();
  new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), playwright);
}
