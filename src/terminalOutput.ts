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

import * as querystring from 'querystring';
import * as playwright from 'playwright';
import { Writable } from 'stream';
import { quote, Formatter } from './formatter';
import { Action, actionTitle, NavigationSignal, PopupSignal, Signal, DownloadSignal, DialogSignal } from './recorderActions';
import { MouseClickOptions, toModifiers } from './utils';
import { highlight } from 'highlight.js';
import { Frame } from 'playwright';

export type ActionInContext = {
  pageAlias: string;
  frame: Frame;
  action: Action;
  committed?: boolean;
}

export class TerminalOutput {
  private _currentAction: ActionInContext | undefined;
  private _lastAction: ActionInContext | undefined;
  private _lastActionText: string | undefined;
  private _out: Writable;

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, out: Writable, deviceName: string | undefined) {
    this._out = out;
    const formatter = new Formatter();
    launchOptions = { headless: false, ...launchOptions };

    formatter.add(`
      const { ${browserName}${deviceName ? ', devices' : ''} } = require('playwright');

      (async () => {
        const browser = await ${browserName}.launch(${formatObjectOrVoid(launchOptions)});
        const context = await browser.newContext(${formatContextOptions(contextOptions, deviceName)});
      })();`);
    this._out.write(this._highlight(formatter.format()) + '\n');
  }

  _highlight(text: string)  {
    let highlightedCode = highlight('typescript', text).value;
    highlightedCode = querystring.unescape(highlightedCode);
    highlightedCode = highlightedCode.replace(/<span class="hljs-keyword">/g, '\x1b[38;5;205m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-built_in">/g, '\x1b[38;5;220m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-literal">/g, '\x1b[38;5;159m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-number">/g, '\x1b[38;5;78m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-string">/g, '\x1b[38;5;130m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-comment">/g, '\x1b[38;5;23m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-subst">/g, '\x1b[38;5;242m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-function">/g, '');
    highlightedCode = highlightedCode.replace(/<span class="hljs-params">/g, '');
    highlightedCode = highlightedCode.replace(/<\/span>/g, '\x1b[0m');
    highlightedCode = highlightedCode.replace(/&#x27;/g, "'");
    highlightedCode = highlightedCode.replace(/&quot;/g, '"');
    highlightedCode = highlightedCode.replace(/&gt;/g, '>');
    highlightedCode = highlightedCode.replace(/&lt;/g, '<');
    highlightedCode = highlightedCode.replace(/&amp;/g, '&');
    return highlightedCode;
  }

  addAction(action: ActionInContext) {
    this.willPerformAction(action);
    this.didPerformAction(action);
  }

  willPerformAction(action: ActionInContext) {
    this._currentAction = action;
  }

  didPerformAction(actionInContext: ActionInContext) {
    const { action, pageAlias } = actionInContext;
    let eraseLastAction = false;
    if (this._lastAction && this._lastAction.pageAlias === pageAlias) {
      const { action: lastAction } = this._lastAction;
      // We augment last action based on the type.
      if (this._lastAction && action.name === 'fill' && lastAction.name === 'fill') {
        if (action.selector === lastAction.selector)
          eraseLastAction = true;
      }
      if (lastAction && action.name === 'click' && lastAction.name === 'click') {
        if (action.selector === lastAction.selector && action.clickCount > lastAction.clickCount)
          eraseLastAction = true;
      }
      if (lastAction && action.name === 'navigate' && lastAction.name === 'navigate') {
        if (action.url === lastAction.url)
          return;
      }
      for (const name of ['check', 'uncheck']) {
        if (lastAction && action.name === name && lastAction.name === 'click') {
          if ((action as any).selector === (lastAction as any).selector)
            eraseLastAction = true;
        }
      }
    }
    this._printAction(actionInContext, eraseLastAction);
  }

  commitLastAction() {
    const action = this._lastAction;
    if (action)
      action.committed = true;
  }

  _printAction(actionInContext: ActionInContext, eraseLastAction: boolean) {
    // We erase terminating `})();` at all times.
    let eraseLines = 1;
    if (eraseLastAction && this._lastActionText)
      eraseLines += this._lastActionText.split('\n').length;
    // And we erase the last action too if augmenting.
    for (let i = 0; i < eraseLines; ++i)
      this._out.write('\u001B[1A\u001B[2K');

    const performingAction = !!this._currentAction;
    this._currentAction = undefined;
    this._lastAction = actionInContext;
    this._lastActionText = this._generateAction(actionInContext, performingAction);
    this._out.write(this._lastActionText + '\n})();\n');
  }

  signal(pageAlias: string, frame: playwright.Frame, signal: Signal) {
    // Signal either arrives while action is being performed or shortly after.
    if (this._currentAction) {
      this._currentAction.action.signals.push(signal);
      return;
    }
    if (this._lastAction && !this._lastAction.committed) {
      this._lastAction.action.signals.push(signal);
      this._printAction(this._lastAction, true);
      return;
    }

    if (signal.name === 'navigation') {
      this.addAction({
        pageAlias,
        frame,
        committed: true,
        action: {
          name: 'navigate',
          url: frame.url(),
          signals: [],
        }
      });
    }
  }

  private _generateAction(actionInContext: ActionInContext, performingAction: boolean): string {
    const { action, pageAlias, frame } = actionInContext;
    const formatter = new Formatter(2);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`const ${pageAlias} = await context.newPage();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${pageAlias}.load('${action.url}');`);
      return this._highlight(formatter.format());
    }

    const subject = !frame.parentFrame() ? pageAlias :
      `${pageAlias}.frame(${formatObject({ url: frame.url() })})`;

    let navigationSignal: NavigationSignal | undefined;
    let popupSignal: PopupSignal | undefined;
    let downloadSignal: DownloadSignal | undefined;
    let dialogSignal: DialogSignal | undefined;
    for (const signal of action.signals) {
      if (signal.name === 'navigation')
        navigationSignal = signal;
      else if (signal.name === 'popup')
        popupSignal = signal;
      else if (signal.name === 'download')
        downloadSignal = signal;
      else if (signal.name === 'dialog')
        dialogSignal = signal;
    }

    if (dialogSignal) {
      formatter.add(`  page.once('dialog', dialog => {
    console.log(\`Dialog message: $\{dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });`)
    }

    const waitForNavigation = navigationSignal && !performingAction;
    const assertNavigation = navigationSignal && performingAction;

    const emitPromiseAll = waitForNavigation || popupSignal || downloadSignal;
    if (emitPromiseAll) {
      // Generate either await Promise.all([]) or
      // const [popup1] = await Promise.all([]).
      let leftHandSide = '';
      if (popupSignal)
        leftHandSide = `const [${popupSignal.popupAlias}] = `;
      else if (downloadSignal)
        leftHandSide = `const [download] = `;
      formatter.add(`${leftHandSide}await Promise.all([`);
    }

    // Popup signals.
    if (popupSignal)
      formatter.add(`${pageAlias}.waitForEvent('popup'),`);

    // Navigation signal.
    if (waitForNavigation)
      formatter.add(`${pageAlias}.waitForNavigation(/*{ url: ${quote(navigationSignal!.url)} }*/),`);

    // Download signals.
    if (downloadSignal)
      formatter.add(`${pageAlias}.waitForEvent('download'),`);

    const prefix = (popupSignal || waitForNavigation || downloadSignal) ? '' : 'await ';
    const actionCall = this._generateActionCall(action);
    const suffix = (waitForNavigation || emitPromiseAll) ? '' : ';';
    formatter.add(`${prefix}${subject}.${actionCall}${suffix}`);

    if (emitPromiseAll)
      formatter.add(`]);`);
    else if (assertNavigation)
      formatter.add(`  // assert.equal(${pageAlias}.url(), ${quote(navigationSignal!.url)});`);
    return this._highlight(formatter.format());
  }

  private _generateActionCall(action: Action): string {
    switch (action.name)  {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return 'close()';
      case 'click': {
        let method = 'click';
        if (action.clickCount === 2)
          method = 'dblclick';
        const modifiers = toModifiers(action.modifiers);
        const options: MouseClickOptions = {};
        if (action.button !== 'left')
          options.button = action.button;
        if (modifiers.length)
          options.modifiers = modifiers;
        if (action.clickCount > 2)
          options.clickCount = action.clickCount;
        const optionsString = formatOptions(options);
        return `${method}(${quote(action.selector)}${optionsString})`;
      }
      case 'check':
        return `check(${quote(action.selector)})`;
      case 'uncheck':
        return `uncheck(${quote(action.selector)})`;
      case 'fill':
        return `fill(${quote(action.selector)}, ${quote(action.text)})`;
      case 'setInputFiles':
        return `setInputFiles(${quote(action.selector)}, ${formatObject(action.files.length === 1 ? action.files[0] : action.files)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `press(${quote(action.selector)}, ${quote(shortcut)})`;
      }
      case 'navigate':
        return `goto(${quote(action.url)})`;
      case 'select':
        return `selectOption(${quote(action.selector)}, ${formatObject(action.options.length > 1 ? action.options : action.options[0])})`;
    }
  }
}

function formatOptions(value: any): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return ', ' + formatObject(value);
}

function formatObject(value: any, indent = '  '): string {
  if (typeof value === 'string')
    return quote(value);
  if (Array.isArray(value))
    return `[${value.map(o => formatObject(o)).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return '{}';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${key}: ${formatObject(value[key])}`);
    return `{\n${indent}${tokens.join(`,\n${indent}`)}\n}`;
  }
  return String(value);
}

function formatObjectOrVoid(value: any, indent = '  '): string {
  const result = formatObject(value, indent);
  return result === '{}' ? '' : result;
}

function formatContextOptions(options: playwright.BrowserContextOptions, deviceName: string | undefined): string {
  const device = deviceName && playwright.devices[deviceName];
  if (!device)
    return formatObjectOrVoid(options);
  // Filter out all the properties from the device descriptor.
  const cleanedOptions: Record<string, any> = {}
  for(const property in options)
    if ((device as any)[property] !== (options as any)[property])
      cleanedOptions[property] = (options as any)[property]
  let serializedObject = formatObjectOrVoid(cleanedOptions);
  // When there are no additional context options, we still want to spread the device inside.
  if (!serializedObject)
    serializedObject = '{\n}';
  const lines = serializedObject.split('\n');
  lines.splice(1, 0, `...devices['${deviceName}'],`);
  return lines.join('\n');
}