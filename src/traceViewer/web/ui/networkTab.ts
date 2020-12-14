/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ActionEntry } from '../../traceModel';
import { NetworkResourceTraceEvent } from '../../traceTypes';
import { dom, Element$ } from '../components/dom';
import { ListView } from '../components/listView';
import { Tab } from './propertiesTabbedPane';
import './networkTab.css';
import { PwExpandableElement } from '../components/pwExpandable';

export class NetworkTab implements Tab {
  label = 'Network';
  element: HTMLElement;
  private _listView: ListView<NetworkResourceTraceEvent>;

  constructor() {
    this._listView = new ListView<NetworkResourceTraceEvent>(this);
    this.element = dom`
      <network-tab>
        ${this._listView.element}
      </network-tab>
    `;
    this._listView.element.addEventListener('keydown', e => {
      const selected = this._listView.selection()[0];
      if (!selected)
        return;
      const expandable = (this._listView.renderedElement(selected) as Element$).$('pw-expandable') as PwExpandableElement;
      if (e.key === 'ArrowLeft')
        expandable.setExpanded(false);
      if (e.key === 'ArrowRight')
        expandable.setExpanded(true);
    });
  }

  render(resource: NetworkResourceTraceEvent, element: HTMLElement): HTMLElement {
    if (element)
      return element;
    const resourceElement = dom`
      <network-request slot="title">
        <pw-expandable style="width: 100%;">
          <request-title slot="title"><div>${resource.url}</div></request-title>
          <request-details slot="body">${resource.responseHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</request-details>
        </pw-expandable>
    </network-request>`;
    const expandable = resourceElement.$('pw-expandable') as PwExpandableElement;
    resourceElement.$('request-title').addEventListener('click', () => expandable.setExpanded(!expandable.expanded()));
    return resourceElement;
  }

  async setAction(actionEntry: ActionEntry | undefined) {
    this._listView.clear();
    if (actionEntry)
      this._listView.appendAll(actionEntry.resources);
  }

  content(): HTMLElement {
    return this.element;
  }
}
