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

import { TraceModel } from '../../traceModel';
import { dom } from '../components/dom';
import { ActionListView } from './actionListView';
import { PropertiesTabbedPane } from './propertiesTabbedPane';
import { TimelineView } from './timelineView';
import './workbench.css';

export class Workbench {
  element: HTMLElement;
  private _timelineGrid: TimelineView;

  constructor(trace: TraceModel) {
    const context = trace.contexts[0];
    const size = context.created.viewportSize!;
    const tabbedPane = new PropertiesTabbedPane(size);
    const actionListView = new ActionListView(context, tabbedPane);
    this._timelineGrid = new TimelineView(context, { minimum: trace.startTime, maximum: trace.endTime });

    this.element = dom`
      <vbox class="workbench">
        <hbox class="header">
          <div class="logo">🎭</div>
          <div class="product">Playwright</div>
        </hbox>
        ${this._timelineGrid.element}
        <hbox>
          ${actionListView.element}
          ${tabbedPane.element}
        </hbox>
      </vbox>
    `;
    window.addEventListener('resize', () => this.pack());
  }

  pack() {
    this._timelineGrid.pack();
  }
}
