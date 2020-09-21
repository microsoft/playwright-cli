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

import { ActionTraceEvent } from 'playwright/types/trace';
import { ContextEntry } from '../../traceModel';
import { dom, Element$ } from '../components/dom';
import './timelineView.css';
import { FilmStripView } from './filmStripView';
import { Boundaries } from '../components/geometry';

export class TimelineView {
  element: Element$;
  private _gridElement: HTMLElement;
  private _actionLabelsElement: HTMLElement;
  private _actionsElement: HTMLElement;
  private _hoverTimeBarElement: HTMLElement;

  private _boundaries: Boundaries;
  private _actions = new Map<ActionTraceEvent, { label: HTMLElement, element: HTMLElement }>();
  private _clientWidth = 0;
  private _zeroGap = 20;
  private _filmStripView: FilmStripView;

  constructor(context: ContextEntry, boundaries: Boundaries) {
    this._boundaries = boundaries;
    this._filmStripView = new FilmStripView(context, boundaries);
    this.element = dom`
      <timeline-view>
        <timeline-grid></timeline-grid>
        <timeline-lane class="timeline-action-labels"></timeline-lane>
        <timeline-lane class="timeline-actions"></timeline-lane>
        ${this._filmStripView.element}
        <timeline-time-bar class="timeline-time-bar-hover"></timeline-time-bar>
      </timeline-view>`;
    this._gridElement = this.element.$('timeline-grid');
    this._actionLabelsElement = this.element.$('.timeline-action-labels');
    this._actionsElement = this.element.$('.timeline-actions');
    this._hoverTimeBarElement = this.element.$('.timeline-time-bar-hover');
    this.element.addEventListener('mousemove', event => this._onMouseMove(event));
    this.element.addEventListener('mouseenter', event => this._onMouseEnter(event));
    this.element.addEventListener('mouseleave', event => this._onMouseLeave(event));

    for (const page of context.pages) {
      for (const { action } of page.actions) {
        const actionLabelElement = dom`<timeline-action-label class="${action.action}">${action.action}</timeline-action-label>`;
        const actionElement = dom`<timeline-action class="${action.action}"></timeline-action>`;
        this._actionLabelsElement.appendChild(actionLabelElement);
        this._actionsElement.appendChild(actionElement);
        this._actions.set(action, { label: actionLabelElement, element: actionElement });
      }
    }
  }

  pack() {
    if (!this._boundaries || !document.body.contains(this.element))
      return;
    this.measure();
    this.rebuild();
  }

  measure() {
    this._clientWidth = this._gridElement.clientWidth;
    this._filmStripView.measure();
  }

  rebuild() {
    this._filmStripView.rebuild();

    // Update dividers.
    const offsets = this._calculateDividerOffsets();
    let divider: HTMLElement = this._gridElement.firstElementChild as HTMLElement;

    for (let i = 0; i < offsets.length; ++i) {
      if (!divider) {
        divider = dom`
          <timeline-divider>
            <timeline-label></timeline-label>
          </timeline-divider>`;
        this._gridElement.appendChild(divider);
      }
      const time = offsets[i].time;
      const percent = offsets[i].percent;
      divider.firstElementChild!.textContent = msToString(time - this._boundaries.minimum);
      divider.style.left = percent + '%';
      divider = divider.nextElementSibling as HTMLElement;
    }
    while (divider) {
      const nextDivider = divider.nextElementSibling as HTMLElement;
      this._gridElement.removeChild(divider);
      divider = nextDivider;
    }

    // Update actions.
    for (const [action, { label, element }] of this._actions) {
      const left = this._timeToPercent(action.startTime!);
      const right = this._timeToPercent(action.endTime!);
      label.style.left = left + '%';
      element.style.left = left + '%';
      element.style.width = (right - left) + '%';
    }
  }

  private _onMouseEnter(event: MouseEvent) {
    this._hoverTimeBarElement.style.display = 'block';
  }

  private _onMouseLeave(event: MouseEvent) {
    this._hoverTimeBarElement.style.display = 'none';
    this._filmStripView.updatePreview(0, 0);
  }

  private _onMouseMove(event: MouseEvent) {
    this._hoverTimeBarElement.style.left = event.clientX + 'px';
    this._filmStripView.updatePreview(event.clientX, this._positionToTime(event.clientX));
  }

  private _calculateDividerOffsets(): { percent: number, time: number }[] {
    const minimumGap = 64;
    let dividerCount = this._clientWidth / minimumGap;
    const boundarySpan = this._boundaries.maximum - this._boundaries.minimum;
    const pixelsPerMillisecond = this._clientWidth / boundarySpan;
    let sectionTime = boundarySpan / dividerCount;

    const logSectionTime = Math.ceil(Math.log(sectionTime) / Math.LN10);
    sectionTime = Math.pow(10, logSectionTime);
    if (sectionTime * pixelsPerMillisecond >= 5 * minimumGap)
      sectionTime = sectionTime / 5;
    if (sectionTime * pixelsPerMillisecond >= 2 * minimumGap)
      sectionTime = sectionTime / 2;

    const firstDividerTime = this._boundaries.minimum;
    let lastDividerTime = this._boundaries.maximum;
    lastDividerTime += minimumGap / pixelsPerMillisecond;
    dividerCount = Math.ceil((lastDividerTime - firstDividerTime) / sectionTime);

    if (!sectionTime)
      dividerCount = 0;

    const offsets = [];
    for (let i = 0; i < dividerCount; ++i) {
      const time = firstDividerTime + sectionTime * i;
      offsets.push({ percent: this._timeToPercent(time), time: time });
    }
    return offsets;
  }

  private _timeToPosition(time: number): number {
    return (time - this._boundaries.minimum) / (this._boundaries.maximum - this._boundaries.minimum) * this._clientWidth + this._zeroGap;
  }

  private _positionToTime(x: number): number {
    return this._boundaries.minimum + (this._boundaries.maximum - this._boundaries.minimum) * (x - this._zeroGap) / (this._clientWidth - this._zeroGap);
  }

  private _timeToPercent(time: number): number {
    const position = this._timeToPosition(time);
    return 100 * position / this._clientWidth;
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
