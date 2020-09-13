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

import { ActionTraceEvent } from "../../traceTypes";
import { dom, Element$ } from '../components/dom';
import { Size } from "../components/geometry";
import { TabbedPane } from "../components/tabbedPane";

export class PropertiesTabbedPane {
  element: HTMLElement;
  private _tabbedPane: TabbedPane<any>;
  private _snapshotTab: SnapshotTab;
  private _sourceTab: SourceTab;

  constructor(size: Size) {
    this._tabbedPane = new TabbedPane();
    this.element = this._tabbedPane.element;
    this._snapshotTab = new SnapshotTab(size);
    this._sourceTab = new SourceTab();
    this._tabbedPane.appendTab(this._snapshotTab);
    this._tabbedPane.appendTab(this._sourceTab);
  }

  async setAction(action: ActionTraceEvent) {
    this._snapshotTab.setAction(action);
    this._sourceTab.setAction(action);
  }
}

class SnapshotTab {
  label = 'Snapshot';

  private _element: Element$;
  private _iframe: HTMLIFrameElement;

  constructor(size: Size) {
    this._element = dom`
    <hbox>
      <vbox></vbox>
      <vbox style="overflow: auto">
        <div style="width: ${size.width}px; height: ${size.height}px; display: block; background: white">
          <iframe style="width: 100%; height: 100%; border: none"></iframe>
        </div>
      <vbox>
      <vbox></vbox>
    </hbox>
    `;
    this._iframe = this._element.$('iframe') as HTMLIFrameElement;
  }

  async setAction(action: ActionTraceEvent) {
    const url = await (window as any).renderSnapshot(action);
    this._iframe.src = url;
  }

  content(): HTMLElement {
    return this._element;
  }
}

class SourceTab {
  label = 'Source';

  readonly _element: Element$;

  constructor() {
    this._element = dom`<div></div>`;
  }

  setAction(action: ActionTraceEvent) {
    this._element.textContent = action.stack || '';
  }

  content(): HTMLElement {
    return this._element;
  }
}
