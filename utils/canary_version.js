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

// This script generates the canary version to publish to npm, based on the verison of playwright.
// It should not be used to publish a release version.
//
// 1. Takes timestamp from the playwright@next version, so that language packages
//   have easier time syncing between the two.
//
// 2. Appends git hash:
//   - Avoids accidentally generating a release version.
//   - Ensures that we can publish packages that have the same version of
//     both playwright and playwright-cli, but different content.

const childProcess = require('child_process');
const json = require('../package.json');
const hash = childProcess.execSync('git rev-parse --short HEAD').toString().trim();
if (json.dependencies.playwright.includes('next')) {
  const timestamp = json.dependencies.playwright.replace(/.*next\./, '');
  if (json.version.includes('-')) {
    console.log(json.version + '.' + timestamp + '-' + hash);
  } else {
    // Ensure dash in the third component, to avoid being semver-like.
    console.log(json.version + '-' + timestamp + '-' + hash);
  }
} else {
  console.log(json.version + '-' + hash);
}
