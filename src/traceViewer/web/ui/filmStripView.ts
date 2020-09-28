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

import { dom, Element$ } from '../components/dom';
import { ContextEntry } from '../../traceModel';
import './filmStripView.css';
import { PageVideoTraceEvent } from '../../traceTypes';
import { Boundaries } from '../components/geometry';

type MetaInfo = {
  frames: number;
  width: number;
  height: number;
  fps: number;
  startTime: number;
  endTime: number;
};

const frameWidth = 80;
const frameMargin = 5; // align with css

export class FilmStripView {
  readonly element: Element$;
  private _context: ContextEntry;
  private _videos: PageVideoTraceEvent[] = [];
  private _metainfo = new Map<PageVideoTraceEvent, MetaInfo>();
  private _stripElements = new Map<PageVideoTraceEvent, HTMLElement>();
  private _frameStripWidth: number = 0;
  private _hoverImageElement: HTMLElement | null = null;
  private _initialized = false;
  private _boundaries: Boundaries;

  constructor(context: ContextEntry, boundaries: Boundaries) {
    this._context = context;
    this._boundaries = boundaries;
    for (const page of context.pages) {
      const video = page.video;
      if (!video)
        continue;
      this._videos.push(video);
    }
    this.element = dom`<film-strip></film-strip>`;
    for (const video of this._videos) {
      const stripElement = dom`<film-strip-lane></film-strip-lane>`;
      this._stripElements.set(video, stripElement);
      this.element.appendChild(stripElement);
    }
    this._initialize();
  }

  private async _initialize() {
    for (const video of this._videos) {
      const metainfo = await fetch(`context-artifact/${this._context.created.contextId}/${video.fileName}-metainfo.txt`);
      const lines = (await metainfo.text()).split('\n');
      let framesLine = lines.find(l => l.startsWith('frame='))!;
      framesLine = framesLine.substring(framesLine.lastIndexOf('frame='));
      const framesMatch = framesLine.match(/frame=\s+(\d+)/);
      const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'))!
      const fpsMatch = streamLine.match(/, (\d+) fps,/);
      const resolutionMatch = streamLine.match(/, (\d+)x(\d+),/);
      const durationMatch = lines.find(l => l.trim().startsWith('Duration'))!.match(/Duration: (\d+):(\d\d):(\d\d.\d\d)/);
      const duration = (((parseInt(durationMatch![1], 10) * 60) + parseInt(durationMatch![2], 10)) * 60 + parseFloat(durationMatch![3])) * 1000;
      this._metainfo.set(video, {
        frames: parseInt(framesMatch![1], 10),
        width: parseInt(resolutionMatch![1], 10),
        height: parseInt(resolutionMatch![2], 10),
        fps: parseInt(fpsMatch![1], 10),
        startTime: (video as any).timestamp,
        endTime: (video as any).timestamp + duration
      });
    }
    this._initialized = true;
    this.measure();
    this.rebuild();
  }

  measure() {
    if (!this._initialized)
      return;
    this._frameStripWidth = this.element.clientWidth;
  }

  rebuild() {
    if (!this._initialized)
      return;
    for (const video of this._videos) {
      const metainfo = this._metainfo.get(video)!;

      const filmStripElement = this._stripElements.get(video)!;

      // Position clip on timeline.
      const gapLeft = (metainfo.startTime - this._boundaries.minimum) / (this._boundaries.maximum - this._boundaries.minimum) * this._frameStripWidth;
      const gapRight = (this._boundaries.maximum - metainfo.endTime) / (this._boundaries.maximum - this._boundaries.minimum) * this._frameStripWidth;
      const effectiveWidth = (metainfo.endTime - metainfo.startTime) / (this._boundaries.maximum - this._boundaries.minimum) * this._frameStripWidth;
      filmStripElement.style.marginLeft = 20 /* timeline zero */ + gapLeft + 'px';
      filmStripElement.style.marginRight = gapRight + 'px';

      const frameCount = effectiveWidth / (frameWidth + frameMargin) | 0;
      const frameStep = metainfo.frames / frameCount;
      const frameHeight = frameWidth / metainfo.width * metainfo.height | 0;

      let frameElement: HTMLElement = filmStripElement.querySelector('film-strip-frame') as HTMLElement;
      for (let i = 0; i < metainfo.frames; i += frameStep) {
        let index = i | 0;
        // Always show last frame.
        if (Math.floor(i + frameStep) >= metainfo.frames)
          index = metainfo.frames - 1;
        if (!frameElement) {
          frameElement = dom`
            <film-strip-frame style="
                width: ${frameWidth}px;
                height: ${frameHeight}px;
                background-image: url(${this._imageURL(video.fileName, index)});
                background-size: ${frameWidth}px ${frameHeight}px;
                ">
            </film-strip-frame>`;
          filmStripElement.appendChild(frameElement);
        } else {
          frameElement.style.backgroundImage = `url(${this._imageURL(video.fileName, index)})`;
        }
        frameElement = frameElement.nextElementSibling as HTMLElement;
      }
      while (frameElement) {
        let element = frameElement;
        frameElement = frameElement.nextElementSibling as HTMLElement;
        element.remove();
      }
    }
  }

  updatePreview(clientX: number, time: number) {
    // TODO: pick file from the Y position.
    const video = this._videos[0];
    const metainfo = this._metainfo.get(video)!;

    const image = new Image(metainfo.width / 2 | 0, metainfo.height / 2 | 0);
    const index = (time - metainfo.startTime) / (this._boundaries!.maximum - this._boundaries!.minimum) * metainfo.frames | 0;
    if (index < 0 || index >= metainfo.frames) {
      if (this._hoverImageElement) {
        this._hoverImageElement.remove();
        this._hoverImageElement = null;
      }
      return;
    }

    if (!this._hoverImageElement) {
      this._hoverImageElement = dom`<film-strip-hover></film-strip-hover>`;
      this._hoverImageElement.style.width = metainfo.width / 2 + 'px';
      this._hoverImageElement.style.height = metainfo.height / 2 + 'px';
      const rect = this.element.getBoundingClientRect();
      this._hoverImageElement.style.top = rect.bottom + 5 + 'px';
      document.body.appendChild(this._hoverImageElement);
    }
    this._hoverImageElement.style.left = Math.min(clientX, this._frameStripWidth - metainfo.width / 2 - 10) + 'px';

    image.src = this._imageURL(video.fileName, index);
    image.onload = () => {
      if (!this._hoverImageElement || !this._hoverImageElement.parentElement)
        return;
      this._hoverImageElement.textContent = '';
      this._hoverImageElement.appendChild(image);
    };
  }

  private _imageURL(fileName: string, index: number): string {
    const padding = '0'.repeat(3 - String(index + 1).length);
    return `context-artifact/${this._context.created.contextId}/${fileName}-${padding}${index + 1}.png`;
  }
}
