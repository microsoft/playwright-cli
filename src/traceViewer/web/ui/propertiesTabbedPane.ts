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
import { NetworkResourceTraceEvent } from "../../traceTypes";
import { dom, Element$ } from '../components/dom';
import { Size } from "../components/geometry";
import { ListView } from "../components/listView";
import { TabbedPane, TabOptions } from "../components/tabbedPane";

export class PropertiesTabbedPane {
  element: HTMLElement;
  private _tabbedPane: TabbedPane<Tab>;
  private _snapshotTab: SnapshotTab;
  private _sourceTab: SourceTab;
  private _networkTab: NetworkTab;
  private _screenshotTab: ScreenshotTab;
  private _actionEntry: ActionEntry | undefined;

  constructor(size: Size) {
    this._tabbedPane = new TabbedPane<Tab>();
    this.element = this._tabbedPane.element;
    this._snapshotTab = new SnapshotTab(size);
    this._sourceTab = new SourceTab();
    this._networkTab = new NetworkTab();
    this._screenshotTab = new ScreenshotTab(size);
    this._tabbedPane.appendTab(this._snapshotTab);
    this._tabbedPane.appendTab(this._sourceTab);
    this._tabbedPane.appendTab(this._networkTab);
    this._tabbedPane.appendTab(this._screenshotTab);
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

interface Tab extends TabOptions {
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

class SourceTab implements Tab {
  label = 'Source';

  readonly _element: Element$;
  private _editor: monaco.editor.IStandaloneCodeEditor;
  private _fileName: string | undefined;
  private _decorations: string[] = [];

  constructor() {
    this._element = dom`<vbox></vbox>`;
    monaco.editor.setTheme('vs-dark');
    this._editor = monaco.editor.create(this._element, {
      value: '',
      language: 'javascript',
      readOnly: true
    });
    window.addEventListener('resize', () => this.resize());
  }

  async setAction(actionEntry: ActionEntry | undefined) {
    if (!actionEntry) {
      this._editor.setValue('');
      return;
    }
    const { action } = actionEntry;
    const frames = action.stack!.split('\n').slice(1);
    const frame = frames.filter(frame => !frame.includes('playwright/lib/client/'))[0];
    if (!frame) {
      this._editor.setValue(action.stack!);
      return;
    }
    const match = frame.match(/at ([^:]+):(\d+):\d+/);
    if (!match) {
      this._editor.setValue(action.stack!);
      return;
    }
    const fileName = match[1];
    if (this._fileName !== fileName) {
      this._fileName = fileName;
      const content = await (window as any).readFile(fileName);
      this._editor.setValue(content);
    }

    const lineNumber = parseInt(match[2],10);
    this._decorations = this._editor.deltaDecorations(this._decorations, [
      { range: new monaco.Range(lineNumber, 1, lineNumber, 1), options: {
        isWholeLine: true,
        className: 'monaco-execution-line'
      }},
    ]);
    this._editor.revealLine(lineNumber, 1);
  }

  content(): HTMLElement {
    return this._element;
  }

  resize() {
    this._editor.layout();
  }
}

class NetworkTab implements Tab {
  label = 'Network';
  private _listView: ListView<NetworkResourceTraceEvent>;

  constructor() {
    this._listView = new ListView<NetworkResourceTraceEvent>(this);
  }

  render(resource: NetworkResourceTraceEvent, element: HTMLElement): HTMLElement {
    if (element)
      return element;
    return dom`<span>${resource.url}</span>`
  }

  async setAction(actionEntry: ActionEntry | undefined) {
    this._listView.clear();
    if (actionEntry)
      this._listView.appendAll(actionEntry.resources);
  }

  content(): HTMLElement {
    return this._listView.element;
  }
}

class ScreenshotTab implements Tab {
  label = 'Image';
  private _element: Element$;
  private _imageElement: HTMLImageElement;

  constructor(size: Size) {
    this._element = dom`
    <vbox style="align-items: center;">
      <img width=${size.width} height=${size.height}>
    </vbox>`
    this._imageElement = this._element.$('img') as HTMLImageElement;
  }

  render(resource: NetworkResourceTraceEvent, element: HTMLElement): HTMLElement {
    if (element)
      return element;
    return dom`<span>${resource.url}</span>`
  }

  async setAction(actionEntry: ActionEntry | undefined) {
    if (!actionEntry) {
      this._imageElement.src = '';
      return;
    }
    this._imageElement.src = 'trace-storage/' + actionEntry.action.snapshot!.sha1 + '-image.png';
  }

  content(): HTMLElement {
    return this._element;
  }
}
