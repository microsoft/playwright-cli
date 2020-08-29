/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type RegisteredListener = {
  target: EventTarget;
  eventName: string;
  listener: EventListener;
  useCapture?: boolean;
};

export function addEventListener(target: EventTarget, eventName: string, listener: EventListener, useCapture?: boolean): RegisteredListener {
  target.addEventListener(eventName, listener, useCapture);
  return { target, eventName, listener, useCapture };
}

export function removeEventListeners(listeners: RegisteredListener[]) {
  for (const listener of listeners)
    listener.target.removeEventListener(listener.eventName, listener.listener, listener.useCapture);
  listeners.splice(0, listeners.length);
}
