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

import { PageEntry, ContextEntry } from '../../traceModel';
import { dom, Element$ } from '../components/dom';
import { ListView } from '../components/listView';
import './videoListView.css';

export class VideoListView {
  readonly element: Element$;
  private _listView = new ListView<PageEntry>(this, { orientation: 'horizontal' });
  private _context: ContextEntry;

  constructor(context: ContextEntry) {
    this._context = context;
    for (const page of context.pages) {
      if (page.video)
        this._listView.append(page);
    }
    this.element = dom`
      <video-list class="empty">
        ${this._listView.element}
      </video-list>
    `;
  }

  render(pageEntry: PageEntry, element: HTMLElement): HTMLElement {
    if (element) {
      return element;
    }
    return dom`
      <video controls>
        <source src="context-artifact/${this._context.created.contextId}/${pageEntry.video!.fileName}" type="video/webm">
        Your browser does not support HTML video.
      </video>`;
  }
}
