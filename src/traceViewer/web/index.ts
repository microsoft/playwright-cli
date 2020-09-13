/**
 * Copyright (c) Microsoft Corporation.
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

import { ContextCreatedTraceEvent } from '../traceTypes';
import type { Trace } from '../traceViewer';
import * as components from './components/components';
import { dom } from './components/dom';
import { ActionListView } from './ui/actionListView';
import { PropertiesTabbedPane } from './ui/propertiesTabbedPane';

function renderTrace(trace: Trace) {
  const contextCreated = trace.events.find(e => e.type === 'context-created')! as ContextCreatedTraceEvent;
  const size = contextCreated.viewportSize!;
  const tabbedPane = new PropertiesTabbedPane(size);

  const actionListView = new ActionListView(trace.events, tabbedPane);
  document.body.appendChild(dom`
    <hbox>
      ${actionListView.element}
      ${tabbedPane.element}
    </hbox>
  `);
}

function platformName(): string {
  if (window.navigator.userAgent.includes('Linux'))
    return 'platform-linux';
  if (window.navigator.userAgent.includes('Windows'))
    return 'platform-windows';
  if (window.navigator.userAgent.includes('Mac'))
    return 'platform-mac';
  return 'platform-generic';
}

(async () => {
  document!.defaultView!.addEventListener('focus', (event: any) => {
    if (event.target.document.nodeType === Node.DOCUMENT_NODE)
      document.body.classList.remove('inactive');
  }, false);
  document!.defaultView!.addEventListener('blur', event => {
    document.body.classList.add('inactive');
  }, false);
  document.body.classList.add(platformName());
  await components.initialize();
  for (const trace of await (window as any).getTraces())
    renderTrace(trace);
})();
