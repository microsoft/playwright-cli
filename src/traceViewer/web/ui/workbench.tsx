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

import { ContextEntry, TraceModel } from '../../traceModel';
import { dom } from '../components/dom';
import { ActionListView } from './actionListView';
import { PropertiesTabbedPane } from './propertiesTabbedPane';
import { TimelineView } from './timelineView';
import './workbench.css';
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { ContextSelector } from './contextSelector';

export class Workbench {
  element: HTMLElement;
  private _tabbedPane: PropertiesTabbedPane | undefined;
  private _timelineGrid: TimelineView | undefined;
  private _contextSelectorDiv: HTMLElement;

  constructor(trace: TraceModel) {
    this._contextSelectorDiv = dom`<div></div>`;
    this.element = dom`
      <vbox class="workbench">
      </vbox>
    `;
    window.addEventListener('resize', () => this.pack());
    ReactDOM.render(<ContextSelector contexts={trace.contexts} onChange={context => this.showContext(context)} />, this._contextSelectorDiv);
    this.showContext(trace.contexts[0]);
  }

  showContext(context: ContextEntry) {
    const size = context.created.viewportSize!;
    this._tabbedPane = new PropertiesTabbedPane(size);
    const actionListView = new ActionListView(context, this._tabbedPane);
    this._timelineGrid = new TimelineView(context, { minimum: context.startTime, maximum: context.endTime });
    this.element.textContent = '';
    this.element.appendChild(dom`
      <hbox class="header">
        <div class="logo">🎭</div>
        <div class="product">Playwright</div>
        <div class="spacer"></div>
        ${this._contextSelectorDiv}
      </hbox>
      ${this._timelineGrid.element}
      <hbox>
        ${actionListView.element}
        ${this._tabbedPane.element}
      </hbox>
    `);
    this.pack();
  }

  pack() {
    if (this._timelineGrid)
      this._timelineGrid.pack();
    if (this._tabbedPane)
      this._tabbedPane.pack();
  }
}
