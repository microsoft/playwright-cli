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
import { LanguageGenerator } from '.';
import { ActionInContext, CodeGeneratorOutput } from '../codeGenerator';
import { actionTitle, NavigationSignal, PopupSignal, DownloadSignal, DialogSignal, Action } from '../recorderActions'
import { MouseClickOptions, toModifiers } from '../../utils';

export class JavaScriptLanguageGenerator implements LanguageGenerator {
  private _output: CodeGeneratorOutput
  constructor(output: CodeGeneratorOutput) {
    this._output = output;
  }

  preWriteAction(eraseLastAction: boolean, lastActionText?: string): void {
    // We erase terminating `})();` at all times.
    let eraseLines = 1;
    if (eraseLastAction && lastActionText)
      eraseLines += lastActionText.split('\n').length;
    // And we erase the last action too if augmenting.
    for (let i = 0; i < eraseLines; ++i)
      this._output.popLine()
  }

  postWriteAction(lastActionText: string): void {
    this._output.write(lastActionText + '\n})();\n');
  }

  generateAction(actionInContext: ActionInContext, performingAction: boolean): string {
    const { action, pageAlias, frame } = actionInContext;
    const formatter = new JavaScriptFormatter(2);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    if (action.name === 'openPage') {
      formatter.add(`const ${pageAlias} = await context.newPage();`);
      if (action.url && action.url !== 'about:blank' && action.url !== 'chrome://newtab/')
        formatter.add(`${pageAlias}.load('${action.url}');`);
      return formatter.format();
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
    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name) {
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

  writeHeader(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, deviceName?: string): void {
    const formatter = new JavaScriptFormatter();
    formatter.add(`
      const { ${browserName}${deviceName ? ', devices' : ''} } = require('playwright');

      (async () => {
        const browser = await ${browserName}.launch(${formatObjectOrVoid(launchOptions)});
        const context = await browser.newContext(${formatContextOptions(contextOptions, deviceName)});
      })();`);
    this._output.write(formatter.format() + '\n');
  }

  writeFooter(): void {
    this._output.popLine();
    this._output.write('  // Close browser\n');
    this._output.write('  await browser.close();\n})();\n');
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
  for (const property in options)
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

class JavaScriptFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(2);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }

  add(text: string) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }

  newLine() {
    this._lines.push('');
  }

  format(): string {
    let spaces = '';
    let previousLine = '';
    return this._lines.map((line: string) => {
      if (line === '')
        return line;
      if (line.startsWith('}') || line.startsWith(']'))
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('['))
        spaces += this._baseIndent;
      return this._baseOffset + line;
    }).join('\n');
  }
}

const quoteChar = '\'';
function quote(text: string): string {
  return quoteChar + text.replace(/[']/g, '\\\'')
    .replace(/\\/g, '\\\\') + quoteChar;
}
