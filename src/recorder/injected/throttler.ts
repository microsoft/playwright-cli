/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export class Throttler {
  private _timeout: number;
  private _isRunningProcess = false;
  private _asSoonAsPossible = false;
  private _process: (() => Promise<void>) | null = null;
  private _lastCompleteTime = 0;
  private _schedulePromise: Promise<void>;
  private _scheduleResolve: (() => void) | undefined;
  private _processTimeout: any;

  constructor(timeout: number) {
    this._timeout = timeout;
    this._schedulePromise = new Promise(fulfill => {
      this._scheduleResolve = fulfill;
    });
  }

  private _processCompleted() {
    this._lastCompleteTime = this._getTime();
    this._isRunningProcess = false;
    if (this._process)
      this._innerSchedule(false);
  }

  private _onTimeout() {
    delete this._processTimeout;
    this._asSoonAsPossible = false;
    this._isRunningProcess = true;

    Promise.resolve()
        .then(this._process)
        .catch(console.error.bind(console))
        .then(this._processCompleted.bind(this))
        .then(this._scheduleResolve);
    this._schedulePromise = new Promise(fulfill => {
      this._scheduleResolve = fulfill;
    });
    this._process = null;
  }

  schedule(process: () => Promise<any>, asSoonAsPossible?: boolean): Promise<void> {
    // Deliberately skip previous process.
    this._process = process;

    // Run the first scheduled task instantly.
    const hasScheduledTasks = !!this._processTimeout || this._isRunningProcess;
    const okToFire = this._getTime() - this._lastCompleteTime > this._timeout;
    asSoonAsPossible = !!asSoonAsPossible || (!hasScheduledTasks && okToFire);
    const forceTimerUpdate = asSoonAsPossible && !this._asSoonAsPossible;
    this._asSoonAsPossible = this._asSoonAsPossible || asSoonAsPossible;
    this._innerSchedule(forceTimerUpdate);

    return this._schedulePromise;
  }

  private _innerSchedule(forceTimerUpdate: boolean) {
    if (this._isRunningProcess) {
      return;
    }
    if (this._processTimeout && !forceTimerUpdate) {
      return;
    }
    if (this._processTimeout) {
      this._clearTimeout(this._processTimeout);
    }

    const timeout = this._asSoonAsPossible ? 0 : this._timeout;
    this._processTimeout = this._setTimeout(this._onTimeout.bind(this), timeout);
  }

  private _clearTimeout(timeoutId: number) {
    clearTimeout(timeoutId);
  }

  private _setTimeout(operation: () => void, timeout: number): number {
    return window.setTimeout(operation, timeout);
  }

  private _getTime(): number {
    return window.performance.now();
  }
}
