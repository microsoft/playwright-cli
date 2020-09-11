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
import { Writable } from 'stream';
import * as actions from './recorderActions';
import { CodeGenerator, ActionInContext } from './codeGenerator';
import { BindingSource, toClickOptions, toModifiers } from './utils';
import { IOutput } from './outputs';

export class RecorderController {
  private _output: CodeGenerator;
  private _pageAliases = new Map<playwright.Page, string>();
  private _lastPopupOrdinal = 0;
  private _timers = new Set<NodeJS.Timeout>();

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, context: playwright.BrowserContext, output: IOutput, deviceName: string | undefined) {
    this._output = new CodeGenerator(browserName, launchOptions, contextOptions, output, deviceName);

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    context.exposeBinding('performPlaywrightAction',
        (source: BindingSource, action: actions.Action) => this._performAction(source.frame, source.page, action)).catch(e => {});

    // Other non-essential actions are simply being recorded.
    context.exposeBinding('recordPlaywrightAction',
        (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, source.page, action)).catch(e => {});

    // Commits last action so that no furhter signals are added to it.
    context.exposeBinding('commitLastAction',
        (source: BindingSource, action: actions.Action) => this._output.commitLastAction()).catch(e => {});

    context.on('page', page => this._onPage(page));
    for (const page of context.pages())
      this._onPage(page);

    context.once('close', () => {
      for (const timer of this._timers)
        clearTimeout(timer);
      this._timers.clear();
      this._output.flush();
    });
  }

  private async _onPage(page: playwright.Page) {
    // First page is called page, others are called popup1, popup2, etc.
    page.on('close', () => {
      this._pageAliases.delete(page);
      this._output.addAction({
        pageAlias,
        frame: page.mainFrame(),
        committed: true,
        action: {
          name: 'closePage',
          signals: [],
        }
      });
    });
    page.on('framenavigated', frame => this._onFrameNavigated(frame, page));
    page.on('download', download => this._onDownload(page, download));
    page.on('popup', popup => this._onPopup(page, popup));
    page.on('dialog', dialog => this._onDialog(page, dialog));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);

    const isPopup = !!await page.opener();
    // Could happen due to the await above.
    if (page.isClosed())
      return;
    if (!isPopup) {
      this._output.addAction({
        pageAlias,
        frame: page.mainFrame(),
        committed: true,
        action: {
          name: 'openPage',
          url: page.url(),
          signals: [],
        }
      });
    }
  }

  private async _performAction(frame: playwright.Frame, page: playwright.Page, action: actions.Action) {
    const actionInContext: ActionInContext = {
      pageAlias: this._pageAliases.get(page)!,
      frame,
      action
    };
    this._output.willPerformAction(actionInContext);
    if (action.name === 'click') {
      const { options } = toClickOptions(action);
      await frame.click(action.selector, options);
    }
    if (action.name === 'press') {
      const modifiers = toModifiers(action.modifiers);
      const shortcut = [...modifiers, action.key].join('+');
      await frame.press(action.selector, shortcut);
    }
    if (action.name === 'check')
      await frame.check(action.selector);
    if (action.name === 'uncheck')
      await frame.uncheck(action.selector);
    if (action.name === 'select')
      await frame.selectOption(action.selector, action.options);
    const timer = setTimeout(() => {
      actionInContext.committed = true;
      this._timers.delete(timer);
    }, 5000);
    this._output.didPerformAction(actionInContext);
    this._timers.add(timer);
  }

  private async _recordAction(frame: playwright.Frame, page: playwright.Page, action: actions.Action) {
    // We are lacking frame.page() in Playwright.
    this._output.addAction({
      pageAlias: this._pageAliases.get(page)!,
      frame,
      action
    });
  }

  private _onFrameNavigated(frame: playwright.Frame, page: playwright.Page) {
    if (frame.parentFrame())
      return;
    const pageAlias = this._pageAliases.get(page);
    this._output.signal(pageAlias!, frame, { name: 'navigation', url: frame.url() });
  }

  private _onPopup(page: playwright.Page, popup: playwright.Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    this._output.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
  }
  private _onDownload(page: playwright.Page, download: playwright.Download) {
    const pageAlias = this._pageAliases.get(page)!;
    this._output.signal(pageAlias, page.mainFrame(), { name: 'download' });
  }

  private _onDialog(page: playwright.Page, download: playwright.Dialog) {
    const pageAlias = this._pageAliases.get(page)!;
    this._output.signal(pageAlias, page.mainFrame(), { name: 'dialog' });
  }
}

