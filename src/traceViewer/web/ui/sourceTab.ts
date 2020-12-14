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
import { ActionEntry } from '../../traceModel';
import { dom, Element$ } from '../components/dom';
import { Tab } from './propertiesTabbedPane';

export class SourceTab implements Tab {
  label = 'Source';

  readonly _element: Element$;
  private _editor: monaco.editor.IStandaloneCodeEditor;
  private _fileName: string | undefined;
  private _decorations: string[] = [];

  constructor() {
    this._element = dom`<vbox></vbox>`;
    monaco.editor.setTheme('vs-light');
    this._editor = monaco.editor.create(this._element, {
      value: '',
      language: 'javascript',
      readOnly: true
    });
    window.addEventListener('resize', () => this.pack());
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

    const lineNumber = parseInt(match[2], 10);
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

  pack() {
    this._editor.layout();
  }
}
