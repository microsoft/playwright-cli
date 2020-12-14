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
import { dom, onDOMEvent } from './dom';

export class DropTarget {
  readonly element: Element;
  private _messageText: string;
  private _handleDrop: (transfer: DataTransfer) => any;
  private _dragMaskElement?: HTMLElement;
  private _disposables: (() => void)[] = [];

  constructor(element: Element, messageText: string, handleDrop: (data: DataTransfer) => void) {
    this.element = element;
    this._messageText = messageText;
    this._handleDrop = handleDrop;
    this._disposables = [
      onDOMEvent(this.element, 'dragenter', (event: DragEvent) => this._onDragEnter(event), true),
      onDOMEvent(this.element, 'dragover', (event: DragEvent) => this._onDragOver(event), true),
      onDOMEvent(this.element, 'keydown', (event: KeyboardEvent) => this._onKeyDown(event), true)
    ];
  }

  dispose() {
    Disposable.disposeAll(this._disposables);
  }

  private _onDragEnter(event: DragEvent) {
    if (this._hasMatchingType(event)) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  private _hasMatchingType(event: DragEvent): boolean {
    return !!Array.from(event.dataTransfer!.items).find(item => item.kind === 'file');
  }

  private _onDragOver(event: DragEvent) {
    if (!this._hasMatchingType(event))
      return;
    event.dataTransfer!.dropEffect = 'copy';
    event.stopPropagation();
    event.preventDefault();
    if (!this._dragMaskElement) {
      this._dragMaskElement = dom`
        <drop-target>${this._messageText}</drop-target>
      `;
      this._dragMaskElement.addEventListener('drop', (event: DragEvent) => this._onDrop(event), true);
      this._dragMaskElement.addEventListener('dragleave', (event: DragEvent) => this._onDragLeave(event), true);
    }
    this.element.appendChild(this._dragMaskElement);
  }

  private _onDrop(event: DragEvent) {
    this._onDragLeave(event);
    this._handleDrop(event.dataTransfer!);
  }

  private _onDragLeave(event: DragEvent) {
    this._hide(event as Event);
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape')
      this._hide(event as Event);
  }

  private _hide(event: Event) {
    if (!this._dragMaskElement || !this._dragMaskElement.parentElement)
      return;
    event.stopPropagation();
    event.preventDefault();
    this._dragMaskElement.remove();
  }
}
