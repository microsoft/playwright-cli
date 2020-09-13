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
import * as monaco from 'monaco-editor';

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
    this._tabbedPane.onSelected(tab => {
      if (tab === this._sourceTab)
        this._sourceTab.resize();
    });
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

  async setAction(action: ActionTraceEvent) {
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
