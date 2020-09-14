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

import { ActionEntry, ContextEntry } from '../../traceModel';
import { dom, Element$ } from '../components/dom';
import { ListView } from '../components/listView';
import { PropertiesTabbedPane } from './propertiesTabbedPane';
import './actionListView.css';

export class ActionListView {
  readonly element: Element$;
  private _listView = new ListView<ActionEntry>(this);

  constructor(context: ContextEntry, tabbedPane: PropertiesTabbedPane) {
    for (const page of context.pages)
      this._listView.appendAll(page.actions);
    this.element = dom`
      <action-list class="empty">
        ${this._listView.element}
      </action-list>
    `;
    this._listView.onSelectionChanged(actions => tabbedPane.setAction(actions[0]));
  }

  render(actionEntry: ActionEntry, element: HTMLElement): HTMLElement {
    const { action } = actionEntry;
    if (element) {
      return element;
    }
    return dom`
      <action-entry>
        <action-header>
          <action-title>${action.action}</action-title>
          <action-selector title="${action.target}">${action.target}</action-selector>
        </action-header>
        <action-thumbnail>
          <img src="trace-storage/${action.snapshot!.sha1}-thumbnail.png">
        </action-thumbnail>
      </action-entry>`;
  }
}
