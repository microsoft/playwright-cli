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
import { ListView } from './listView';
import { ToolbarView } from './toolbarView';
import { EventEmitter } from './events';

export interface TabOptions {
  label: string;
  color?: string;
  closable?: boolean;
  content(): HTMLElement;
}

export class TabbedPane<T extends TabOptions> {
  readonly element: Element$;
  readonly toolbar: ToolbarView;
  readonly postTabToolbar: ToolbarView;
  readonly settingsToolbar: ToolbarView;
  private _tabStrip: ListView<T>;
  private _contentElement: HTMLElement;

  private _onSelectedEmitter = new EventEmitter<T | undefined>();
  private _onDeletedEmitter = new EventEmitter<T>();
  private _onCloseRequestEmitter = new EventEmitter<T>();

  readonly onSelected = this._onSelectedEmitter.event;
  readonly onDeleted = this._onDeletedEmitter.event;
  readonly onCloseRequest = this._onCloseRequestEmitter.event;

  constructor() {
    this._tabStrip = new ListView<T>(this, {
      orientation: 'horizontal'
    });
    this.toolbar = new ToolbarView();
    this.postTabToolbar = new ToolbarView();
    this.settingsToolbar = new ToolbarView();

    this.element = dom`
      <tabbed-pane>
        <vbox>
          <hbox style="flex: none">
            ${this.toolbar.element}
            <tab-strip>
              ${this._tabStrip.element}
              ${this.postTabToolbar.element}
            </tab-strip>
            ${this.settingsToolbar.element}
          </hbox>
          <tab-content>
          </tab-content>  
        </vbox>
      </tabbed-pane>
    `;
    this._contentElement = this.element.$('tab-content');
    this._tabStrip.onSelectionChanged((tabs: T[]) => {
      if (!tabs.length)
        return;
      this._contentElement.textContent = '';
      this._contentElement.appendChild(tabs[0].content());
      this._onSelectedEmitter.fire(tabs[0]);
    });
  }

  render(tab: T): HTMLElement {
    const result = dom`
      <tab-element style="--tab-color: ${tab.color || 'var(--color)'}">
        <tab-label>${tab.label}</tab-label>
      </tab-element>
    `;
    if (tab.closable) {
      const closeElement = dom`
        <tab-close class="codicon codicon-close"></tab-close>
      `;
      closeElement.addEventListener('click', e => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        this._onCloseRequestEmitter.fire(tab);
      });
      result.appendChild(closeElement);
    }
    return result;
  }

  appendTab(tab: T) {
    this._tabStrip.append(tab);
    if (!this._tabStrip.selection().length)
      this._tabStrip.setSelection(tab);
  }

  selectTab(tab: T) {
    this._tabStrip.setSelection(tab);
  }

  updateTab(tab: T) {
    this._tabStrip.update(tab);
  }

  removeTab(tab: T) {
    this._tabStrip.delete(tab);
  }

  removeAllTabs() {
    this._tabStrip.clear();
  }

  selectedTab(): T | undefined {
    return this._tabStrip.selection()[0];
  }

  tabs(): T[] {
    return this._tabStrip.entries();
  }
}
