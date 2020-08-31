/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as actions from '../recorderActions';
import { html } from './html';
import { RegisteredListener, addEventListener, removeEventListeners } from './util';
import { Throttler } from './throttler';
import { XPathEngine } from './xpathSelectorEngine';
import { buildSelector } from './selectorGenerator';

declare global {
  interface Window {
    performPlaywrightAction: (action: actions.Action) => Promise<void>;
    recordPlaywrightAction: (action: actions.Action) => Promise<void>;
    queryPlaywrightSelector: (selector: string) => Promise<Element[]>;
    playwrightRecorderScript: RecorderScript;
  }
}

export default class RecorderScript {
  private _performingAction = false;
  private _glassPaneElement: HTMLElement;
  private _highlightElements: HTMLElement[] = [];
  private _tooltipElement: HTMLElement;
  private _listeners: RegisteredListener[] = [];
  private _hoveredSelector: string | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _throttler = new Throttler(50);

  constructor() {
    window.playwrightRecorderScript = this;

    this._tooltipElement = html`
      <div style="
        position: absolute;
        top: 0;
        height: 24px;
        left: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        padding: 0 10px;
        color: yellow;
        font-size: 12px;
        font-family:'SF Mono', Monaco, Menlo, Inconsolata, 'Courier New', monospace;
        "></div>`;
    this._glassPaneElement = html`
      <div style="
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 10000;
        pointer-events: none;">
        ${this._tooltipElement}
      </div>`;
    this._refreshListeners();
  }

  private _refreshListeners() {
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(document, 'input', event => this._onInput(event), true),
      addEventListener(document, 'keydown', event => this._onKeyDown(event as KeyboardEvent), true),
      addEventListener(document, 'mousemove', event => this._onMouseMove(event as MouseEvent), true),
      addEventListener(document, 'scroll', event => this._updateHighlight(this._hoveredSelector), true),
    ];
    if (document.documentElement)
      document.documentElement.appendChild(this._glassPaneElement);
    else
      setTimeout(() => this._refreshListeners(), 1000);

    // Document listeners are cleared upon document.open,
    // so we refresh them periodically in a best-effort manner.
    // Note: keep in sync with the same constant in the test.
    // setInterval(this.refreshListeners, 1000);
  }

  private _consumeForAction(event: Event): boolean {
    // If Playwright is performing action for us, bail.
    if (this._performingAction)
      return false;
    // Consume as the first thing.
    consumeEvent(event);
    return true;
  }

  private async _onClick(event: MouseEvent) {
    if ((event.target as Element).nodeName === 'SELECT')
      return;
    if ((event.target as Element).nodeName === 'INPUT') {
      // Check/uncheck are handled in input.
      if (((event.target as HTMLInputElement).type || '').toLowerCase() === 'checkbox')
        return;
    }

    if (!this._consumeForAction(event))
      return;
    this._performAction({
      name: 'click',
      selector: this._hoveredSelector!,
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  private async _onMouseMove(event: MouseEvent) {
    if (this._hoveredElement === event.target)
      return;
    this._hoveredElement = event.target as HTMLElement | null;
    this._throttler.schedule(() => this._updateSelectorForHoveredElement());
  }

  private async _updateSelectorForHoveredElement() {
    if (!this._hoveredElement) {
      this._updateHighlight(null);
      return;
    }
    const selector = await buildSelector(this._hoveredElement);
    if (this._hoveredSelector === selector)
      return;
    this._updateHighlight(selector);
  }

  private async _updateHighlight(selector: string | null) {
    this._hoveredSelector = selector;
    const elements = this._hoveredSelector ? await window.queryPlaywrightSelector(this._hoveredSelector) : [];
    this._tooltipElement.textContent = this._hoveredSelector;

    const pool = this._highlightElements;
    this._highlightElements = [];
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const highlightElement = pool.length ? pool.shift()! : this._createHighlightElement();
      highlightElement.style.left = rect.x + 'px';
      highlightElement.style.top = rect.y + 'px';
      highlightElement.style.width = rect.width + 'px';
      highlightElement.style.height = rect.height + 'px';
      highlightElement.style.display = 'block';
      this._highlightElements.push(highlightElement);
    }

    for (const highlightElement of pool) {
      highlightElement.style.display = 'none';
      this._highlightElements.push(highlightElement);
    }
  }

  private _createHighlightElement(): HTMLElement {
    const highlightElement = html`
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        border: 1px solid red;
        background-color: rgba(0, 0, 255, 0.2);
        display: none;">
      </div>`;
    this._glassPaneElement.appendChild(highlightElement);
    return highlightElement;
  }

  private async _onInput(event: Event) {
    if ((event.target as Element).nodeName === 'INPUT') {
      const inputElement = event.target as HTMLInputElement;
      if ((inputElement.type || '').toLowerCase() === 'checkbox') {
        if (!this._consumeForAction(event))
          return;
        this._performAction({
          name: inputElement.checked ? 'check' : 'uncheck',
          selector: this._hoveredSelector!,
          signals: [],
        });
        return;
      }

      //  Non-navigating actions are simply recorded by Playwright.
      window.recordPlaywrightAction({
        name: 'fill',
        selector: this._hoveredSelector!,
        signals: [],
        text: (event.target! as HTMLInputElement).value,
      });
    }

    if ((event.target as Element).nodeName === 'SELECT') {
      const selectElement = event.target as HTMLSelectElement;
      if (!this._consumeForAction(event))
        return;
      this._performAction({
        name: 'select',
        selector: this._hoveredSelector!,
        options: [...selectElement.selectedOptions].map(option => option.value),
        signals: []
      });
    }
  }

  private async _onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab' && event.key !== 'Enter' && event.key !== 'Escape')
      return;
    if (!this._consumeForAction(event))
      return;
    this._performAction({
      name: 'press',
      selector: this._hoveredSelector!,
      signals: [],
      key: event.key,
      modifiers: modifiersForEvent(event),
    });
  }

  private async _performAction(action: actions.Action) {
    this._performingAction = true;
    await window.performPlaywrightAction(action);
    this._performingAction = false;
  }
}

function modifiersForEvent(event: MouseEvent | KeyboardEvent): number {
  return (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0);
}

function buttonForEvent(event: MouseEvent): 'left' | 'middle' | 'right' {
  switch (event.which) {
    case 1: return 'left';
    case 2: return 'middle';
    case 3: return 'right';
  }
  return 'left';
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
