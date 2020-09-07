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

import * as playwright from 'playwright';
import * as injectedScriptSource from './generated/scriptSource';
import { Writable } from 'stream';
import { RecorderController } from './recorderController';

const toImpl = (playwright as any)._toImpl;

const scriptSymbol = Symbol('script');

export class ScriptController {
  private _recorder: RecorderController | undefined;

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, context: playwright.BrowserContext, output: Writable, enableRecorder: boolean) {
    if (enableRecorder)
      this._recorder = new RecorderController(browserName, launchOptions, contextOptions, context, output);
    context.on('page', page => this._onPage(page));
    for (const page of context.pages())
      this._onPage(page);
  }

  private async _onPage(page: playwright.Page) {
    // Install in all frames.
    for (const frame of page.frames())
      this._ensureInstalledInFrame(frame);
    page.on('framenavigated', frame => this._ensureInstalledInFrame(frame));
  }

  private async _ensureInstalledInFrame(frame: playwright.Frame) {
    try {
      const mainContext = await toImpl(frame)._mainContext();
      if (mainContext[scriptSymbol])
        return;
      mainContext[scriptSymbol] = true;
      await mainContext.extendInjectedScript(injectedScriptSource.source, { enableRecorder: !!this._recorder });
    } catch (e) {
    }
  }
}
