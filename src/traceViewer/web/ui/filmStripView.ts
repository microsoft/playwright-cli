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

type MetaInfo = {
  frames: number;
  width: number;
  height: number;
  fps: number;
};

const frameWidth = 80;

export class FilmStripView {
  readonly element: Element$;
  private _context: ContextEntry;
  private _fileNames: string[] = [];
  private _metainfo = new Map<string, MetaInfo>();
  private _stripElements = new Map<string, HTMLElement>();
  private _frameStripWidth: number = 0;
  private _hoverImageElement: any;

  constructor(context: ContextEntry) {
    this._context = context;
    for (const page of context.pages) {
      const video = page.video;
      if (!video)
        continue;
      this._fileNames.push(video.fileName);
    }
    this.element = dom`<film-strip></film-strip>`;
    for (const fileName of this._fileNames) {
      const stripElement = dom`<film-strip-lane></film-strip-lane>`;
      this._stripElements.set(fileName, stripElement);
      stripElement.addEventListener('mousemove', event => this._onMouseMove(event, fileName));
      stripElement.addEventListener('mouseenter', event => this._onMouseEnter(event, fileName));
      stripElement.addEventListener('mouseleave', event => this._onMouseLeave(event));
      this.element.appendChild(stripElement);
    }
    this._initialize();
  }

  private async _initialize() {
    for (const fileName of this._fileNames) {
      const metainfo = await fetch(`context-artifact/${this._context.created.contextId}/${fileName}-metainfo.txt`);
      const lines = (await metainfo.text()).split('\n');
      const framesMatch = lines.find(l => l.startsWith('frame='))!.match(/frame=\s+(\d+)/);
      const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'))!
      const fpsMatch = streamLine.match(/, (\d+) fps,/);
      const resolutionMatch = streamLine.match(/, (\d+)x(\d+),/);
      this._metainfo.set(fileName, {
        frames: parseInt(framesMatch![1], 10),
        width: parseInt(resolutionMatch![1], 10),
        height: parseInt(resolutionMatch![2], 10),
        fps: parseInt(fpsMatch![1], 10),
      });
    }
    this.pack();
  }

  pack() {
    if (!document.body.contains(this.element))
      return;
    this._frameStripWidth = this.element.clientWidth;
    for (const fileName of this._fileNames) {
      const metainfo = this._metainfo.get(fileName)!;
      const frameCount = this._frameStripWidth / frameWidth | 0;
      const frameStep = metainfo.frames / frameCount;
      const filmStripElement = this._stripElements.get(fileName)!;
      const frameHeight = frameWidth / metainfo.width * metainfo.height | 0;

      let frameElement: HTMLElement = filmStripElement.firstElementChild as HTMLElement;
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
                background-image: url(${this._imageURL(fileName, index)});
                background-size: ${frameWidth}px ${frameHeight}px;
                ">
            </film-strip-frame>`;
          filmStripElement.appendChild(frameElement);
        } else {
          frameElement.style.backgroundImage = `url(${this._imageURL(fileName, index)})`;
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

  private _onMouseEnter(event: MouseEvent, fileName: string) {
    const metainfo = this._metainfo.get(fileName)!;
    this._hoverImageElement = dom`<film-strip-hover></film-strip-hover>`;
    this._hoverImageElement.style.width = metainfo.width / 2 + 'px';
    this._hoverImageElement.style.height = metainfo.height / 2 + 'px';
    const rect = this.element.getBoundingClientRect();
    this._hoverImageElement.style.top = rect.bottom + 5 + 'px';
    this._hoverImageElement.style.left = (rect.width - metainfo.width / 2) / 2 + 'px';  
    document.body.appendChild(this._hoverImageElement);
    this._onMouseMove(event, fileName);
  }

  private _onMouseLeave(event: MouseEvent) {
    this._hoverImageElement.remove();
  }

  private _onMouseMove(event: MouseEvent, fileName: string) {
    if (!this._hoverImageElement)
      return;

    const metainfo = this._metainfo.get(fileName)!;
    const index = (event.clientX / this._frameStripWidth * metainfo.frames | 0);
    const image = new Image(metainfo.width / 2 | 0, metainfo.height / 2 | 0);
    image.src = this._imageURL(fileName, index);
    image.onload = () => {
      if (!this._hoverImageElement.parentElement)
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
