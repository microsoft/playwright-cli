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
import { ContextEntry, PageEntry, TraceModel } from './traceModel';
import type { ActionTraceEvent, FrameSnapshot, NetworkResourceTraceEvent, PageSnapshot, TraceEvent } from './traceTypes';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

class TraceViewer {
  private _traceStorageDir: string;
  private _traceModel: TraceModel;
  private _snapshotRouter: SnapshotRouter;

  constructor(traceStorageDir: string, fileName: string) {
    this._traceStorageDir = traceStorageDir;
    this._snapshotRouter = new SnapshotRouter(traceStorageDir);
    this._traceModel = {
      fileName,
      contexts: []
    };
  }

  async load() {
    // TODO: validate trace?
    const traceContent = await fsReadFileAsync(this._traceModel.fileName, 'utf8');
    const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
    const contextEntries = new Map<string, ContextEntry>();
    const pageEntries = new Map<string, PageEntry>();
    for (const event of events) {
      switch (event.type) {
        case 'context-created': {
          contextEntries.set(event.contextId, {
            created: event,
            pages: []
          } as any);
          break;
        }
        case 'context-destroyed': {
          contextEntries.get(event.contextId)!.destroyed = event;
          break;
        }
        case 'page-created': {
          const pageEntry: any = {
            created: event,
            actions: []
          };
          pageEntries.set(event.pageId, pageEntry);
          contextEntries.get(event.contextId)!.pages.push(pageEntry);
          break;
        }
        case 'page-destroyed': {
          pageEntries.get(event.pageId)!.destroyed = event;
          break;
        }
        case 'page-destroyed': {
          pageEntries.get(event.pageId)!.destroyed = event;
          break;
        }
        case 'action': {
          pageEntries.get(event.pageId!)!.actions.push({
            action: event,
            resources: []
          });
          break;
        }
        case 'resource': {
          const actions = pageEntries.get(event.pageId!)!.actions;
          const action = actions[actions.length - 1];
          if (action)
            action.resources.push(event);
          break;
        }
      }
    }
    this._traceModel.contexts = [...contextEntries.values()];
    this._snapshotRouter.loadEvents(events);
  }

  async show() {
    const browser = await playwright['chromium'].launch({ headless: false });
    const uiPage = await browser.newPage({ viewport: null });
    uiPage.on('close', () => process.exit(0));
    await uiPage.exposeBinding('readFile', async (_: any, path: string) => {
      return fs.readFileSync(path).toString();
    });
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
    await uiPage.exposeBinding('getTraceModel', () => this._traceModel);
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

export async function showTraceViewer(traceStorageDir: string, traceFile: string) {
  const traceViewer = new TraceViewer(traceStorageDir, traceFile);
  await traceViewer.load();
  await traceViewer.show();
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