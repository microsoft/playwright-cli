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

import { PwCheckboxElement } from './pwCheckbox';
import { PwComboElement } from './pwCombo';
import { PwExpandableElement } from './pwExpandable';
import { PwSmallButtonElement } from './pwSmallButton';

const components = [ PwCheckboxElement, PwComboElement, PwExpandableElement, PwSmallButtonElement ];

export async function initialize() {
  for (const factory of components)
    customElements.define(factory.tagName, factory);

  for (const factory of components) {
    factory.stylesFragment = () => {
      const fragment = new DocumentFragment();
      for (const styleText of factory.styles) {
        const style = document.createElement('style');
        style.textContent = styleText.toString();
        fragment.appendChild(style);
      }
      return fragment;
    };
  }
}
