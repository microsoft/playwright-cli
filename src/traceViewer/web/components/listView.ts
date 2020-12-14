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

import { deepCompare } from './collections';
import { Disposable, EventEmitter } from './events';
import { Point } from './geometry';
import { dom, Element$, onDOMEvent } from './dom';

interface Renderer<T> {
  render(t: T, element: Element | undefined): HTMLElement;
}

type ListOptions = {
  orientation?: 'vertical' | 'horizontal',
  multiselect?: boolean,
  omitSelection?: boolean,
  stickToBottom?: boolean,
  mutable?: boolean
};

export type ListCommand = 'delete' | 'copy' | 'cut' | 'paste';

export class ListView<T> {
  readonly element: Element$;
  private _renderer: Renderer<T>;
  private _entries: T[] = [];
  private _elements = new Map<T, HTMLElement>();
  private _selectedEntries: T[] = [];
  private _selectionAnchor?: T;
  private _options: ListOptions;
  private _draggingSlot?: HTMLElement;
  private _dropTarget: Element$;
  private _disposables: Disposable[] = [];

  private _onSelectionChangedEmitter = new EventEmitter<T[]>();
  private _onMovedEmitter = new EventEmitter<{ entry: T, insertBefore: T | undefined }>();
  private _onHoveredEmitter = new EventEmitter<T>();
  private _onCommandEmitter = new EventEmitter<{ entries: T[], command: ListCommand }>();

  readonly onSelectionChanged = this._onSelectionChangedEmitter.event;
  readonly onMoved = this._onMovedEmitter.event;
  readonly onHovered = this._onHoveredEmitter.event;
  readonly onCommand = this._onCommandEmitter.event;

  constructor(renderer: Renderer<T>, options?: ListOptions) {
    this._options = { ...options };
    this._renderer = renderer;
    this.element = dom`<list-view class="${this._options.orientation === 'horizontal' ? 'horizontal' : 'vertical'}"></list-view>`;
    if (!this._options.omitSelection)
      this.element.tabIndex = 0;
    this._dropTarget = dom`<list-view-drop></list-view-drop>`;

    this.element.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') {
        this._setSingleSelection(this._entries[this._entries.length - 1]);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this._setSingleSelection(this._entries[0]);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this._cancelDrag();
        e.stopPropagation();
        e.preventDefault();
      } else if (this._options.mutable && (e.key === 'Delete' || e.key === 'Backspace')) {
        this._onCommandEmitter.fire({ entries: this.selection(), command: 'delete' });
        e.stopPropagation();
        e.preventDefault();
      }
    });

    if (this._options.mutable) {
      const commands: ('cut' | 'copy' | 'paste')[] = ['cut', 'copy', 'paste'];
      for (const command of commands) {
        this._disposables.push(onDOMEvent(document, command, e => {
          if (!this._selectedEntries.length || !this.element.contains(document.activeElement))
            return;
          this._onCommandEmitter.fire({ entries: this.selection(), command });
        }));
      }
    }

  }

  dispose() {
    Disposable.disposeAll(this._disposables);
  }

  clear() {
    this.element.textContent = '';
    this._entries = [];
    this._selectedEntries = [];
    this._elements.clear();
  }

  entries(): T[] {
    return this._entries.slice();
  }

  length(): number {
    return this._entries.length;
  }

  append(t: T) {
    const stickToBottom = this._options.stickToBottom && isScrolledToBottom(this.element);
    this.insertBefore(t, undefined);
    if (stickToBottom)
      scrollToBottom(this.element);
  }

  appendAll(tt: T[]) {
    const stickToBottom = this._options.stickToBottom && isScrolledToBottom(this.element);
    for (const t of tt)
      this.insertBefore(t, undefined);
    if (stickToBottom)
      scrollToBottom(this.element);
  }

  insertBefore(t: T, before: T | undefined) {
    const insertionIndex = before ? this._entries.indexOf(before) : -1;
    if (insertionIndex >= 0)
      this._entries.splice(insertionIndex, 0, t);
    else
      this._entries.push(t);
    const stickToBottom = this._options.stickToBottom && isScrolledToBottom(this.element);
    const slotElement = dom`<list-item>${this._renderer.render(t, undefined)}</list-item>`;
    if (!this._options.omitSelection)
      slotElement.tabIndex = 0;
    slotElement.addEventListener('keydown', e => {
      if (e.target) {
        const target = e.target as HTMLElement;
        if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA')
          return;
      }
      if (e.key === 'ArrowUp') {
        const index = this._entries.indexOf(t);
        const prev = this._entries[Math.max(0, index - 1)];
        if (this._options.multiselect && e.shiftKey) {
          if (prev)
            this._spanSelectionTo(prev);
        } else {
          this._setSingleSelection(prev);
        }
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        const index = this._entries.indexOf(t);
        const next = this._entries[Math.min(this._entries.length - 1, index + 1)];
        if (this._options.multiselect && e.shiftKey) {
          if (next)
            this._spanSelectionTo(next);
        } else {
          this._setSingleSelection(next);
        }
        e.stopPropagation();
        e.preventDefault();
      }
    });

    slotElement.addEventListener('mouseover', e => {
      this._onHoveredEmitter.fire(t);
    });

    if (this._options.mutable)
      this._installDragHandle(t, slotElement);

    slotElement.addEventListener('mousedown', e => {
      if (this._options.omitSelection)
        return;
      if (this._options.multiselect && (e.ctrlKey || e.metaKey))
        this._addToSelection(t);
      else if (this._options.multiselect && (e.shiftKey))
        this._spanSelectionTo(t);
      else
        this._setSingleSelection(t);
    });

    const anchorElement = before ? this._elements.get(before) : undefined;
    this._elements.set(t, slotElement);
    if (anchorElement) {
      this.element.insertBefore(slotElement, anchorElement);
    } else {
      this.element.appendChild(slotElement);
      if (stickToBottom)
        scrollToBottom(this.element);
    }
    return slotElement;
  }

  selection(): T[] {
    return this._selectedEntries.slice();
  }

  setSelection(t: T | T[] | undefined): void {
    const entries = t instanceof Array ? t : (t ? [t] : []);
    this._setMultipleSelection(entries, entries[0]);
  }

  _setSingleSelection(entry: T) {
    this._setMultipleSelection([entry], entry);
  }

  _setMultipleSelection(entries: T[], focusedEntry: T) {
    const oldSelection = this.selection();
    if (deepCompare(entries, oldSelection, 1))
      return;

    for (const entry of oldSelection) {
      const oldElement = this._elements.get(entry)!;
      if (oldElement)
        oldElement.classList.remove('selected');
    }

    for (const entry of entries) {
      const newElement = this._elements.get(entry)!;
      newElement.classList.add('selected');
    }

    if (entries.length === 1) {
      this._selectionAnchor = entries[0];
      focusedEntry = entries[0];
    }

    if (focusedEntry) {
      const element = this._elements.get(focusedEntry)!;
      element.focus();
    }

    this._selectedEntries = entries.slice();
    this._onSelectionChangedEmitter.fire(entries.slice());
  }

  private _addToSelection(t: T) {
    const set = new Set(this._selectedEntries);
    const selection: T[] = [];
    for (const entry of this._entries) {
      if (entry === t || set.has(entry))
        selection.push(entry);
    }
    this._setMultipleSelection(selection, t);
  }

  private _spanSelectionTo(t: T) {
    if (!this._selectedEntries.length || !this._selectionAnchor) {
      this._setSingleSelection(t);
      return;
    }
    const selection: T[] = [];
    const index = this._entries.indexOf(this._selectionAnchor);
    const toIndex = this._entries.indexOf(t);
    for (let i = index; i <= toIndex; ++i)
      selection.push(this._entries[i]);
    for (let i = toIndex; i <= index; ++i)
      selection.push(this._entries[i]);
    this._setMultipleSelection(selection, t);
  }

  renderedElement(t: T): Element | undefined {
    const slotElement = this._elements.get(t);
    return slotElement ? slotElement.firstElementChild || undefined : undefined;
  }

  update(t: T) {
    const stickToBottom = this._options.stickToBottom && isScrolledToBottom(this.element);
    const oldElement = this.renderedElement(t);
    const newElement = this._renderer.render(t, oldElement);
    if (oldElement !== newElement) {
      const slotElement = this._elements.get(t)!;
      slotElement.textContent = '';
      slotElement.appendChild(newElement);
    }

    if (stickToBottom)
      scrollToBottom(this.element);
  }

  reveal(t: T) {
    const element = this._elements.get(t);
    if (!element)
      return;
    if ((element as any).scrollIntoViewIfNeeded)
      (element as any).scrollIntoViewIfNeeded();
    else
      element.scrollIntoView();
  }

  delete(t: T) {
    this.deleteAll([t]);
  }

  deleteAll(tt: T[]) {
    const oldSelection = new Set(this.selection());
    let minIndex = this._entries.length;
    for (const t of tt) {
      const index = this._entries.indexOf(t);
      minIndex = Math.min(minIndex, index);
      this._entries.splice(index, 1);
      oldSelection.delete(t);
    }

    if (oldSelection.size)
      this.setSelection([...oldSelection]);
    else
      this.setSelection(this._entries[Math.min(minIndex, this._entries.length - 1)]);

    for (const t of tt) {
      const element = this._elements.get(t);
      if (!element)
        continue;
      element.remove();
      this._elements.delete(t);
    }
  }

  private _installDragHandle(t: T, slotElement: HTMLElement) {
    const dragHandle = slotElement.querySelector('.drag-handle') as HTMLElement;
    if (!dragHandle)
      return;
    dragHandle.addEventListener('mousedown', e => {
      this._setSingleSelection(t);
      this._cancelDrag();
      e.stopPropagation();
      e.preventDefault();
      const point: Point = { x: e.pageX, y: e.pageY };
      const offsetTop = slotElement.offsetTop - this.element.scrollTop;
      this._dropTarget.style.flexBasis = slotElement.offsetHeight + 'px';

      const disposables = [
        onDOMEvent(document, 'mousemove', e => drag(point, offsetTop, e), true),
        onDOMEvent(document, 'mouseup', e => {
          dragEnd(e);
          Disposable.disposeAll(disposables);
        }, true)
      ];
    });

    const drag = (point: Point, offsetTop: number, e: MouseEvent) => {
      if (Math.abs(point.y - e.pageY) < 5)
        return;
      if (!this._dropTarget.parentElement)
        this.element.insertBefore(this._dropTarget, slotElement);

      slotElement.style.setProperty('position', 'absolute');
      slotElement.style.setProperty('left', '10px');
      slotElement.style.setProperty('right', '-10px');
      slotElement.style.setProperty('top', `${e.pageY - point.y + offsetTop}px`);
      slotElement.style.setProperty('z-index', '2');
      this._draggingSlot = slotElement;

      const box = slotElement.getBoundingClientRect();
      const middle = (box.top + box.bottom) / 2;
      for (const entry of this._entries) {
        const slot = this._elements.get(entry)!;
        if (slot === slotElement)
          continue;
        const b = slot.getBoundingClientRect();
        const m = (b.top + b.bottom) / 2;
        if (middle > b.top && middle < m) {
          this.element.insertBefore(this._dropTarget, slot);
          break;
        } else  if (middle > m && middle < b.bottom) {
          this.element.insertBefore(this._dropTarget, slot.nextSibling);
          break;
        }
      }
      if (this.element.getBoundingClientRect().bottom - box.bottom < 50)
        this.element.scrollTop += 100;
      else if (this.element.scrollTop && box.top - this.element.getBoundingClientRect().top < 50)
        this.element.scrollTop -= 100;
    };

    const dragEnd = (e: MouseEvent) => {
      if (!this._dropTarget.parentElement)
        return;

      const oldIndex = this._entries.indexOf(t);
      const newIndex = Array.from(this.element.children).indexOf(this._dropTarget);
      if (newIndex !== oldIndex)
        this._onMovedEmitter.fire({ entry: t, insertBefore: this._entries[newIndex] });
      this._cancelDrag();
    };
  }

  private _cancelDrag() {
    if (!this._draggingSlot)
      return;
    const slotElement = this._draggingSlot;
    slotElement.style.removeProperty('position');
    slotElement.style.removeProperty('left');
    slotElement.style.removeProperty('right');
    slotElement.style.removeProperty('transform');
    slotElement.style.removeProperty('z-index');
    this._dropTarget.remove();
    this._draggingSlot = undefined;
  }

  updateAll() {
    for (const entry of this._entries)
      this.update(entry);
  }

}

function isScrolledToBottom(element: HTMLElement): boolean {
  // This code works only for 0-width border.
  // The scrollTop, clientHeight and scrollHeight are computed in double values internally.
  // However, they are exposed to javascript differently, each being either rounded (via
  // round, ceil or floor functions) or left intouch.
  // This adds up a total error up to 2.
  return Math.abs(element.scrollTop + element.clientHeight - element.scrollHeight) <= 2;
}

function scrollToBottom(element: HTMLElement) {
  element.scrollTop = 1000000000;
}
