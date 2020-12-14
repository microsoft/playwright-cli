/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { dom } from './dom';
import { EventEmitter } from './events';

const currentDialogSymbol = Symbol();

export class Dialog<T> {
  private _root: Element;
  private _content: Element;
  private _element?: Element;
  private _onHideEmitter = new EventEmitter<T | undefined>();
  readonly onHide = this._onHideEmitter.event;

  constructor(content: Element, root?: Element) {
    this._root = root || document.documentElement;
    this._content = content;
  }

  _show() {
    if ((this._root as any)[currentDialogSymbol])
      throw new Error('Cannot show dialog when previous is still pending');
    (this._root as any)[currentDialogSymbol] = this;
    const element = dom`
      <dialog-view>
        <dialog-view-content>
          ${this._content}
        </dialog-view-content>
      </dialog-view>
    `;
    element.$('dialog-view-content').addEventListener('mousedown', e => {
      e.stopPropagation();
    });
    element.addEventListener('mousedown', e => {
      this._hide();
    });
    element.addEventListener('keydown', e => {
      if (e.key === 'Escape')
        this._hide();
    }, false);
    this._root.appendChild(element);
    const tabindex = element.querySelector('[tabindex]') as HTMLElement;
    if (tabindex)
      tabindex.focus();
    this._element = element;
  }

  _hide(result?: T, skipEvent?: boolean) {
    if ((this._root as any)[currentDialogSymbol] !== this)
      throw new Error('There is no dialog to close!');
    (this._root as any)[currentDialogSymbol] = undefined;
    this._element!.remove();
    this._element = undefined;
    if (!skipEvent)
      this._onHideEmitter.fire(result);
  }

  show(): Promise<T | undefined> {
    return new Promise(f => {
      const disposable = this.onHide(result => {
        disposable();
        f(result);
      });
      this._show();
    });
  }

  hide() {
    this._hide(undefined, true);
  }
}

export type PromptOptions = {
  message?: string;
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export class PromptDialog extends Dialog<string> {
  constructor(placeholder: string, options?: PromptOptions, root?: Element) {
    const dialogElement = dom`
      <dialog-prompt>
        <message hidden="${!options || !options.message}">${options ? options.message : ''}</message>
        <input class=prompt tabindex=0 type=text placeholder=${placeholder || ''}></input>
      </dialog-prompt>`;
    const input = dialogElement.$('input') as HTMLInputElement;
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter')
        return;
      event.stopPropagation();
      event.preventDefault();
      this._hide(input.value);
    });
    if (options && options.value !== undefined)
      input.value = options.value;
    if (options && options.selectionStart !== undefined)
      input.selectionStart = options.selectionStart;
    if (options && options.selectionEnd !== undefined)
      input.selectionEnd = options.selectionEnd;

    super(dialogElement, root);
  }
}

export class AlertDialog extends Dialog<boolean> {
  constructor(message: string, root?: Element) {
    const dialogElement = dom`
      <dialog-alert>
        <message>${message}</message>
        <button tabIndex=0>OK</button>
      </dialog-alert>`;
    const button = dialogElement.$('button') as HTMLButtonElement;
    button.addEventListener('click', () => this._hide(true));
    super(dialogElement, root);
  }
}

export class ConfirmDialog extends Dialog<boolean> {
  constructor(message: string, root?: Element) {
    const dialogElement = dom`
      <dialog-confirm>
        <message>${message}</message>
        <button-row>
          <button class="ok" tabIndex=0>OK</button>
          <button class="cancel" tabIndex=0>Cancel</button>
        </button-row>
      </dialog-confirm>`;
    dialogElement.$('.ok').addEventListener('click', () => this._hide(true));
    dialogElement.$('.cancel').addEventListener('click', () => this._hide(false));
    super(dialogElement, root);
  }
}
