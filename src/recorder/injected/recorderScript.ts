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

declare global {
  interface Window {
    performPlaywrightAction: (action: actions.Action) => Promise<void>;
    recordPlaywrightAction: (action: actions.Action) => Promise<void>;
    queryPlaywrightSelector: (selector: string) => Promise<Element | null>;
    playwrightRecorderScript: RecorderScript;
  }
}

export default class RecorderScript {
  private _performingAction = false;
  readonly refreshListeners: () => void;

  constructor() {
    window.playwrightRecorderScript = this;

    const onClick = this._onClick.bind(this);
    const onInput = this._onInput.bind(this);
    const onKeyDown = this._onKeyDown.bind(this);
    this.refreshListeners = () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('input', onInput, true);
      document.addEventListener('keydown', onKeyDown, true);
    };
    this.refreshListeners();
    // Document listeners are cleared upon document.open,
    // so we refresh them periodically in a best-effort manner.
    // Note: keep in sync with the same constant in the test.
    setInterval(this.refreshListeners, 1000);
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
      selector: await this._buildSelector(event.target as Element),
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  private async _onInput(event: Event) {
    if ((event.target as Element).nodeName === 'INPUT') {
      const inputElement = event.target as HTMLInputElement;
      if ((inputElement.type || '').toLowerCase() === 'checkbox') {
        if (!this._consumeForAction(event))
          return;
        this._performAction({
          name: inputElement.checked ? 'check' : 'uncheck',
          selector: await this._buildSelector(event.target as Element),
          signals: [],
        });
        return;
      }

      //  Non-navigating actions are simply recorded by Playwright.
      window.recordPlaywrightAction({
        name: 'fill',
        selector: await this._buildSelector(event.target as Element),
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
        selector: await this._buildSelector(event.target as Element),
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
      selector: await this._buildSelector(event.target as Element),
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

  private async _buildSelector(targetElement: Element): Promise<string> {
    const path: string[] = [];
    for (let element: Element | null = targetElement; element && element !== document.documentElement; element = element.parentElement) {
      const selector = this._buildSelectorCandidate(element);
      if (selector)
        path.unshift(selector.selector);

      const fullSelector = path.join(' ');
      if (selector && selector.final)
        return fullSelector;
      if (targetElement === await window.queryPlaywrightSelector(fullSelector))
        return fullSelector;
    }
    return '<selector>';
  }

  private _buildSelectorCandidate(element: Element): { final: boolean, selector: string } | null {
    for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
      if (element.hasAttribute(attribute))
        return { final: true, selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${element.getAttribute(attribute)}]` };
    }
    for (const attribute of ['aria-label']) {
      if (element.hasAttribute(attribute))
        return { final: false, selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${element.getAttribute(attribute)}]` };
    }
    if (element.nodeName === 'INPUT') {
      if (element.hasAttribute('name'))
        return { final: false, selector: `input[name=${element.getAttribute('name')}]` };
      if (element.hasAttribute('type'))
        return { final: false, selector: `input[type=${element.getAttribute('type')}]` };
    } else if (element.nodeName === 'IMG') {
      if (element.hasAttribute('alt'))
        return { final: false, selector: `img[alt="${element.getAttribute('alt')}"]` };
    }
    const textSelector = textSelectorForElement(element);
    if (textSelector)
      return { final: false, selector: textSelector };

    // Depreoritize id, but still use it as a last resort.
    if (element.hasAttribute('id'))
      return { final: true, selector: `${element.nodeName.toLocaleLowerCase()}[id=${element.getAttribute('id')}]` };

    return null;
  }
}

function textSelectorForElement(node: Node): string | null {
  let needsTrim = false;
  let onlyText: string | null = null;
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE)
      continue;
    if (child.textContent && child.textContent.trim()) {
      if (onlyText)
        return null;
      onlyText = child.textContent.trim();
      needsTrim = child.textContent !== child.textContent.trim();
    } else {
      needsTrim = true;
    }
  }
  if (!onlyText)
    return null;
  return needsTrim ? `text=/\\s*${escapeForRegex(onlyText)}\\s*/` : `text="${onlyText}"`;
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
