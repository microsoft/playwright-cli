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

// @ts-ignore
import codiconCss from '!css-loader!../third_party/vscode/codicon.css';
// @ts-ignore
import pwSmallButtonCss from '!css-loader!./pwSmallButton.css';

export class PwSmallButtonElement extends HTMLElement {
  private _shadowRoot: ShadowRoot;

  static readonly tagName = 'pw-small-button';
  static readonly styles = [codiconCss, pwSmallButtonCss];
  static stylesFragment: () => DocumentFragment;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: false });
    this._shadowRoot.appendChild(dom`
      ${PwSmallButtonElement.stylesFragment()}
      <div class="codicon codicon-${this.getAttribute('icon')}"></div>
    `);
  }

  static get observedAttributes(): string[] {
    return ['icon'];
  }

  attributeChangedCallback(attr: string, oldValue: string | null, newValue: string | null) {
    if (attr === 'icon')
      this._shadowRoot.querySelector('div')!.className = `codicon codicon-${newValue}`;
  }
}
