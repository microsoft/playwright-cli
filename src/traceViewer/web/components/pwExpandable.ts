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
import psExpandableCss from '!css-loader!./pwExpandable.css';

export class PwExpandableElement extends HTMLElement {
  private _shadowRoot: ShadowRoot;

  private _onExpandedEmitter = new EventEmitter<boolean>();
  readonly onExpanded = this._onExpandedEmitter.event;

  static readonly tagName = 'pw-expandable';
  static readonly styles = [codiconCss, psExpandableCss];
  static stylesFragment: () => DocumentFragment;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: false });
    this._shadowRoot.appendChild(dom`
      ${PwExpandableElement.stylesFragment()}
      <div class="title">
        <slot name="prefix"></slot>
        <pw-small-button icon="${this.hasAttribute('expanded') ? 'chevron-down' : 'chevron-right'}"></pw-small-button>
        <slot name="title"></slot>
      </div>
      <div class="body">
        <slot name="body"></slot>
      </div>
    `);
    this._shadowRoot.querySelector('pw-small-button')!.addEventListener('click', e => {
      this.setExpanded(!this.expanded());
    });
  }

  static get observedAttributes(): string[] {
    return ['expanded'];
  }

  attributeChangedCallback(attr: string, oldValue: string | null, newValue: string | null) {
    if (attr === 'expanded') {
      this._shadowRoot.querySelector('pw-small-button')!.setAttribute('icon', this.expanded() ? 'chevron-down' : 'chevron-right');
      this._onExpandedEmitter.fire(this.expanded());
    }
  }

  expanded(): boolean {
    return this.hasAttribute('expanded');
  }

  setExpanded(checked: boolean) {
    if (checked)
      this.setAttribute('expanded', '');
    else
      this.removeAttribute('expanded');
  }
}
