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

type Resources = Map<string, NetworkResourceTraceEvent[]>;

class TraceViewer {
  private _traceStorageDir: string;
  private _traceModel: TraceModel;
  private _snapshotRouter: SnapshotRouter;
  private _resources: Resources;
  private _screenshotGenerator: ScreenshotGenerator;
  private _videoTileGenerator: VideoTileGenerator;

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
    this._resources = new Map();
    this._snapshotRouter = new SnapshotRouter(traceStorageDir, this._resources);
    this._traceModel = {
      contexts: [],
    };
    this._screenshotGenerator = new ScreenshotGenerator(traceStorageDir, this._traceModel, this._resources);
    this._videoTileGenerator = new VideoTileGenerator();
  }

  private _updateTimes(entry: ContextEntry, event: TraceEvent) {
    entry.startTime = Math.min(entry.startTime, (event as any).timestamp);
    entry.endTime = Math.max(entry.endTime, (event as any).timestamp);
  }

  async load(filePath: string) {
    const traceContent = await fsReadFileAsync(filePath, 'utf8');
    const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
    const contextEntries = new Map<string, ContextEntry>();
    const pageEntries = new Map<string, PageEntry>();
    const videoEvents: PageVideoTraceEvent[] = [];

    for (const event of events) {
      switch (event.type) {
        case 'context-created': {
          contextEntries.set(event.contextId, {
            filePath,
            name: path.basename(filePath),
            startTime: Number.MAX_VALUE,
            endTime: Number.MIN_VALUE,
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
            actions: [],
            resources: [],
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
          const pageEntry = pageEntries.get(event.pageId!)!;
          const action: ActionEntry = {
            actionId: event.contextId + '/' + event.pageId + '/' + pageEntry.actions.length,
            action: event,
            resources: pageEntry.resources,
          };
          pageEntry.resources = [];
          pageEntry.actions.push(action);
          break;
        }
        case 'resource': {
          const pageEntry = pageEntries.get(event.pageId!)!;
          const action = pageEntry.actions[pageEntry.actions.length - 1];
          if (action)
            action.resources.push(event);
          else
            pageEntry.resources.push(event);
          let responseEvents = this._resources.get(event.url);
          if (!responseEvents) {
            responseEvents = [];
            this._resources.set(event.url, responseEvents);
          }
          responseEvents.push(event);
          break;
        }
      }
      this._updateTimes(contextEntries.get(event.contextId)!, event);
    }
    this._traceModel.contexts.push(...contextEntries.values());
    // TODO: generate video tiles lazily.
    await this._videoTileGenerator.render(videoEvents, path.dirname(filePath));
  }

  async show() {
    const browser = await playwright['chromium'].launch({ headless: false });
    const uiPage = await browser.newPage({ viewport: null });
    uiPage.on('close', () => process.exit(0));
    await uiPage.exposeBinding('readFile', async (_, path: string) => {
      return fs.readFileSync(path).toString();
    });
    await uiPage.exposeBinding('renderSnapshot', async (_, action: ActionTraceEvent) => {
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
      } catch (e) {
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
        if (request.url().includes('action-preview')) {
          let fullPath = url.pathname.substring('/action-preview/'.length);
          fullPath = fullPath.substring(0, fullPath.indexOf('.png'));
          const [contextId, pageId, actionIndex] = fullPath.split('/');
          this._screenshotGenerator.route(route, contextId, pageId, +actionIndex);
          return;
        }
        let filePath: string;
        if (request.url().includes('context-artifact')) {
          const fullPath = url.pathname.substring('/context-artifact/'.length);
          const [contextId] = fullPath.split('/');
          const fileName = fullPath.substring(contextId.length + 1);
          const contextEntry = this._traceModel.contexts.find(entry => entry.created.contextId === contextId)!;
          filePath = path.join(path.dirname(contextEntry.filePath), fileName);
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

export async function showTraceViewer(traceStorageDir: string | undefined, tracePath: string) {
  if (!fs.existsSync(tracePath))
    throw new Error(`${tracePath} does not exist`);

  let files: string[];
  if (fs.statSync(tracePath).isFile()) {
    files = [tracePath];
    if (!traceStorageDir)
      traceStorageDir = path.dirname(tracePath);
  } else {
    files = collectFiles(tracePath);
    if (!traceStorageDir)
      traceStorageDir = tracePath;
  }

  const traceViewer = new TraceViewer(traceStorageDir);
  for (const filePath of files)
    await traceViewer.load(filePath);
  await traceViewer.show();
}

function collectFiles(dir: string): string[] {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const fullName = path.join(dir, name);
    if (fs.lstatSync(fullName).isDirectory())
      files.push(...collectFiles(fullName));
    else if (fullName.endsWith('.trace'))
      files.push(fullName);
  }
  return files;
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
  private _resourceEventsByUrl: Resources;
  private _unknownUrls = new Set<string>();
  private _traceStorageDir: string;
  private _frameBySrc = new Map<string, FrameSnapshot>();

  constructor(traceStorageDir: string, resources: Resources) {
    this._traceStorageDir = traceStorageDir;
    this._resourceEventsByUrl = resources;
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
  private _traceStorageDir: string;
  private _browser: playwright.Browser | undefined;
  private _traceModel: TraceModel;
  private _resources: Resources;
  private _rendering = new Map<ActionEntry, Promise<Buffer | undefined>>();

  constructor(traceStorageDir: string, traceModel: TraceModel, resources: Resources) {
    this._traceStorageDir = traceStorageDir;
    this._traceModel = traceModel;
    this._resources = resources;
  }

  async route(route: Route, contextId: string, pageId: string, actionIndex: number) {
    const context = this._traceModel.contexts.find(entry => entry.created.contextId === contextId)!;
    const page = context.pages.find(entry => entry.created.pageId === pageId)!;
    const action = page.actions[actionIndex]!;
    if (!action.action.snapshot) {
      route.fulfill({ status: 404 });
      return;
    }
    const imageFileName = path.join(this._traceStorageDir, action.action.snapshot.sha1 + '-thumbnail.png');

    let body: Buffer | undefined;
    try {
      body = await fsReadFileAsync(imageFileName);
    } catch (e) {
      if (!this._rendering.has(action)) {
        this._rendering.set(action, this.render(context, action, imageFileName).then(body => {
          this._rendering.delete(action);
          return body;
        }));
      }
      body = await this._rendering.get(action)!;
    }
    if (body)
      route.fulfill({ contentType: 'image/png', body });
    else
      route.fulfill({ status: 404 });
  }

  async render(contextEntry: ContextEntry, actionEntry: ActionEntry, imageFileName: string): Promise<Buffer | undefined> {
    const { action } = actionEntry;
    if (!this._browser)
      this._browser = await playwright['chromium'].launch();
    const page = await this._browser.newPage({
      viewport: contextEntry.created.viewportSize,
      deviceScaleFactor: contextEntry.created.deviceScaleFactor
    });

    try {
      const snapshotPath = path.join(this._traceStorageDir, action.snapshot!.sha1);
      let snapshot;
      try {
        snapshot = await fsReadFileAsync(snapshotPath, 'utf8');
      } catch (e) {
        console.log(`Unable to read snapshot at ${snapshotPath}`);
        return;
      }
      const snapshotObject = JSON.parse(snapshot) as PageSnapshot;
      const snapshotRouter = new SnapshotRouter(this._traceStorageDir, this._resources);
      snapshotRouter.selectSnapshot(snapshotObject, action.contextId);
      page.route('**/*', route => snapshotRouter.route(route));
      const url = snapshotObject.frames[0].url;
      console.log('Generating screenshot for ' + action.action, snapshotObject.frames[0].url);
      await page.goto(url);

      let clip: any = undefined;
      const element = await page.$(action.selector || '*[__playwright_target__]');
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

      const imageData = await page.screenshot({ clip });
      await fsWriteFileAsync(imageFileName, imageData);
      return imageData;
    } catch (e) {
      console.log(e);
    } finally {
      await page.close();
    }
  }
}
