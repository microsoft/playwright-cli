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
import { buildSelector } from './selectorGenerator';

declare global {
  interface Window {
    performPlaywrightAction: (action: actions.Action) => Promise<void>;
    recordPlaywrightAction: (action: actions.Action) => Promise<void>;
    queryPlaywrightSelector: (selector: string) => Promise<Element[]>;
    playwrightRecorderScript: RecorderScript;
  }
}

const recorderSymbol = Symbol('recorderSymbol');

export default class RecorderScript {
  private _performingAction = false;
  private _glassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _highlightElements: HTMLElement[] = [];
  private _tooltipElement: HTMLElement;
  private _listeners: RegisteredListener[] = [];
  private _hoveredSelector: string | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _throttler = new Throttler(50);

  constructor() {
    window.playwrightRecorderScript = this;

    this._tooltipElement = html`
      <x-pw-tooltip style="
        position: absolute;
        top: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        padding: 4px 10px;
        color: yellow;
        font-size: 12px;
        font-family:'SF Mono', Monaco, Menlo, Inconsolata, 'Courier New', monospace;
        "></x-pw-tooltip>`;
    this._glassPaneElement = html`
      <x-pw-glass style="
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 1000000;
        pointer-events: none;">
      </x-pw-glass>`;
    // Use a closed shadow root to prevent selectors matching our internal previews.
    this._glassPaneShadow = this._glassPaneElement.attachShadow({ mode: 'closed' });
    this._glassPaneShadow.appendChild(this._tooltipElement);
    setInterval(() => {
      this._refreshListenersIfNeeded();
    }, 100);
  }

  private _refreshListenersIfNeeded() {
    if ((document.documentElement as any)[recorderSymbol])
      return;
    (document.documentElement as any)[recorderSymbol] = true;
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(document, 'input', event => this._onInput(event), true),
      addEventListener(document, 'keydown', event => this._onKeyDown(event as KeyboardEvent), true),
      addEventListener(document, 'mousemove', event => this._onMouseMove(event as MouseEvent), true),
      addEventListener(document, 'scroll', event => this._updateHighlight(this._hoveredSelector), true),
    ];
    document.documentElement.appendChild(this._glassPaneElement);
    if ((window as any)._recorderScriptReadyForTest)
      (window as any)._recorderScriptReadyForTest();
  }

  private _consumeForAction(event: Event): boolean {
    // If Playwright is performing action for us, bail.
    if (this._performingAction)
      return false;
    // Consume as the first thing.
    consumeEvent(event);
    return true;
  }

  private _ensureSelectorForEvent(target: HTMLElement | null): string | null {
    // When user does not move mouse after navigation and just clicks,
    // we might not have a hovered element/selector yet.
    //
    // TODO: we could build a selector based on the event target.
    // However, building a selector is an async process so we can get
    // a race against subsequent actions. For now, require user to move the mouse.
    if (!this._hoveredSelector)
      return null;
    return this._hoveredSelector;
  }

  private _onClick(event: MouseEvent) {
    if ((event.target as Element).nodeName === 'SELECT')
      return;
    if ((event.target as Element).nodeName === 'INPUT') {
      // Check/uncheck are handled in input.
      if (((event.target as HTMLInputElement).type || '').toLowerCase() === 'checkbox')
        return;
    }

    if (!this._consumeForAction(event))
      return;

    const selector = this._ensureSelectorForEvent(event.target as HTMLElement | null);
    if (!selector)
      return;

    this._performAction({
      name: 'click',
      selector,
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
    // Mouse moved -> mark last action as committed via committing a commit action.
    this._throttler.schedule(() => this._commitActionAndUpdateSelectorForHoveredElement());
  }

  private async _commitActionAndUpdateSelectorForHoveredElement() {
    if (!this._hoveredElement) {
      this._updateHighlight(null);
      return;
    }
    const hoveredElement = this._hoveredElement;
    const selector = await buildSelector(this._hoveredElement);
    if (this._hoveredSelector === selector || this._hoveredElement !== hoveredElement)
      return;
    this._performAction({
      name: 'commit',
      committed: true,
      signals: [],
    });
    this._updateHighlight(selector);
  }

  private async _updateHighlight(selector: string | null) {
    this._hoveredSelector = selector;
    const elements = this._hoveredSelector ? await window.queryPlaywrightSelector(this._hoveredSelector) : [];
    // Do not thrash the layout.
    const primaryBox  = selector && this._hoveredElement ? this._hoveredElement.getBoundingClientRect() : undefined;
    const boxes = elements.map(e => e.getBoundingClientRect());

    // Now destroy the layout.
    if (primaryBox) {
      this._tooltipElement.style.top = primaryBox.bottom + 'px';
      this._tooltipElement.style.left = primaryBox.left + 'px';
    }

    this._tooltipElement.textContent = this._hoveredSelector;
    const pool = this._highlightElements;
    this._highlightElements = [];
    for (const box of boxes) {
      const highlightElement = pool.length ? pool.shift()! : this._createHighlightElement();
      highlightElement.style.left = box.x + 'px';
      highlightElement.style.top = box.y + 'px';
      highlightElement.style.width = box.width + 'px';
      highlightElement.style.height = box.height + 'px';
      highlightElement.style.display = 'block';
      this._highlightElements.push(highlightElement);
    }

    for (const highlightElement of pool) {
      highlightElement.style.display = 'none';
      this._highlightElements.push(highlightElement);
    }
    if ((window as any)._highlightUpdatedForTest)
      (window as any)._highlightUpdatedForTest(this._hoveredSelector);
  }

  private _createHighlightElement(): HTMLElement {
    const highlightElement = html`
      <x-pw-highlight style="
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        border: 1px solid red;
        background-color: rgba(0, 0, 255, 0.2);
        display: none;">
      </x-pw-highlight>`;
    this._glassPaneShadow.appendChild(highlightElement);
    return highlightElement;
  }

  private async _onInput(event: Event) {
    if ((event.target as Element).nodeName === 'INPUT') {
      const inputElement = event.target as HTMLInputElement;
      if ((inputElement.type || '').toLowerCase() === 'checkbox') {
        if (!this._consumeForAction(event))
          return;
        const selector = this._ensureSelectorForEvent(inputElement);
        if (!selector)
          return;
        this._performAction({
          name: inputElement.checked ? 'check' : 'uncheck',
          selector,
          signals: [],
        });
        return;
      }

      // Non-navigating actions are simply recorded by Playwright.
      const selector = this._ensureSelectorForEvent(inputElement);
      if (!selector)
        return;
      window.recordPlaywrightAction({
        name: 'fill',
        selector,
        signals: [],
        text: inputElement.value,
      });
    }

    if ((event.target as Element).nodeName === 'SELECT') {
      const selectElement = event.target as HTMLSelectElement;
      if (!this._consumeForAction(event))
        return;
      const selector = this._ensureSelectorForEvent(selectElement);
      if (!selector)
        return;
      this._performAction({
        name: 'select',
        selector,
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
    const selector = this._ensureSelectorForEvent(event.target as HTMLElement | null);
    if (!selector)
      return;
    this._performAction({
      name: 'press',
      selector,
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

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
