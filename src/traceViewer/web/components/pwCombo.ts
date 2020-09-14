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
import { dom, Element$ } from './dom';
import { ListView } from './listView';

// @ts-ignore
import codiconCss from '!css-loader!../third_party/vscode/codicon.css';
// @ts-ignore
import pwComboCss from '!css-loader!./pwCombo.css';
// @ts-ignore
import listViewCss from '!css-loader!./listView.css';

type PwComboOption = { value: string, subtitle?: string, label?: string };
type ChangeSource = 'option' | 'input';

export class PwComboElement extends HTMLElement {
  readonly input: HTMLInputElement;
  private _shadowRoot: ShadowRoot;
  private _options: PwComboOption[] = [];
  private _menuElement: Element$;
  private _listView: ListView<PwComboOption>;
  private _glassPane: HTMLElement;

  static readonly tagName = 'pw-combo';
  static readonly styles = [codiconCss, pwComboCss, listViewCss];
  static stylesFragment: () => DocumentFragment;

  private _onChangedEmitter = new EventEmitter<ChangeSource>();
  readonly onChanged = this._onChangedEmitter.event;

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: false });
    this._shadowRoot.appendChild(dom`
      ${PwComboElement.stylesFragment()}
      <input type="text" spellcheck="false">
      <div class="codicon codicon-chevron-down"></div>
    `);

    this.input = this._shadowRoot.querySelector('input') as HTMLInputElement;
    this.input.addEventListener('input', () => this._onChangedEmitter.fire('input'));
    const icon = this._shadowRoot.querySelector('.codicon')!;
    icon.addEventListener('click', () => {
      const rect = this.getBoundingClientRect();
      this._listView.clear();
      this._listView.appendAll(this._options);
      this._menuElement.style.width = rect.width + 'px';
      this._menuElement.style.left = rect.left + 'px';
      this._menuElement.style.setProperty('--top', (rect.bottom + 1) + 'px');
      document.body.appendChild(this._glassPane);
      this._glassPane.focus();
    });

    this._listView = new ListView<PwComboOption>({ render: option => this._renderOption(option) });
    this._menuElement = dom`<div class="hbox pw-combo-menu">${this._listView.element}</div>`;
    this._glassPane = createGlassPane();
    const shadowRoot = this._glassPane.attachShadow({ mode: 'open', delegatesFocus: false });
    shadowRoot.appendChild(PwComboElement.stylesFragment());
    shadowRoot.appendChild(this._menuElement);
    this._glassPane.addEventListener('keydown', e => {
      if (e.key === 'Escape')
        this._hideMenu();
      e.stopPropagation();
      e.preventDefault();
    });
    this._glassPane.addEventListener('mousedown', e => {
      this._hideMenu();
      e.stopPropagation();
    });
    this._menuElement.addEventListener('mousedown', e => {
      e.stopPropagation();
    });
  }

  value(): string {
    return this.input.value;
  }

  setValue(value: string) {
    this.input.value = value;
  }

  options(): PwComboOption[] {
    return this._options.slice();
  }

  setOptions(options: (string | PwComboOption)[]) {
    this._options = options.map(o => typeof o === 'string' ? { value: o } : o);
  }

  focus() {
    this.input.focus();
  }

  _renderOption(option: PwComboOption): HTMLElement {
    const label = option.label === undefined ? option.value : option.label;
    const item = dom`
      <div class="hbox pw-combo-menu-item" title="${label}">
        <span>${label}</span>${option.subtitle ? dom`<span class=subtitle>${option.subtitle}</span>` : undefined}
      </div>
    `;
    item.addEventListener('click', event => {
      event.stopPropagation();
      event.preventDefault();
      this._hideMenu();
      this.input.value = option.value;
      this._onChangedEmitter.fire('option');
    });
    return item;
  }

  _hideMenu() {
    this._glassPane.remove();
    this.input.focus();
  }
}

function createGlassPane(): HTMLElement {
  const pane = document.createElement('div');
  pane.style.position = 'absolute';
  pane.style.top = '0';
  pane.style.bottom = '0';
  pane.style.left = '0';
  pane.style.right = '0';
  pane.style.zIndex = '1000';
  pane.setAttribute('tabIndex', '0');
  return pane;
}
