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

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { PageVideoTraceEvent } from './traceTypes';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class VideoTileGenerator {
  private _traceStorageDir: string;

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
  }

  async render(events: PageVideoTraceEvent[]) {
    let ffmpegName = '';
    if (process.platform === 'win32') {
      if (process.arch === 'ia32')
        ffmpegName = 'ffmpeg-win32';
      else
        ffmpegName = 'ffmpeg-win64';
    }
    if (process.platform === 'darwin')
      ffmpegName = 'ffmpeg-mac';
    if (process.platform === 'linux')
      ffmpegName = 'ffmpeg-linux';
    const ffmpeg = path.join(path.dirname(require.resolve('playwright')), 'third_party', 'ffmpeg', ffmpegName);
    for (const event of events) {
      const fileName = path.join(this._traceStorageDir, event.fileName);
      if (fs.existsSync(fileName + '-metainfo.txt'))
        continue;
      console.log('Generating frames for ' + fileName);
      let result = spawnSync(ffmpeg, ['-i', fileName, `${fileName}-%03d.png`]);
      await fsWriteFileAsync(fileName + '-metainfo.txt', result.stderr);
    }
  }
}
