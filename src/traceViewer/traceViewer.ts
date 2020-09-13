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

import * as fs from 'fs';
import * as path from 'path';
import * as playwright from 'playwright';
import { Route } from 'playwright';
import * as util from 'util';
import type { ActionTraceEvent, ContextCreatedTraceEvent, ContextDestroyedTraceEvent, FrameSnapshot, NetworkResourceTraceEvent, PageCreatedTraceEvent, PageDestroyedTraceEvent, PageSnapshot } from './traceTypes';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

export type TraceEvent =
    ContextCreatedTraceEvent |
    ContextDestroyedTraceEvent |
    PageCreatedTraceEvent |
    PageDestroyedTraceEvent |
    NetworkResourceTraceEvent |
    ActionTraceEvent;

export type Trace = {
  traceFile: string;
  events: TraceEvent[];
};

class TraceViewer {
  private _traceStorageDir: string;
  private _traces: Trace[] = [];
  private _browserNames = new Set<string>();
  private _contextEventById = new Map<string, ContextCreatedTraceEvent>();
  private _snapshotRouter: SnapshotRouter;

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
    this._snapshotRouter = new SnapshotRouter(traceStorageDir);
  }

  async load(traceFile: string) {
    // TODO: validate trace?
    const traceContent = await fsReadFileAsync(traceFile, 'utf8');
    const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line));
    for (const event of events) {
      if (event.type === 'context-created')
        this._browserNames.add(event.browserName);
      if (event.type === 'context-created')
        this._contextEventById.set(event.contextId, event);
    }
    this._traces.push({ traceFile, events });
    this._snapshotRouter.loadEvents(events);
  }

  browserNames(): Set<string> {
    return this._browserNames;
  }

  async show(browserName: string) {
    const browser = await playwright[browserName as ('chromium' | 'firefox' | 'webkit')].launch({ headless: false });
    const uiPage = await browser.newPage({ viewport: null });
    await uiPage.exposeBinding('renderSnapshot', async (_: any, action: ActionTraceEvent) => {
      try {
        const snapshot = await fsReadFileAsync(path.join(this._traceStorageDir, action.snapshot!.sha1), 'utf8');
        const snapshotObject = JSON.parse(snapshot) as PageSnapshot;
        this._snapshotRouter.selectSnapshot(snapshotObject, action.contextId);
        return snapshotObject.frames[0].url;
      } catch(e) {
        console.log(e);
        return 'about:blank';
      }
    });
    await uiPage.exposeBinding('getTraces', () => this._traces);
    await uiPage.route('**/*', (route, request) => {
      if (request.frame().parentFrame()) {
        this._snapshotRouter.route(route);
        return;
      }
      const url = new URL(request.url());
      try {
        const body = fs.readFileSync(path.join(__dirname, '../../out/web', url.pathname.substring(1)));
        route.fulfill({
          contentType: extensionToMime[path.extname(url.pathname).substring(1)] || 'text/plain',
          body
        });
      } catch (e) {
        console.log(e);
        route.fulfill({
          status: 404
        });
      }
    });
    await uiPage.goto('http://trace-viewer/index.html');
  }
}

export async function showTraceViewer(traceStorageDir: string, traceFiles: string[]) {
  const traceViewer = new TraceViewer(traceStorageDir);
  for (const traceFile of traceFiles)
    await traceViewer.load(traceFile);
  for (const browserName of traceViewer.browserNames())
    await traceViewer.show(browserName);
}

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}

const extensionToMime: { [key: string]: string } = {
  'css': 'text/css',
  'html': 'text/html',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'png': 'image/png',
  'ttf': 'font/ttf',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
};

class SnapshotRouter {
  private _contextId: string | undefined;
  private _resourceEventsByUrl = new Map<string, NetworkResourceTraceEvent[]>();
  private _unknownUrls = new Set<string>();
  private _traceStorageDir: string;
  private _frameBySrc = new Map<string, FrameSnapshot>();

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
  }

  loadEvents(events: TraceEvent[]) {
    for (const event of events) {
      if (event.type !== 'resource')
        continue;
      let responseEvents = this._resourceEventsByUrl.get(event.url);
      if (!responseEvents) {
        responseEvents = [];
        this._resourceEventsByUrl.set(event.url, responseEvents);
      }
      responseEvents.push(event);
    }
  }

  selectSnapshot(snapshot: PageSnapshot, contextId: string) {
    this._frameBySrc.clear();
    this._contextId = contextId;
    for (const frameSnapshot of snapshot.frames)
      this._frameBySrc.set(frameSnapshot.url, frameSnapshot);
  }

  async route(route: Route) {
    const url = route.request().url();
    if (this._frameBySrc.has(url)) {
      const frameSnapshot = this._frameBySrc.get(url)!;
      route.fulfill({
        contentType: 'text/html',
        body: Buffer.from(frameSnapshot.html),
      });
      return;
    }

    const frameSrc = route.request().frame().url();
    const frameSnapshot = this._frameBySrc.get(frameSrc);
    if (!frameSnapshot)
      return this._routeUnknown(route);

    // Find a matching resource from the same context, preferrably from the same frame.
    // Note: resources are stored without hash, but page may reference them with hash.
    let resource: NetworkResourceTraceEvent | null = null;
    for (const resourceEvent of this._resourceEventsByUrl.get(removeHash(url)) || []) {
      if (resourceEvent.contextId !== this._contextId)
        continue;
      if (resource && resourceEvent.frameId !== frameSnapshot.frameId)
        continue;
      resource = resourceEvent;
      if (resourceEvent.frameId === frameSnapshot.frameId)
        break;
    }
    if (!resource)
      return this._routeUnknown(route);

    // This particular frame might have a resource content override, for example when
    // stylesheet is modified using CSSOM.
    const resourceOverride = frameSnapshot.resourceOverrides.find(o => o.url === url);
    const overrideSha1 = resourceOverride ? resourceOverride.sha1 : undefined;
    const resourceData = await this._readResource(resource, overrideSha1);
    if (!resourceData)
      return this._routeUnknown(route);
    const headers: { [key: string]: string } = {};
    for (const { name, value } of resourceData.headers)
      headers[name] = value;
    headers['Access-Control-Allow-Origin'] = '*';
    route.fulfill({
      contentType: resourceData.contentType,
      body: resourceData.body,
      headers,
    });
  }

  private _routeUnknown(route: Route) {
    const url = route.request().url();
    if (!this._unknownUrls.has(url)) {
      console.log(`Request to unknown url: ${url}`);  /* eslint-disable-line no-console */
      this._unknownUrls.add(url);
    }
    route.abort();
  }

  private async _readResource(event: NetworkResourceTraceEvent, overrideSha1: string | undefined) {
    try {
      const body = await fsReadFileAsync(path.join(this._traceStorageDir, overrideSha1 || event.sha1));
      return {
        contentType: event.contentType,
        body,
        headers: event.responseHeaders,
      };
    } catch (e) {
      return undefined;
    }
  }
}