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

import { Browser, Page } from 'playwright';
import * as playwright from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { PageVideoTraceEvent } from './traceTypes';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class VideoTileGenerator {
  private _traceStorageDir: string;

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
  }

  async render(events: PageVideoTraceEvent[]) {
    if (!events.length)
      return;

    let browser: Browser | undefined;
    let page: Page | undefined;
    for (const event of events) {
      const fileName = path.join(this._traceStorageDir, event.fileName);
      const tilesFileName = fileName + '-tiles.png';
      if (fs.existsSync(tilesFileName))
        continue;

      if (!page) {
        browser = await playwright['chromium'].launch();
        page = await browser.newPage({ viewport: null });
      }
    
      await page.route('**/index.html', async route => {
        route.fulfill({
          contentType: 'text/html',
          body: `
            <video width=240px src="/video.webm"></video>
            <canvas></canvas>
          `
        });
      });
      page.on('console', console.log);
      await page.route('**/video.webm', async route => {
        route.fulfill({
          contentType: 'video/webm',
          body: await fsReadFileAsync(fileName)
        });
      }); 
      await page.goto(`http://trace-viewer/index.html`);
      const data = await page.evaluate(() => {
        const tilesX = 4;
        const tilesY = 16;
        const playbackRate = 8;
        const frameTime = 240;
        const video = document.querySelector('video')! as HTMLVideoElement;
        const canvas = document.querySelector('canvas')! as HTMLCanvasElement;
        const [width, height] = [video.offsetWidth, video.offsetHeight];
        canvas.width = width * window.devicePixelRatio * tilesX;
        canvas.height = height * window.devicePixelRatio * tilesY;
        canvas.style.width = width * tilesX + 'px';
        canvas.style.height = height * tilesY + 'px';
        const ctx = canvas.getContext('2d')!;

        // let paintCount = 0;
        let lastFrame = 0.0;
        let frameNumber = 0;
        const updateCanvas = (now: number, metadata: any) => {
          if (now - lastFrame < frameTime / playbackRate) {
            (video as any).requestVideoFrameCallback(updateCanvas);            
            return;
          }
          console.log('Creating tile for frame #' + frameNumber);
          lastFrame = now;
          ctx.drawImage(
            video,
            (frameNumber % tilesX) * width * window.devicePixelRatio,
            (frameNumber / tilesX | 0) * height * window.devicePixelRatio,
            width * window.devicePixelRatio,
            height * window.devicePixelRatio);
          ++frameNumber;
          (video as any).requestVideoFrameCallback(updateCanvas);
        };
        (video as any).requestVideoFrameCallback(updateCanvas);
        video.playbackRate = playbackRate;
        video.play();
        return new Promise(f => {
          video.onended = () =>  {
            f(canvas.toDataURL());
          };  
        });
      }) as string;
      const buffer = Buffer.from(data.substr('data:image/png;base64,'.length), 'base64');
      await fsWriteFileAsync(tilesFileName, buffer);
    }
  }
}
