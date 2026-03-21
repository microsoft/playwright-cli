#!/usr/bin/env node
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

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('-'));

if (command === 'install-browser') {
  const minimist = require('minimist');
  const parsed = minimist(args, { string: ['_', 'browser'], boolean: ['help', 'h'] });

  if (parsed.help || parsed.h) {
    console.log(
      'playwright-cli install-browser [browser]\n\n' +
      'Install browser\n\n' +
      'Arguments:\n' +
      '  [browser]                   browser to install: chromium, firefox, webkit, chrome, msedge\n' +
      'Options:\n' +
      '  --browser                   browser to install (alternative to positional argument)'
    );
    process.exit(0);
  }

  const browserName = parsed._[1] || parsed.browser;
  if (!browserName) {
    console.error('Browser name is required. Usage: playwright-cli install-browser <browser>\nPossible values: chromium, firefox, webkit, chrome, msedge');
    process.exit(1);
  }

  import('playwright-core/lib/server/registry/index').then(({ registry }) => {
    const executable = registry.findExecutable(browserName);
    if (!executable) {
      console.error(`Unknown browser: "${browserName}". Possible values: chromium, firefox, webkit, chrome, msedge`);
      process.exit(1);
    }
    registry.install([executable]).then(() => {
      console.log(`Browser "${browserName}" installed successfully.`);
    }).catch(e => {
      console.error(e.message);
      process.exit(1);
    });
  });
} else {
  require('playwright/lib/cli/client/program');
}
