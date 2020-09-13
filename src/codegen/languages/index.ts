import * as playwright from 'playwright';
import { ActionInContext } from '../codeGenerator';

export interface LanguageGenerator {
  writeHeader(browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, deviceName?: string): void
  generateAction(actionInContext: ActionInContext, performingAction: boolean): string
  preWriteAction(eraseLastAction: boolean, lastActionText?: string): void
  postWriteAction(lastActionText: string): void
  writeFooter(): void
}

export { JavaScriptLanguageGenerator } from './javascript'