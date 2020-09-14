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

import * as monaco from 'monaco-editor';
import { ActionEntry } from "../../traceModel";
import { dom, Element$ } from '../components/dom';
import { Size } from "../components/geometry";
import { TabbedPane, TabOptions } from "../components/tabbedPane";
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';

export class PropertiesTabbedPane {
  element: HTMLElement;
  private _tabbedPane: TabbedPane<Tab>;
  private _snapshotTab: SnapshotTab;
  private _sourceTab: SourceTab;
  private _networkTab: NetworkTab;
  private _actionEntry: ActionEntry | undefined;

  constructor(size: Size) {
    this._tabbedPane = new TabbedPane<Tab>();
    this.element = this._tabbedPane.element;
    this._snapshotTab = new SnapshotTab(size);
    this._sourceTab = new SourceTab();
    this._networkTab = new NetworkTab();
    this._tabbedPane.appendTab(this._snapshotTab);
    this._tabbedPane.appendTab(this._sourceTab);
    this._tabbedPane.appendTab(this._networkTab);
    this._tabbedPane.onSelected(tab => {
      if (tab === this._sourceTab)
        this._sourceTab.resize();
      if (tab)
        tab.setAction(this._actionEntry);
    });
  }

  async setAction(actionEntry: ActionEntry) {
    this._actionEntry = actionEntry;
    const selectedTab = this._tabbedPane.selectedTab();
    if (selectedTab)
      selectedTab.setAction(actionEntry);
  }
}

export interface Tab extends TabOptions {
  setAction(action: ActionEntry | undefined): Promise<void>;
}

class SnapshotTab implements Tab {
  label = 'Snapshot';

  private _element: Element$;

  constructor(size: Size) {
    this._element = dom`
    <hbox>
      <vbox></vbox>
      <vbox style="overflow: auto">
        <div style="width: ${size.width}px; height: ${size.height}px; display: block; background: white">
          <iframe id=snapshot name=snapshot style="width: 100%; height: 100%; border: none"></iframe>
        </div>
      <vbox>
      <vbox></vbox>
    </hbox>
    `;
  }

  async setAction(actionEntry: ActionEntry | undefined) {
    if (!actionEntry) {
      (this._element.$('iframe') as HTMLIFrameElement).src = 'about:blank';
      return;
    }
    await (window as any).renderSnapshot(actionEntry.action);
  }

  content(): HTMLElement {
    return this._element;
  }
}
