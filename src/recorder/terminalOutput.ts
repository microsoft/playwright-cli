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
import { Action, actionTitle, NavigationSignal, PopupSignal, Signal } from './recorderActions';
import { MouseClickOptions, toModifiers } from './utils';
import { highlight } from 'highlight.js';

export class TerminalOutput {
  private _lastAction: Action | undefined;
  private _lastActionText: string | undefined;
  private _out: Writable;

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, out: Writable) {
    this._out = out;
    const formatter = new Formatter();
    launchOptions = { headless: false, ...launchOptions };

    formatter.add(`
      const { ${browserName} } = require('playwright');

      (async() => {
        const browser = await ${browserName}.launch(${formatObject(launchOptions)});
        const context = await browser.newContext(${formatObject(contextOptions)});
        const page = await context.newPage();
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
    highlightedCode = highlightedCode.replace(/<\/span>/g, '\x1b[0m');
    highlightedCode = highlightedCode.replace(/&#x27;/g, "'");
    highlightedCode = highlightedCode.replace(/&quot;/g, '"');    
    highlightedCode = highlightedCode.replace(/&gt;/g, '>');
    highlightedCode = highlightedCode.replace(/&lt;/g, '<');
    return highlightedCode;
  }

  addAction(pageAlias: string, frame: playwright.Frame, action: Action) {
    // We augment last action based on the type.
    if (action.name === 'commit') {
      if (this._lastAction)
        this._lastAction.committed = true;
      return;
    }
    let eraseLastAction = false;
    if (this._lastAction && action.name === 'fill' && this._lastAction.name === 'fill') {
      if (action.selector === this._lastAction.selector)
        eraseLastAction = true;
    }
    if (this._lastAction && action.name === 'click' && this._lastAction.name === 'click') {
      if (action.selector === this._lastAction.selector && action.clickCount > this._lastAction.clickCount)
        eraseLastAction = true;
    }
    if (this._lastAction && action.name === 'navigate' && this._lastAction.name === 'navigate') {
      if (action.url === this._lastAction.url)
        return;
    }
    for (const name of ['check', 'uncheck']) {
      if (this._lastAction && action.name === name && this._lastAction.name === 'click') {
        if ((action as any).selector === (this._lastAction as any).selector)
          eraseLastAction = true;
      }
    }
    this._printAction(pageAlias, frame, action, eraseLastAction);
  }

  _printAction(pageAlias: string, frame: playwright.Frame, action: Action, eraseLastAction: boolean) {
    // We erase terminating `})();` at all times.
    let eraseLines = 1;
    if (eraseLastAction && this._lastActionText)
      eraseLines += this._lastActionText.split('\n').length;
    // And we erase the last action too if augmenting.
    for (let i = 0; i < eraseLines; ++i)
      this._out.write('\u001B[1A\u001B[2K');

    this._lastAction = action;
    this._lastActionText = this._generateAction(pageAlias, frame, action);
    this._out.write(this._lastActionText + '\n})();\n');
  }

  lastAction(): Action | undefined {
    return this._lastAction;
  }

  signal(pageAlias: string, frame: playwright.Frame, signal: Signal) {
    if (this._lastAction) {
      this._lastAction.signals.push(signal);
      this._printAction(pageAlias, frame, this._lastAction, true);
    }
  }

  private _generateAction(pageAlias: string, frame: playwright.Frame, action: Action): string {
    const formatter = new Formatter(2);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    const subject = !frame.parentFrame() ? pageAlias :
      `${pageAlias}.frame(${formatObject({ url: frame.url() })})`;

    let navigationSignal: NavigationSignal | undefined;
    let popupSignal: PopupSignal | undefined;
    for (const signal of action.signals) {
      if (signal.name === 'navigation')
        navigationSignal = signal;
      if (signal.name === 'popup')
        popupSignal = signal;
    }

    const waitForNavigation = navigationSignal && navigationSignal.type === 'await';
    const assertNavigation = navigationSignal && navigationSignal.type === 'assert';

    const emitPromiseAll = waitForNavigation || popupSignal;
    if (emitPromiseAll) {
      // Generate either await Promise.all([]) or
      // const [popup1] = await Promise.all([]).
      let leftHandSide = '';
      if (popupSignal)
        leftHandSide = `const [${popupSignal.popupAlias}] = `;
      formatter.add(`${leftHandSide}await Promise.all([`);
    }

    // Popup signals.
    if (popupSignal)
      formatter.add(`${pageAlias}.waitForEvent('popup'),`);

    // Navigation signal.
    if (waitForNavigation)
      formatter.add(`${pageAlias}.waitForNavigation(/*{ url: ${quote(navigationSignal!.url)} }*/),`);

    const prefix = popupSignal || waitForNavigation ? '' : 'await ';
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
      case 'commit':
          return ``;
      case 'uncheck':
        return `uncheck(${quote(action.selector)})`;
      case 'fill':
        return `fill(${quote(action.selector)}, ${quote(action.text)})`;
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
