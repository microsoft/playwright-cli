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

import { XPathEngine } from './xpathSelectorEngine';

export async function buildSelector(targetElement: Element): Promise<string> {
  const path: SelectorToken[] = [];
  let numberOfMatchingElements = Number.MAX_SAFE_INTEGER;
  for (let element: Element | null = targetElement; element && element !== document.documentElement; element = element.parentElement) {
    const selector = buildSelectorCandidate(element);
    if (!selector)
      continue;
    const fullSelector = joinSelector([selector, ...path]);
    const selectorTargets = await window.queryPlaywrightSelector(fullSelector);
    if (!selectorTargets.length)
      break;
    if (selectorTargets[0].contains(targetElement))
      return fullSelector;
    if (selectorTargets.length && numberOfMatchingElements > selectorTargets.length) {
      numberOfMatchingElements = selectorTargets.length;
      path.unshift(selector);
    }
  }
  return XPathEngine.create(document.documentElement, targetElement, 'default')!;
}

function buildSelectorCandidate(element: Element): SelectorToken | null {
  const nodeName = element.nodeName.toLowerCase();
  for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
    if (element.hasAttribute(attribute))
      return { engine: 'css', selector: `${nodeName}[${attribute}=${quoteString(element.getAttribute(attribute)!)}]` };
  }
  for (const attribute of ['aria-label', 'role']) {
    if (element.hasAttribute(attribute))
      return { engine: 'css', selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${quoteString(element.getAttribute(attribute)!)}]` };
  }
  if (element.nodeName === 'INPUT') {
    if (element.getAttribute('name'))
      return { engine: 'css', selector: `input[name=${quoteString(element.getAttribute('name')!)}]` };
    if (element.getAttribute('type'))
      return { engine: 'css', selector: `input[type=${quoteString(element.getAttribute('type')!)}]` };
    if (element.getAttribute('placeholder'))
       return { engine: 'css', selector: `input[placeholder=${quoteString(element.getAttribute('placeholder')!)}]` };
  } else if (element.nodeName === 'IMG') {
    if (element.getAttribute('alt'))
      return { engine: 'css', selector: `img[alt=${quoteString(element.getAttribute('alt')!)}]` };
  }
  const textSelector = textSelectorForElement(element);
  if (textSelector)
    return { engine: 'text', selector: textSelector };

  // De-prioritize id, but still use it as a last resort.
  const idAttr = element.getAttribute('id');
  if (idAttr && !isGuidLike(idAttr))
    return { engine: 'css', selector: `${nodeName}[id=${quoteString(idAttr!)}]` };

  return null;
}

function textSelectorForElement(node: Node): string | null {
  const maxLength = 30;
  let needsRegex = false;
  let trimmedText: string | null = null;
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE)
      continue;
    if (child.textContent && child.textContent.trim()) {
      if (trimmedText)
        return null;
      trimmedText = child.textContent.trim().substr(0, maxLength);
      needsRegex = child.textContent !== trimmedText;
    } else {
      needsRegex = true;
    }
  }
  if (!trimmedText)
    return null;
  return needsRegex ? `/.*${escapeForRegex(trimmedText)}.*/` : `"${trimmedText}"`;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quoteString(text: string): string {
  return `"${text.replaceAll(/"/g, '\\"')}"`;
}

type SelectorToken = {
  engine: string;
  selector: string;
};

function joinSelector(path: SelectorToken[]): string {
  const tokens = [];
  let lastEngine = '';
  for (const { engine, selector } of path) {
    if (tokens.length  && (lastEngine !== 'css' || engine !== 'css'))
      tokens.push('>>');
    lastEngine = engine;
    if (engine === 'css')
      tokens.push(selector);
    else
      tokens.push(`${engine}=${selector}`);
  }
  return tokens.join(' ');
}

function isGuidLike(id: string): boolean {
  let lastCharacterType: 'lower' | 'upper' | 'digit' | 'other' | undefined;
  let transitionCount = 0;
  for (let i = 0; i < id.length; ++i) {
    const c = id[i];
    let characterType: 'lower' | 'upper' | 'digit' | 'other';
    if (c === '-' || c === '_')
      continue;
    if (c >= 'a' && c <= 'z')
      characterType = 'lower';
    else  if (c >= 'A' && c <= 'Z')
      characterType = 'upper';
    else if (c >= '0' && c <= '9')
      characterType = 'digit';
    else
      characterType = 'other';

    if (characterType === 'lower' && lastCharacterType === 'upper') {
      lastCharacterType = characterType;
      continue;
    }

    if (lastCharacterType && lastCharacterType !== characterType)
      ++transitionCount;
    lastCharacterType = characterType;
  }
  return transitionCount >= id.length / 4;
}
