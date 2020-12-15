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

import * as monaco from 'monaco-editor';
import { ActionEntry } from '../../traceModel';
import * as React from 'react';
import { useAsyncMemo, useMeasure } from './helpers';

export const SourceTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  const location = React.useMemo<{ fileName?: string, lineNumber?: number, value?: string }>(() => {
    if (!actionEntry)
      return { value: '' };
    const { action } = actionEntry;
    const frames = action.stack!.split('\n').slice(1);
    const frame = frames.filter(frame => !frame.includes('playwright/lib/') && !frame.includes('playwright/src/'))[0];
    if (!frame)
      return { value: action.stack! };
    const match = frame.match(/at [^(]+\(([^:]+):(\d+):\d+\)/) || frame.match(/at ([^:^(]+):(\d+):\d+/);
    if (!match)
      return { value: action.stack! };
    const fileName = match[1];
    const lineNumber = parseInt(match[2], 10);
    return { fileName, lineNumber };
  }, [actionEntry]);

  const content = useAsyncMemo<string>(async () => {
    if (location.fileName)
      return (window as any).readFile(location.fileName);
    return location.value || '';
  }, [location.fileName, location.value], '');

  const [editor, setEditor] = React.useState<{
    editor: monaco.editor.IStandaloneCodeEditor,
    element: HTMLElement,
    decorations: string[]
  } | undefined>();
  const [measure, ref] = useMeasure<HTMLDivElement>();

  React.useLayoutEffect(() => {
    if (!ref.current)
      return;
    if (editor && editor.element === ref.current)
      return;

    monaco.editor.setTheme('vs-light');
    const standalone = monaco.editor.create(ref.current, {
      value: '',
      language: 'javascript',
      readOnly: true
    });
    standalone.layout();
    setEditor({ editor: standalone, element: ref.current, decorations: [] });
  }, [ref, editor]);

  React.useLayoutEffect(() => {
    if (editor) {
      editor.editor.setValue(content);
      editor.decorations = decorateLine(editor.editor, location.lineNumber, editor.decorations);
    }
  }, [content, editor, location.lineNumber]);
  React.useLayoutEffect(() => {
    if (editor)
      editor.decorations = decorateLine(editor.editor, location.lineNumber, editor.decorations);
  }, [location.lineNumber, editor]);

  React.useLayoutEffect(() => {
    if (editor)
      editor.editor.layout();
  }, [editor, measure.width, measure.height]);

  return <div ref={ref} style={{ flex: 'auto', minWidth: '0', minHeight: '0' }}></div>;
};

function decorateLine(editor: monaco.editor.IStandaloneCodeEditor, lineNumber: number | undefined, decorations: string[]): string[] {
  if (lineNumber !== undefined) {
    const result = editor.deltaDecorations(decorations, [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'monaco-execution-line'
      }
    }]);
    editor.revealLineInCenterIfOutsideViewport(lineNumber, 1);
    return result;
  } else {
    return editor.deltaDecorations(decorations, []);
  }
}
