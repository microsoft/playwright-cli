1/**
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

import { TraceModel } from '../traceModel';
import './common.css';
import './components/dialog.css';
import './components/dropTarget.css';
import './components/listView.css';
import './components/splitView.css';
import './components/tabbedPane.css';
import './components/toolbarView.css';
import './third_party/vscode/codicon.css';
import { Workbench } from './ui/workbench';
import * as components from './components/components';

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
  document.documentElement.classList.add(platformName());
  const traceModel = await (window as any).getTraceModel() as TraceModel;
  await components.initialize();
  const workbench = new Workbench(traceModel);
  document.body.appendChild(workbench.element);
  workbench.pack();
  // TODO: Things jump because the film strip is loading lazily. Figure this out.
  setTimeout(() => workbench.pack(), 100);
})();
