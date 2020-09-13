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
  const loadedStyles = new Map<string, string>();

  const componentStyles = [];
  for (const factory of components) {
    customElements.define(factory.tagName, factory);
    componentStyles.push(...factory.styles);
  }

  // TODO: figure out shadow styles injection.
  const styles = [...componentStyles];
  await Promise.all(styles.map(async name => {
    const response = await fetch(name);
    loadedStyles.set(name, `${await response.text()}\n/*# sourceURL=${name}*/`);
  }));

  for (const factory of components) {
    factory.stylesFragment = () => {
      const fragment = new DocumentFragment();
      for (const name of factory.styles) {
        const style = document.createElement('style');
        style.textContent = loadedStyles.get(name) || '';
        fragment.appendChild(style);
      }
      return fragment;
    };
  }
}
