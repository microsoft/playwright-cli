// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ActionEntry, ContextEntry } from '../../traceModel';
import { dom, Element$ } from '../components/dom';
import { ListView } from '../components/listView';
import { PropertiesTabbedPane } from './propertiesTabbedPane';

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
    let icon = '';
    if (action.action === 'click' || action.action === 'dblclick')
      icon = '🖱️ ';
    if (action.action === 'fill' || action.action === 'press')
      icon = '⌨️ ';
    return dom`
      <action-entry>
        <action-header>
          <action-title>${icon}${action.action}</action-title>
          <action-selector title="${action.target}">${action.target}</action-selector>
        </action-header>
        <action-thumbnail>
          <img src="trace-storage/${action.snapshot!.sha1}-target-image.png">
        </action-thumbnail>
      </action-entry>`;
  }
}
