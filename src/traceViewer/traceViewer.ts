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
import { ActionEntry, ContextEntry, PageEntry, TraceModel } from './traceModel';
import type { ActionTraceEvent, FrameSnapshot, NetworkResourceTraceEvent, PageSnapshot, PageVideoTraceEvent, TraceEvent } from './traceTypes';
import { VideoTileGenerator } from './videoTileGenerator';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

class TraceViewer {
  private _traceStorageDir: string;
  private _traceModel: TraceModel;
  private _snapshotRouter: SnapshotRouter;
  private _screenshotGenerator: ScreenshotGenerator;
  private _videoTileGenerator: VideoTileGenerator;

  constructor(traceStorageDir: string, fileName: string) {
    this._traceStorageDir = traceStorageDir;
    this._snapshotRouter = new SnapshotRouter(traceStorageDir);
    this._traceModel = {
      fileName,
      contexts: [],
      startTime: Number.MAX_VALUE,
      endTime: Number.MIN_VALUE,
    };
    this._screenshotGenerator = new ScreenshotGenerator(traceStorageDir, this._snapshotRouter, this._traceModel);
    this._videoTileGenerator = new VideoTileGenerator(path.dirname(fileName));
  }

  async load() {
    // TODO: validate trace?
    const traceContent = await fsReadFileAsync(this._traceModel.fileName, 'utf8');
    const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
    const contextEntries = new Map<string, ContextEntry>();
    const pageEntries = new Map<string, PageEntry>();
    const videoEvents: PageVideoTraceEvent[] = [];

    for (const event of events) {
      this._traceModel.startTime = Math.min(this._traceModel.startTime, (event as any).timestamp);
      this._traceModel.endTime = Math.max(this._traceModel.endTime, (event as any).timestamp);

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
        case 'page-video': {
          pageEntries.get(event.pageId)!.video = event;
          videoEvents.push(event);
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
          this._snapshotRouter.addResource(event);
          break;
        }
      }
    }
    this._traceModel.contexts = [...contextEntries.values()];
    for (const context of this._traceModel.contexts) {
      for (const page of context.pages) {
        for (const action of page.actions)
          await this._screenshotGenerator.render(action);
      }
    }

    await this._videoTileGenerator.render(videoEvents);
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
        if (!action.snapshot) {
          const snapshotFrame = uiPage.frames()[1];
          await snapshotFrame.goto('data:text/html,No snapshot available');
          return;
        }

        const snapshot = await fsReadFileAsync(path.join(this._traceStorageDir, action.snapshot!.sha1), 'utf8');
        const snapshotObject = JSON.parse(snapshot) as PageSnapshot;
        this._snapshotRouter.selectSnapshot(snapshotObject, action.contextId);

        // TODO: fix Playwright bug where frame.name is lost (empty).
        const snapshotFrame = uiPage.frames()[1];
        try {
          await snapshotFrame.goto(snapshotObject.frames[0].url);
        } catch (e) {
          if (!e.message.includes('frame was detached'))
            console.error(e);
          return;
        }
        const element = await snapshotFrame.$(action.selector || '*[__playwright_target__]');
        if (element) {
          await element.evaluate(e => {
            e.style.backgroundColor = '#ff69b460';
          });
        }
      } catch(e) {
        console.log(e);
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
        let filePath: string;
        if (request.url().includes('trace-storage')) {
          filePath = path.join(this._traceStorageDir, url.pathname.substring('/trace-storage/'.length));
        } else if (request.url().includes('context-artifact')) {
          const fullPath = url.pathname.substring('/context-artifact/'.length);
          const [contextId] = fullPath.split('/');
          const fileName = fullPath.substring(contextId.length + 1);
          filePath = path.join(path.dirname(this._traceModel.fileName), fileName);
        } else {
          filePath = path.join(__dirname, '../../out/web', url.pathname.substring(1));
        }
        const body = fs.readFileSync(filePath);
        route.fulfill({
          contentType: extensionToMime[path.extname(url.pathname).substring(1)] || 'text/plain',
          body,
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

  addResource(event: NetworkResourceTraceEvent) {
    let responseEvents = this._resourceEventsByUrl.get(event.url);
    if (!responseEvents) {
      responseEvents = [];
      this._resourceEventsByUrl.set(event.url, responseEvents);
    }
    responseEvents.push(event);
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

class ScreenshotGenerator {
  private _snapshotRouter: SnapshotRouter;
  private _traceStorageDir: string;
  private _browser: playwright.Browser | undefined;
  private _page: playwright.Page | undefined;
  private _traceModel: TraceModel;

  constructor(traceStorageDir: string, snapshotRouter: SnapshotRouter, traceModel: TraceModel) {
    this._traceStorageDir = traceStorageDir;
    this._snapshotRouter = snapshotRouter;
    this._traceModel = traceModel
  }

  async render(actionEntry: ActionEntry) {
    const { action } = actionEntry;
    if (!action.snapshot)
      return;
    const imageFileName = path.join(this._traceStorageDir, action.snapshot.sha1 + '-thumbnail.png');
    if (fs.existsSync(imageFileName))
      return;

    if (!this._page) {
      this._browser = await playwright['chromium'].launch();
      // TODO: figure out multiple contexts.
      this._page = await this._browser.newPage({
        viewport: this._traceModel.contexts[0].created.viewportSize,
        deviceScaleFactor: this._traceModel.contexts[0].created.deviceScaleFactor
      });
      this._page.route('**/*', route => {
        this._snapshotRouter.route(route);
      });
    }
    const snapshot = await fsReadFileAsync(path.join(this._traceStorageDir, action.snapshot.sha1), 'utf8');
    const snapshotObject = JSON.parse(snapshot) as PageSnapshot;
    this._snapshotRouter.selectSnapshot(snapshotObject, action.contextId);
    const url = snapshotObject.frames[0].url;
    console.log('Generating screenshot for ' + action.action, snapshotObject.frames[0].url);
    await this._page!.goto(url);

    let clip: any = undefined;
    const element = await this._page!.$(action.selector || '*[__playwright_target__]');
    if (element) {
      await element.evaluate(e => {
        e.style.backgroundColor = '#ff69b460';
      });

      clip = await element.boundingBox() || undefined;
      if (clip) {
        const thumbnailSize = {
          width: 400,
          height: 200
        };
        const insets = {
          width: 60,
          height: 30
        };
        clip.width = Math.min(thumbnailSize.width, clip.width);
        clip.height = Math.min(thumbnailSize.height, clip.height);
        if (clip.width < thumbnailSize.width) {
          clip.x -= (thumbnailSize.width - clip.width) / 2;
          clip.x = Math.max(0, clip.x);
          clip.width = thumbnailSize.width;
        } else {
          clip.x = Math.max(0, clip.x - insets.width);
        }
        if (clip.height < thumbnailSize.height) {
          clip.y -= (thumbnailSize.height - clip.height) / 2;
          clip.y = Math.max(0, clip.y);
          clip.height = thumbnailSize.height;
        } else {
          clip.y = Math.max(0, clip.y - insets.height);
        }
      }
    }

    const imageData = await this._page!.screenshot({ clip });
    await fsWriteFileAsync(imageFileName, imageData);
  }
}
