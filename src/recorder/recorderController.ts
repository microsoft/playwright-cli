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
import { TerminalOutput } from './terminalOutput';
import { BindingSource, toClickOptions, toModifiers } from './utils';
import * as recorderScriptSource from '../generated/recorderScriptSource';

export class RecorderController {
  private _output: TerminalOutput;
  private _performingAction = false;
  private _pageAliases = new Map<playwright.Page, string>();
  private _lastPopupOrdinal = 0;
  private _timers = new Set<NodeJS.Timeout>();

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, context: playwright.BrowserContext, output: Writable) {
    this._output = new TerminalOutput(browserName, launchOptions, contextOptions, output);

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    context.exposeBinding('performPlaywrightAction',
        (source: BindingSource, action: actions.Action) => this._performAction(source.frame, source.page, action)).catch(e => {});

    // Other non-essential actions are simply being recorded.
    context.exposeBinding('recordPlaywrightAction',
        (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, source.page, action)).catch(e => {});

    // Commits last action so that no furhter signals are added to it.
    context.exposeBinding('commitLastAction',
        (source: BindingSource, action: actions.Action) => this._commitLastAction()).catch(e => {});

    // Other non-essential actions are simply being recorded.
    context.exposeBinding('queryPlaywrightSelector', async (source: BindingSource, selector: string) => {
      return await source.frame.$$(selector).catch(e => []);
    });

    context.addInitScript(`new (${recorderScriptSource.source})()`);

    context.on('page', page => this._onPage(page));
    for (const page of context.pages())
      this._onPage(page);

    context.once('close', () => {
      for (const timer of this._timers)
        clearTimeout(timer);
      this._timers.clear();
    });
  }

  private async _onPage(page: playwright.Page) {
    // First page is called page, others are called popup1, popup2, etc.
    page.on('close', () => {
      this._pageAliases.delete(page);
      this._output.addAction(
        pageAlias, page.mainFrame(), {
          name: 'closePage',
          committed: true,
          signals: [],
        });
    });
    page.on('framenavigated', frame => this._onFrameNavigated(frame, page));
    page.on('download', download => this._onDownload(page, download));
    page.on('popup', popup => this._onPopup(page, popup));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);

    const isPopup = !!await page.opener();
    // Could happen due to the await above.
    if (page.isClosed())
      return;
    if (!isPopup) {
      this._output.addAction(
        pageAlias, page.mainFrame(), {
          name: 'openPage',
          committed: true,
          signals: [],
        });
    }
  }

  private _commitLastAction() {
    const action = this._output.lastAction();
    if (action)
      action.committed = true;
  }

  private async _performAction(frame: playwright.Frame, page: playwright.Page, action: actions.Action) {
    this._performingAction = true;
    this._recordAction(frame, page, action);
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
    this._performingAction = false;
    const timer = setTimeout(() => {
      action.committed = true;
      this._timers.delete(timer);
    }, 5000);
    this._timers.add(timer);
  }

  private async _recordAction(frame: playwright.Frame, page: playwright.Page, action: actions.Action) {
    // We are lacking frame.page() in Playwright.
    this._output.addAction(this._pageAliases.get(page)!, frame, action);
  }

  private _onFrameNavigated(frame: playwright.Frame, page: playwright.Page) {
    if (frame.parentFrame())
      return;
    const pageAlias = this._pageAliases.get(page);
    const action = this._output.lastAction();
    // We only augment actions that have not been committed.
    if (action && !action.committed && action.name !== 'navigate') {
      // If we hit a navigation while action is executed, we assert it. Otherwise, we await it.
      this._output.signal(pageAlias!, frame, { name: 'navigation', url: frame.url(), type: this._performingAction ? 'assert' : 'await' });
    } else if (!action || action.committed) {
      // If navigation happens out of the blue, we just log it.
      this._output.addAction(
        pageAlias!, frame, {
          name: 'navigate',
          committed: true,
          url: frame.url(),
          signals: [],
        });
    }
  }

  private _onPopup(page: playwright.Page, popup: playwright.Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    const action = this._output.lastAction();
    // We only augment actions that have not been committed.
    if (action && !action.committed) {
      // If we hit a navigation while action is executed, we assert it. Otherwise, we await it.
      this._output.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
    }
  }
  private _onDownload(page: playwright.Page, download: playwright.Download) {
    const pageAlias = this._pageAliases.get(page)!;
    this._output.signal(pageAlias, page.mainFrame(), { name: 'download' });
  }
}

