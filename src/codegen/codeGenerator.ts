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
import { Frame } from 'playwright';
import { LanguageGenerator } from './languages'
import { Action, Signal } from './recorderActions';

export type ActionInContext = {
  pageAlias: string;
  frame: Frame;
  action: Action;
  committed?: boolean;
}

export interface CodeGeneratorOutput {
  writeLn(text: string): void
  popLine(): void
  flush(): void
}

export class CodeGenerator {
  private _currentAction: ActionInContext | undefined;
  private _lastAction: ActionInContext | undefined;
  private _lastActionText: string | undefined;
  private _languageGenerator: LanguageGenerator;
  private _output: CodeGeneratorOutput;
  private _footerText: string;
  private _footerLineCount: number;

  constructor(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, output: CodeGeneratorOutput, languageGenerator: LanguageGenerator, deviceName: string | undefined) {
    this._output = output
    this._languageGenerator = languageGenerator

    launchOptions = { headless: false, ...launchOptions };
    const header = this._languageGenerator.generateHeader(browserName, launchOptions, contextOptions, deviceName);
    this._output.writeLn(header);
    this._footerText = '\n' + this._languageGenerator.generateFooter();
    this._output.writeLn(this._footerText);
    this._footerLineCount = this._footerText.split('\n').length;
  }

  exit() {
    this._output.flush();
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
    let linesToErase = this._footerLineCount;
    if (eraseLastAction && this._lastActionText)
      linesToErase += this._lastActionText.split('\n').length;
    for (let i = 0; i < linesToErase; ++i)
      this._output.popLine();
    const performingAction = !!this._currentAction;
    this._currentAction = undefined;
    this._lastAction = actionInContext;
    this._lastActionText = this._languageGenerator.generateAction(actionInContext, performingAction);
    this._output.writeLn(this._lastActionText);
    this._output.writeLn(this._footerText);
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
}
