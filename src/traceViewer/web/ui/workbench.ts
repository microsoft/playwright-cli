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

import './workbench.css';
import { dom } from '../components/dom';
import { ContextEntry, TraceModel } from '../../traceModel';
import { PropertiesTabbedPane } from './propertiesTabbedPane';
import { ActionListView } from './actionListView';
import { FilmStripView } from './filmStripView';
import { TimelineGrid } from './timelineGrid';

export class Workbench {
  element: HTMLElement;
  private _timelineGrid: TimelineGrid;
  private _filmStripView: FilmStripView;

  constructor(trace: TraceModel) {
    const context = trace.contexts[0];
    const size = context.created.viewportSize!;
    const tabbedPane = new PropertiesTabbedPane(size);
    const actionListView = new ActionListView(context, tabbedPane);
    this._timelineGrid = new TimelineGrid();
    this._filmStripView = new FilmStripView(context);  
    this._timelineGrid.setBoundaries(computeTimeSpan(context));

    this.element = dom`
      <vbox class="workbench">
        <hbox class="header">
          <div class="logo">🎭</div>
          <div class="product">Playwright</div>
        </hbox>
        ${this._timelineGrid.element}
        ${this._filmStripView.element}
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
    this._filmStripView.pack();
  }
}

function computeTimeSpan(context: ContextEntry): { minimum: number, maximum: number} {
  let minimum = Number.MAX_VALUE;
  let maximum = Number.MIN_VALUE;
  for (const page of context.pages) {
    for (const action of page.actions) {
      minimum = Math.min(action.action.startTime!, minimum);
      maximum = Math.max(action.action.endTime!, maximum);
    }
  }
  return { minimum, maximum };
}