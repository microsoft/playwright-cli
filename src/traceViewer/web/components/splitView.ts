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

import { Disposable } from './events';
import { dom, Element$, onDOMEvent } from './dom';

export class SplitView {
  readonly element: Element$;
  private _sidebar: HTMLElement;
  private _main: HTMLElement;

  static create({sidebarPosition, main, sidebar, size}: {size?: number, sidebarPosition: ('left'|'right'|'top'|'bottom'), main: HTMLElement, sidebar?: HTMLElement}): SplitView {
    const splitView = new SplitView(sidebarPosition);
    splitView.setSidebarElement(sidebar || null);
    if (size)
      splitView.setSidebarSize(size);
    splitView.setMainElement(main);
    return splitView;
  }

  constructor(sidebarPosition: ('left'|'right'|'top'|'bottom') = 'left') {
    this._sidebar = dom`<split-view-sidebar></split-view-sidebar>`;
    this._main = dom`<split-view-main></split-view-main>`;
    const resizer = new ResizerNob(sidebarPosition, () => {
      this._sidebar.classList.add('is-being-resized');
      this._main.classList.add('is-being-resized');
    }, () => {
      this._sidebar.classList.remove('is-being-resized');
      this._main.classList.remove('is-being-resized');
    });
    const layout = sidebarPosition === 'left' || sidebarPosition === 'right' ? 'horizontal' : 'vertical';
    if (sidebarPosition === 'left' || sidebarPosition === 'top') {
      this.element = dom`
        <split-view class=${layout}>
          ${this._sidebar}
          ${resizer.element}
          ${this._main}
        </split-view>
      `;
    } else {
      this.element = dom`
        <split-view class=${layout}>
          ${this._main}
          ${resizer.element}
          ${this._sidebar}
        </split-view>
      `;
    }
    resizer.wire(this.element);
  }

  setSidebarSize(size: number) {
    this.element.style.setProperty('--sidebar-size', size + 'px');
  }

  toggleSidebar(visible?: boolean) {
    if (visible === undefined) {
      this.element.classList.toggle('sidebar-hidden');
      return;
    }
    this.element.classList.toggle('sidebar-hidden', !visible);
  }

  setSidebarElement(element: HTMLElement | null) {
    if (this._sidebar.children.length)
      this._sidebar.textContent = '';
    if (element)
      this._sidebar.appendChild(element);
    this.element.classList.toggle('sidebar-hidden', !element);
  }

  setMainElement(element: HTMLElement) {
    if (this._main.children.length)
      this._main.textContent = '';
    this._main.appendChild(element);
  }
}

export class ResizerNob {
  readonly element: Element$;
  private _eventListeners: (() => void)[] = [];
  private _startX: number = 0;
  private _startY: number = 0;
  private _initialSize: number = 0;
  private _type: ('left'|'right'|'top'|'bottom') = 'left';
  private _splitViewElement: (HTMLElement|null) = null;
  private _onstart: () => void;
  private _onend: () => void;

  constructor(type: ('left'|'right'|'top'|'bottom') = 'left', onstart: () => void, onend: () => void) {
    this._type = type;
    this._onstart = onstart;
    this._onend = onend;
    const layout = type === 'left' || type === 'right' ? 'vertical' : 'horizontal';
    this.element = dom`<resizer-nob class="${layout} ${type}"></resizer-nob>`;
  }

  wire(splitViewElement: HTMLElement) {
    this._splitViewElement = splitViewElement;
    onDOMEvent(this.element, 'mousedown', this._onMouseDown.bind(this));
  }

  _onMouseDown(e: MouseEvent) {
    this._startX = e.screenX;
    this._startY = e.screenY;
    this._initialSize = parseFloat(getComputedStyle(this.element).getPropertyValue('--sidebar-size'));
    if (isNaN(this._initialSize)) {
      console.error('ERROR: the "--sidebar-size" css property must be set on resizable element');
      return;
    }
    Disposable.disposeAll(this._eventListeners);
    this._eventListeners = [
      onDOMEvent(document, 'mousemove', this._onMouseMove.bind(this), true /* capture */),
      onDOMEvent(document, 'mouseup', this._commitResize.bind(this), true /* capture */),
    ];
    e.preventDefault();
    e.stopPropagation();
    this._onstart.call(null);
  }

  _onMouseMove(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    let delta = 0;
    if (this._type === 'left')
      delta = e.screenX - this._startX;
    else if (this._type === 'right')
      delta = this._startX - e.screenX;
    else if (this._type === 'top')
      delta = e.screenY - this._startY;
    else
      delta = this._startY - e.screenY;
    const size = this._initialSize + delta;
    this._splitViewElement!.style.setProperty('--sidebar-size', size + 'px');
  }

  _commitResize(e: MouseEvent) {
    Disposable.disposeAll(this._eventListeners);
    e.preventDefault();
    e.stopPropagation();
    this._onend.call(null);
  }
}
