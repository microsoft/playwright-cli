import * as playwright from 'playwright';
import { ActionInContext } from '../codeGenerator';

export type HighlighterType = 'javascript' | 'csharp' | 'python';

export interface LanguageGenerator {
  generateHeader(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, deviceName?: string): string;
  generateAction(actionInContext: ActionInContext, performingAction: boolean): string;
  generateFooter(): string;
  highligherType(): HighlighterType;
}

export { JavaScriptLanguageGenerator } from './javascript';