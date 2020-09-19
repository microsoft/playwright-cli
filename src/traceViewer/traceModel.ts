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

import * as trace from "./traceTypes";

export type TraceModel = {
	fileName: string;
	contexts: ContextEntry[];
}

export type ContextEntry = {
  created: trace.ContextCreatedTraceEvent;
  destroyed: trace.ContextDestroyedTraceEvent;
  pages: PageEntry[];
}

export type PageEntry = {
  created: trace.PageCreatedTraceEvent;
  destroyed: trace.PageDestroyedTraceEvent;
  video?: trace.PageVideoTraceEvent;
  actions: ActionEntry[];
}

export type ActionEntry = {
  action: trace.ActionTraceEvent;
  resources: trace.NetworkResourceTraceEvent[];
}
