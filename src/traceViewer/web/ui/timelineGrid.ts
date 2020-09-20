/*
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.

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
import './timelineGrid.css';

type Boundaries = {
  minimum: number;
  maximum: number;
}

export class TimelineGrid {
  element: Element$;
  private _headerElement: HTMLElement;
  private _boundaries: Boundaries | undefined;

  constructor() {
    this.element = dom`
      <timeline-grid>
        <timeline-grid-header></timeline-grid-header>
      </timeline-grid>`;
    this._headerElement = this.element.$('timeline-grid-header');
  }

  setBoundaries(boundaries: Boundaries) {
    this._boundaries = boundaries;
    this.pack();
  }

  pack() {
    if (!this._boundaries || !document.body.contains(this.element))
      return;

    const dividersElementClientWidth = this._headerElement.clientWidth;
    const offsets = calculateOffsets(dividersElementClientWidth, this._boundaries);
    let divider: HTMLElement = this._headerElement.firstElementChild as HTMLElement;

    for (let i = 0; i < offsets.length; ++i) {
      if (!divider) {
        divider = dom`
          <timeline-grid-divider>
            <timeline-grid-label></timeline-grid-label>
          </timeline-grid-divider>`;
        this._headerElement.appendChild(divider);
      }

      const time = offsets[i].time;
      const position = offsets[i].position;
      divider.firstElementChild!.textContent = msToString(time - this._boundaries.minimum);
      const percentLeft = 100 * position / dividersElementClientWidth;
      divider.style.left = percentLeft + '%';
      divider = divider.nextElementSibling as HTMLElement;
    }

    while (divider) {
      const nextDivider = divider.nextElementSibling as HTMLElement;
      this._headerElement.removeChild(divider);
      divider = nextDivider;
    }
    return true;
  }
}

function msToString(ms: number): string {
  if (!isFinite(ms))
    return '-';

  if (ms === 0)
    return '0';

  if (ms < 1000)
    return ms.toFixed(0) + 'ms';

  const seconds = ms / 1000;
  if (seconds < 60)
    return seconds.toFixed(1) + 's';

  const minutes = seconds / 60;
  if (minutes < 60)
    return minutes.toFixed(1) + 's';

  const hours = minutes / 60;
  if (hours < 24)
    return hours.toFixed(1) + 'h';

  const days = hours / 24;
  return days.toFixed(1) + 'h';
};

function calculateOffsets(clientWidth: number, boundaries: Boundaries): { position: number, time: number }[] {
  const minimumGap = 64;
  let dividerCount = clientWidth / minimumGap;
  const boundarySpan = boundaries.maximum - boundaries.minimum;
  const pixelsPerMillisecond = clientWidth / boundarySpan;
  let sectionTime = boundarySpan / dividerCount;

  const logSectionTime = Math.ceil(Math.log(sectionTime) / Math.LN10);
  sectionTime = Math.pow(10, logSectionTime);
  if (sectionTime * pixelsPerMillisecond >= 5 * minimumGap)
    sectionTime = sectionTime / 5;
  if (sectionTime * pixelsPerMillisecond >= 2 * minimumGap)
    sectionTime = sectionTime / 2;

  const firstDividerTime = boundaries.minimum;
  let lastDividerTime = boundaries.maximum;
  lastDividerTime += minimumGap / pixelsPerMillisecond;
  dividerCount = Math.ceil((lastDividerTime - firstDividerTime) / sectionTime);

  if (!sectionTime)
    dividerCount = 0;

  const offsets = [];
  for (let i = 0; i < dividerCount; ++i) {
    const time = firstDividerTime + sectionTime * i;
    const position = (time - boundaries.minimum) / (boundaries.maximum - boundaries.minimum) * clientWidth;
    offsets.push({ position: Math.floor(position), time: time });
  }
  return offsets;
}
