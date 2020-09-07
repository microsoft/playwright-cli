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

import { buildSelector } from "./selectorGenerator";

export type ParsedSelector = {
  parts: {
    name: string,
    body: string,
  }[],
  capture?: number,
};

export interface InjectedScript {
  parseSelector(selector: string): ParsedSelector;
  engines: Set<string>;
  querySelectorAll(selector: ParsedSelector, document: Document): Element[];
};

export class ConsoleAPI {
  private _injectedScript: InjectedScript;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    (window as any).playwright = {
      $: (selector: string) => this.querySelector(selector),
      $$: (selector: string) => this.querySelectorAll(selector),
      inspect: (selector: string) => this.inspect(selector),
      selector: (element: Element) => this.buildSelector(element).selector,
    };
  }

  private _checkSelector(parsed: ParsedSelector) {
    for (const {name} of parsed.parts) {
      if (!this._injectedScript.engines.has(name))
        throw new Error(`Unknown engine "${name}"`);
    }
  }

  querySelector(selector: string): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    this._checkSelector(parsed);
    const elements = this._injectedScript.querySelectorAll(parsed, document);
    return elements[0];
  }

  querySelectorAll(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = this._injectedScript.parseSelector(selector);
    this._checkSelector(parsed);
    return this._injectedScript.querySelectorAll(parsed, document);
  }

  inspect(selector: string) {
    if (typeof (window as any).inspect !== 'function')
      return;
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    (window as any).inspect(this.querySelector(selector));
  }

  buildSelector(element: Element): { selector: string, elements: Element[] } {
    return buildSelector(this._injectedScript, element);
  }
}
