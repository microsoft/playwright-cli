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

import { EventEmitter } from './events';
import { dom } from './dom';

// @ts-ignore
import codiconCss from '!css-loader!../third_party/vscode/codicon.css';
// @ts-ignore
import pwCheckboxCss from '!css-loader!./pwCheckbox.css';

export class PwCheckboxElement extends HTMLElement {
  private _shadowRoot: ShadowRoot;
  private _checkboxElement: HTMLElement;
  private _onCheckedEmitter = new EventEmitter<boolean>();
  readonly onChecked = this._onCheckedEmitter.event;

  static readonly tagName = 'pw-checkbox';
  static readonly styles = [codiconCss, pwCheckboxCss];
  static stylesFragment: () => DocumentFragment;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: false });
    this._shadowRoot.appendChild(dom`
      ${PwCheckboxElement.stylesFragment()}
      <div class="codicon" tabIndex=0></div>
      <span><slot></slot></span>
    `);
    this._checkboxElement = this._shadowRoot.querySelector('.codicon') as HTMLElement;
    this._checkboxElement.addEventListener('click', () => this.setChecked(!this.checked()));
    this._checkboxElement.classList.toggle('codicon-check', this.checked());
  }

  static get observedAttributes(): string[] {
    return ['checked'];
  }

  attributeChangedCallback(attr: string, oldValue: string | null, newValue: string | null) {
    if (attr === 'checked') {
      this._onCheckedEmitter.fire(this.checked());
      this._checkboxElement.classList.toggle('codicon-check', this.checked());
    }
  }

  checked(): boolean {
    return this.hasAttribute('checked');
  }

  setChecked(checked: boolean) {
    if (this.checked() === checked)
      return;
    if (checked)
      this.setAttribute('checked', '');
    else
      this.removeAttribute('checked');
  }
}
