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

import { dom, Element$ } from './dom';
import { Action, ActionOptions, actionRegistry } from './actionRegistry';
import { ListView } from './listView';
import { Disposable } from './events';

export class ToolbarView {
  readonly element: Element$;
  private _listView: ListView<Action>;
  private _enabled = true;
  private _disposables: Disposable[] = [];

  constructor() {
    this._listView = new ListView<Action>(this, {
      orientation: 'horizontal'
    });
    this.element = dom`<toolbar-view>${this._listView.element}</toolbar-view>`;
  }

  render(action: Action): HTMLElement {
    const icon = action.toggled() ? action.toggledIcon || action.icon : action.icon;
    const toggledStyle = action.toggled() && (action.label || !action.toggledIcon) ? 'toggled' : '';
    const label = action.iconClass || icon ? '' : action.label;
    const item = dom`
      <toolbar-item title="${action.title}" class="${this._enabled && action.enabled() ? '' : 'disabled'} ${toggledStyle}">
        <toolbar-icon class="${action.iconClass}">${icon || ''}</toolbar-icon>
        <toolbar-label>${label}</toolbar-label>
      </toolbar-item>
    `;
    item.addEventListener('mousedown', event => {
      event.preventDefault();
    });
    item.addEventListener('click', event => {
      event.stopPropagation();
      event.preventDefault();
      if (this._enabled)
        action.handle(event);
    });
    return item;
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
    this._listView.updateAll();
  }

  addItem(action: Action): Action;
  addItem(options: ActionOptions): Action;
  addItem(param: ActionOptions | Action): Action {
    const action = param instanceof Action ? param : actionRegistry.createAction(param);
    this._disposables.push(action.onUpdated(() => this._listView.update(action)));
    this._listView.append(action);
    return action;
  }

  clear() {
    this._listView.clear();
    Disposable.disposeAll(this._disposables);
  }
}
