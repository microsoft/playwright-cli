// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { ActionTraceEvent } from '../../traceTypes';
import { TraceEvent } from '../../traceViewer';
import { dom, Element$ } from '../components/dom';
import { ListView } from '../components/listView';
import { PropertiesTabbedPane } from './propertiesTabbedPane';

export class ActionListView {
  readonly element: Element$;
  private _listView = new ListView<ActionTraceEvent>(this);

  constructor(events: TraceEvent[], tabbedPane: PropertiesTabbedPane) {
    this._listView.appendAll(events.filter(e => e.type === 'action') as ActionTraceEvent[]);
    this.element = dom`
      <action-list class="empty">
        ${this._listView.element}
      </action-list>
    `;
    this._listView.onSelectionChanged(actions => tabbedPane.setAction(actions[0]));
  }

  render(action: ActionTraceEvent, element: HTMLElement): HTMLElement {
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
          <action-selector>${action.target}</action-selector>
        </action-header>
      </action-entry>`;
  }
}
