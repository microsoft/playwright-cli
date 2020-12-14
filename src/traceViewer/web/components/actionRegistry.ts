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

import { EventEmitter } from './events';
import { MultiMap } from './multimap';

export interface ActionOptions {
  label?: string,
  title?: string,
  icon?: Element,
  iconName?: string,
  toggledIcon?: Element,
  handle: (action: Action, e?: Event, target?: any) => void
}

export class Action {
  private _enabled = true;
  private _toggled = false;
  private _options: ActionOptions;

  private _onUpdatedEmitter = new EventEmitter<Action>();
  readonly onUpdated = this._onUpdatedEmitter.event;

  constructor(options: ActionOptions) {
    this._options = { ...options };
  }

  get label(): string {
    return this._options.label || '';
  }

  get title(): string {
    return this._options.title || '';
  }

  get icon(): Element | undefined {
    return this._options.icon ? this._options.icon.cloneNode(true) as Element : undefined;
  }

  setIcon(icon: Element) {
    this._options.icon = icon;
    this._onUpdatedEmitter.fire(this);
  }

  get toggledIcon(): Element | undefined {
    return this._options.toggledIcon ? this._options.toggledIcon.cloneNode(true) as Element : undefined;
  }

  get iconClass(): string | undefined {
    return this._options.iconName ? 'codicon codicon-' + this._options.iconName : '';
  }

  handle(event?: Event, target?: any): void {
    if (this._enabled)
      this._options.handle(this, event, target);
  }

  toggled(): boolean {
    return this._toggled;
  }

  setToggled(toggled: boolean) {
    this._toggled = toggled;
    this._onUpdatedEmitter.fire(this);
  }

  enabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
    this._onUpdatedEmitter.fire(this);
  }
}

class ActionRegistry {
  private _actions = new MultiMap<string, Action>();

  createAction(options: ActionOptions): Action {
    return new Action(options);
  }

  registerAction(targetTag: string, options: ActionOptions): Action {
    const action = this.createAction(options);
    this._actions.set(targetTag, action);
    return action;
  }

  actionsForTags(actionTags: string[]): Set<Action> {
    const result = new Set<Action>();
    for (const tag of actionTags) {
      const actions = this._actions.get(tag);
      for (const a of actions)
        result.add(a);
    }
    return result;
  }
}

export const actionRegistry = new ActionRegistry();
