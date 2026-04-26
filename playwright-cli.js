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

try {
  require('playwright-core/cli');
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND' && error.message.includes('playwright-core/cli')) {
    console.error('Failed to load Playwright CLI from playwright-core. Please ensure a compatible playwright-core version is installed.');
    process.exit(1);
  }
  throw error;
}
