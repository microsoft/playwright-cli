import * as fs from 'fs'
import * as querystring from 'querystring';
import { Writable } from 'stream';
import { highlight } from 'highlight.js';

export class OutputMultiplexer {
  private _outputs: IOutput[]
  constructor() {
    this._outputs = []
  }
  add(output: IOutput) {
    this._outputs.push(output)
  }
  write(text: string, suffix?: string) {
    for (const output of this._outputs)
      output.write(text, suffix)
  }
  popLine() {
    for (const output of this._outputs)
      output.popLine()
  }
  flush() {
    for (const output of this._outputs)
      output.flush()
  }
}

export interface IOutput {
  write(text: string, suffix?: string): void
  popLine(): void
  flush(): void
}

export class FileOutput implements IOutput {
  private _fileName: string;
  private _lines: string[];
  constructor(fileName: string) {
    this._fileName = fileName;
    this._lines = []
  }
  write(text: string, suffix: string) {
    this._lines.push(...(text + suffix).trimEnd().split('\n'))
  }
  popLine() {
    this._lines.pop()
  }
  flush() {
    fs.writeFileSync(this._fileName, this._lines.join('\n'))
  }
}

export class TerminalOutput implements IOutput {
  private _output: Writable
  constructor(output: Writable) {
    this._output = output;
  }
  private _highlight(text: string) {
    let highlightedCode = highlight('typescript', text).value;
    highlightedCode = querystring.unescape(highlightedCode);
    highlightedCode = highlightedCode.replace(/<span class="hljs-keyword">/g, '\x1b[38;5;205m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-built_in">/g, '\x1b[38;5;220m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-literal">/g, '\x1b[38;5;159m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-number">/g, '\x1b[38;5;78m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-string">/g, '\x1b[38;5;130m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-comment">/g, '\x1b[38;5;23m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-subst">/g, '\x1b[38;5;242m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-function">/g, '');
    highlightedCode = highlightedCode.replace(/<span class="hljs-params">/g, '');
    highlightedCode = highlightedCode.replace(/<\/span>/g, '\x1b[0m');
    highlightedCode = highlightedCode.replace(/&#x27;/g, "'");
    highlightedCode = highlightedCode.replace(/&quot;/g, '"');
    highlightedCode = highlightedCode.replace(/&gt;/g, '>');
    highlightedCode = highlightedCode.replace(/&lt;/g, '<');
    highlightedCode = highlightedCode.replace(/&amp;/g, '&');
    return highlightedCode;
  }
  write(text: string, suffix?: string) {
    this._output.write(this._highlight(text) + suffix)
  }
  popLine() {
    this._output.write('\u001B[1A\u001B[2K')
  }
  flush() {}
}