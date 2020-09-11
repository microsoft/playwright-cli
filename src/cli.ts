/**
 * Copyright (c) Microsoft Corporation.
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

/* eslint-disable no-console */

import * as program from 'commander';
import * as os from 'os';
import * as playwright from 'playwright';
import { Browser, BrowserContext, Page } from 'playwright';
import { ScriptController } from './scriptController';
import { OutputMultiplexer, TerminalOutput, FileOutput } from './outputs'
import { CodeGeneratorOutput } from './codeGenerator';

program
    .version('Version ' + require('../package.json').version)
    .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
    .option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"')
    .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"')
    .option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"')
    .option('--lang <language>', 'specify language / locale, for example "en-GB"')
    .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
    .option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"')
    .option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds, defaults to 10000', "10000")
    .option('--user-agent <ua string>', 'specify user agent string')
    .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');

program
    .command('open [url]')
    .description('open page in browser specified via -b, --browser')
    .action(function(url, command) {
      open(command.parent, url, false);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ open');
      console.log('  $ -b webkit open https://example.com');
    });

const browsers = [
  { alias: 'cr', name: 'Chromium', type: 'chromium' },
  { alias: 'ff', name: 'Firefox', type: 'firefox' },
  { alias: 'wk', name: 'WebKit', type: 'webkit' },
];

for (const {alias, name, type} of browsers) {
  program
      .command(`${alias} [url]`)
      .description(`open page in ${name}`)
      .action(function(url, command) {
        open({ ...command.parent, browser: type }, url, false);
      }).on('--help', function() {
        console.log('');
        console.log('Examples:');
        console.log('');
        console.log(`  $ ${alias} https://example.com`);
      });
}

program
    .command('codegen [url]')
    .description('open page and generate code for user actions')
    .option('-o --output <file name>', 'saves the generated script to a file')
    .action(function(url, command) {
      codegen(command.parent, url, command.output);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ record');
      console.log('  $ -b webkit record https://example.com');
    });

program
    .command('screenshot <url> <filename>')
    .description('capture a page screenshot')
    .option('--wait-for-selector <selector>', 'wait for selector before taking a screenshot')
    .option('--wait-for-timeout <timeout>', 'wait for timeout in milliseconds before taking a screenshot')
    .option('--full-page', 'whether to take a full page screenshot (entire scrollable area)')
    .action(function(url, filename, command) {
      screenshot(command.parent, command, url, filename);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ -b webkit screenshot https://example.com example.png');
    });

program
    .command('pdf <url> <filename>')
    .description('save page as pdf')
    .option('--wait-for-selector <selector>', 'wait for given selector before saving as pdf')
    .option('--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf')
    .action(function(url, filename, command) {
      pdf(command.parent, command, url, filename);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ pdf https://example.com example.png');
    });

program.parse(process.argv);

type Options = {
  browser: string;
  colorScheme: string | undefined;
  device: string | undefined;
  geolocation: string;
  lang: string;
  proxyServer: string;
  timeout: string | undefined;
  timezone: string;
  viewportSize: string | undefined;
  userAgent: string | undefined;
};

type CaptureOptions = {
  waitForSelector: string | undefined;
  waitForTimeout: string | undefined;
  fullPage: boolean;
};

async function launchContext(options: Options, headless: boolean): Promise<{ browser: Browser, browserName: string, launchOptions: playwright.LaunchOptions, contextOptions: playwright.BrowserContextOptions, context: BrowserContext }> {
  validateOptions(options);
  const browserType = lookupBrowserType(options);
  const launchOptions: playwright.LaunchOptions = {
    headless,
  };
  const contextOptions: playwright.BrowserContextOptions =
    // Copy the device descriptor since we have to compare and modify the options.
    options.device ? { ...playwright.devices[options.device] } :
      // In headful mode, use host device scale factor for things to look nice.
      // In headless, keep things the way it works in Playwright by default.
      // Assume high-dpi on MacOS. TODO: this is not perfect.
      { deviceScaleFactor: headless ? undefined : (os.platform() === 'darwin' ? 2 : 1) };

  // Work around the WebKit GTK scrolling issue.
  if (browserType.name() === 'webkit' && process.platform === 'linux') {
    delete contextOptions.hasTouch;
    delete contextOptions.isMobile;
  }

  if (contextOptions.isMobile && browserType.name() === 'firefox') {
    contextOptions.isMobile = undefined
  }

  // Proxy

  if (options.proxyServer) {
    launchOptions.proxy = {
      server: options.proxyServer
    };
  }

  const browser = await browserType.launch(launchOptions);

  // Viewport size
  if (options.viewportSize) {
    try {
      const [ width, height ] = options.viewportSize.split(',').map(n => parseInt(n, 10));
      contextOptions.viewport = { width, height };
    } catch (e) {
      console.log('Invalid window size format: use "width, height", for example --window-size=800,600');
      process.exit(0);
    }
  }

  // Geolocation

  if (options.geolocation) {
    try {
      const [latitude, longitude] = options.geolocation.split(',').map(n => parseFloat(n.trim()));
      contextOptions.geolocation = {
        latitude,
        longitude
      };
    } catch (e) {
      console.log('Invalid geolocation format: user lat, long, for example --geolocation="37.819722,-122.478611"');
      process.exit(0);
    }
    contextOptions.permissions = ['geolocation'];
  }

  // User agent

  if (options.userAgent)
    contextOptions.userAgent = options.userAgent;

  // Lang

  if (options.lang)
    contextOptions.locale = options.lang;

  // Color scheme

  if (options.colorScheme)
    contextOptions.colorScheme = options.colorScheme as 'dark' | 'light';

  // Timezone

  if (options.timezone)
    contextOptions.timezoneId = options.timezone;

  // Close app when the last window closes.

  const context = await browser.newContext(contextOptions);
  context.on('page', page => {
    page.on('close', () => {
      if (browser.contexts().find(c => c.pages().length))
        return;
      // Avoid the error when the last page is closed because the browser has been closed.
      browser.close().catch(e => null);
    })
  });
  if (options.timeout) {
    context.setDefaultTimeout(parseInt(options.timeout, 10));
    context.setDefaultNavigationTimeout(parseInt(options.timeout, 10));
  }

  // Omit options that we add automatically for presentation purpose.
  delete launchOptions.headless;
  delete contextOptions.deviceScaleFactor;
  return { browser, browserName: browserType.name(), context, contextOptions, launchOptions };
}

async function openPage(context: playwright.BrowserContext, url: string | undefined): Promise<Page> {
  const page = await context.newPage();
  if (url) {
    if (!url.startsWith('http') && !url.startsWith("file://"))
      url = 'http://' + url;
    await page.goto(url);
  }
  return page;
}

async function open(options: Options, url: string | undefined, enableRecorder: boolean, outputFile?: string) {
  const { context, browserName, launchOptions, contextOptions } = await launchContext(options, false);
  const outputs: CodeGeneratorOutput[] = [new TerminalOutput(process.stdout)];
  if (outputFile)
    outputs.push(new FileOutput(outputFile));
  new ScriptController(browserName, launchOptions, contextOptions, context, new OutputMultiplexer(outputs), enableRecorder, options.device);
  await openPage(context, url);
  if (process.env.PWCLI_EXIT_FOR_TEST)
    await Promise.all(context.pages().map(p => p.close()))
}

async function waitForPage(page: Page, captureOptions: CaptureOptions) {
  if (captureOptions.waitForSelector) {
    console.log(`Waiting for selector ${captureOptions.waitForSelector}...`);
    await page.waitForSelector(captureOptions.waitForSelector);
  }
  if (captureOptions.waitForTimeout) {
    console.log(`Waiting for timeout ${captureOptions.waitForTimeout}...`);
    await page.waitForTimeout(parseInt(captureOptions.waitForTimeout, 10));
  }
}

async function screenshot(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  const { browser, context } = await launchContext(options, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Capturing screenshot into ' + path);
  await page.screenshot({ path, fullPage: !!captureOptions.fullPage });
  await browser.close();
}

async function pdf(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  if (options.browser !== 'chromium') {
    console.error('PDF creation is only working with Chromium');
    process.exit(1);
  }
  const { browser, context } = await launchContext({ ...options, browser: 'chromium' }, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Saving as pdf into ' + path);
  await page.pdf({ path });
  await browser.close();
}

async function codegen(options: Options, url: string | undefined, outputFile?: string) {
  return open(options, url, true, outputFile);
}

function lookupBrowserType(options: Options): playwright.BrowserType<playwright.WebKitBrowser | playwright.ChromiumBrowser | playwright.FirefoxBrowser> {
  let name = options.browser;
  if (options.device) {
    const device = playwright.devices[options.device];
    name = device.defaultBrowserType;
  }
  switch (name) {
    case 'chromium': return playwright.chromium!;
    case 'webkit': return playwright.webkit!;
    case 'firefox': return playwright.firefox!;
    case 'cr': return playwright.chromium!;
    case 'wk': return playwright.webkit!;
    case 'ff': return playwright.firefox!;
  }
  program.help();
}

function validateOptions(options: Options) {
  if (options.device && !(options.device in playwright.devices)) {
    console.log(`Device descriptor not found: '${options.device}', available devices are:`);
    for (let name in playwright.devices)
      console.log(`  "${name}"`);
    process.exit(0);
  }
  if (options.colorScheme && !["light", "dark"].includes(options.colorScheme)) {
    console.log('Invalid color scheme, should be one of "light", "dark"');
    process.exit(0);
  }
}
