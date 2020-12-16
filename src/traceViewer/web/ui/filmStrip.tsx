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

import { ContextEntry } from '../../traceModel';
import './filmStrip.css';
import { PageVideoTraceEvent } from '../../traceTypes';
import { Boundaries } from '../geometry';
import * as React from 'react';
import { useAsyncMemo, useMeasure } from './helpers';

type MetaInfo = {
  frames: number;
  width: number;
  height: number;
  fps: number;
  startTime: number;
  endTime: number;
};

async function fetchMetaInfo(context: ContextEntry, video: PageVideoTraceEvent): Promise<MetaInfo | undefined> {
  const response = await fetch(`context-artifact/${context.created.contextId}/${video.fileName}-metainfo.txt`);
  const lines = (await response.text()).split('\n');
  let framesLine = lines.find(l => l.startsWith('frame='));
  if (!framesLine)
    return;
  framesLine = framesLine.substring(framesLine.lastIndexOf('frame='));
  const framesMatch = framesLine.match(/frame=\s+(\d+)/);
  const outputLineIndex = lines.findIndex(l => l.trim().startsWith('Output #0'));
  const streamLine = lines.slice(outputLineIndex).find(l => l.trim().startsWith('Stream #0:0'))!;
  const fpsMatch = streamLine.match(/, (\d+) fps,/);
  const resolutionMatch = streamLine.match(/, (\d+)x(\d+)\D/);
  const durationMatch = lines.find(l => l.trim().startsWith('Duration'))!.match(/Duration: (\d+):(\d\d):(\d\d.\d\d)/);
  const duration = (((parseInt(durationMatch![1], 10) * 60) + parseInt(durationMatch![2], 10)) * 60 + parseFloat(durationMatch![3])) * 1000;
  return {
    frames: parseInt(framesMatch![1], 10),
    width: parseInt(resolutionMatch![1], 10),
    height: parseInt(resolutionMatch![2], 10),
    fps: parseInt(fpsMatch![1], 10),
    startTime: (video as any).timestamp,
    endTime: (video as any).timestamp + duration
  };
}

function imageURL(context: ContextEntry, fileName: string, index: number) {
  const imageURLpadding = '0'.repeat(3 - String(index + 1).length);
  return `context-artifact/${context.created.contextId}/${fileName}-${imageURLpadding}${index + 1}.png`;
}

export const FilmStrip: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  previewX?: number,
}> = ({ context, boundaries, previewX }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  const metaInfos = useAsyncMemo<Map<PageVideoTraceEvent, MetaInfo>>(async () => {
    const infos = new Map();
    for (const page of context.pages) {
      if (!page.video)
        continue;
      const metaInfo = await fetchMetaInfo(context, page.video);
      if (metaInfo)
        infos.set(page.video, metaInfo);
    }
    return infos;
  }, [context], new Map(), new Map());

  // TODO: pick file from the Y position.
  const previewVideo = metaInfos.keys().next().value;
  const previewMetaInfo = metaInfos.get(previewVideo);
  let previewIndex = 0;
  if ((previewX !== undefined) && previewMetaInfo) {
    const previewTime = boundaries.minimum + (boundaries.maximum - boundaries.minimum) * previewX / measure.width;
    previewIndex = (previewTime - previewMetaInfo.startTime) / (previewMetaInfo.endTime - previewMetaInfo.startTime) * previewMetaInfo.frames | 0;
  }

  const previewImage = useAsyncMemo<HTMLImageElement | undefined>(async () => {
    if (!previewMetaInfo || previewIndex < 0 || previewIndex >= previewMetaInfo.frames)
      return;
    const idealWidth = previewMetaInfo.width / 2;
    const idealHeight = previewMetaInfo.height / 2;
    const ratio = Math.min(1, (measure.width - 20) / idealWidth);
    const image = new Image((idealWidth * ratio) | 0, (idealHeight * ratio) | 0);
    image.src = imageURL(context, previewVideo.fileName, previewIndex);
    await new Promise(f => image.onload = f);
    return image;
  }, [previewMetaInfo, previewIndex, measure.width, context, previewVideo], undefined);

  // TODO: show lanes while meta info is still loading.
  return <div className='film-strip' ref={ref}>{
    Array.from(metaInfos.entries()).map(([video, metaInfo]) => <FilmStripLane
      context={context}
      boundaries={boundaries}
      video={video}
      metaInfo={metaInfo}
      width={measure.width}
      key={context.created.contextId + ':' + video.fileName}
    />)
  }
  {(previewX !== undefined) && previewMetaInfo && previewImage &&
    <div className='film-strip-hover' style={{
      width: previewImage.width + 'px',
      height: previewImage.height + 'px',
      top: measure.bottom + 5 + 'px',
      left: Math.min(previewX, measure.width - previewImage.width - 10) + 'px',
    }}>
      <img src={previewImage.src} width={previewImage.width} height={previewImage.height} />
    </div>
  }
  </div>;
};

const FilmStripLane: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  video: PageVideoTraceEvent,
  metaInfo: MetaInfo,
  width: number,
}> = ({ context, boundaries, video, metaInfo, width }) => {
  const frameWidth = 80;
  const frameMargin = 2.5;
  const boundariesSize = boundaries.maximum - boundaries.minimum;
  const gapLeft = (metaInfo.startTime - boundaries.minimum) / boundariesSize * width;
  const gapRight = (boundaries.maximum - metaInfo.endTime) / boundariesSize * width;
  const effectiveWidth = (metaInfo.endTime - metaInfo.startTime) / boundariesSize * width;

  const frameCount = effectiveWidth / (frameWidth + 2 * frameMargin) | 0;
  const frameStep = metaInfo.frames / frameCount;
  const frameHeight = frameWidth / metaInfo.width * metaInfo.height | 0;
  const frameGap = frameCount <= 1 ? 0 : (effectiveWidth - (frameWidth + 2 * frameMargin) * frameCount) / (frameCount - 1);

  const frames: JSX.Element[] = [];
  for (let i = 0; i < metaInfo.frames; i += frameStep) {
    let index = i | 0;
    // Always show last frame.
    if (Math.floor(i + frameStep) >= metaInfo.frames)
      index = metaInfo.frames - 1;
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameWidth + 'px',
      height: frameHeight + 'px',
      backgroundImage: `url(${imageURL(context, video.fileName, index)})`,
      backgroundSize: `${frameWidth}px ${frameHeight}px`,
      margin: frameMargin + 'px',
      marginRight: (frameMargin + frameGap) + 'px',
    }} />);
  }

  return <div className='film-strip-lane' style={{
    marginLeft: gapLeft + 'px',
    marginRight: gapRight + 'px',
  }}>{frames}</div>;
};
