# 🎭 Playwright CLI  [![npm version](https://img.shields.io/npm/v/playwright-cli.svg?style=flat)](https://www.npmjs.com/package/playwright-cli) [![Join Slack](https://img.shields.io/badge/join-slack-infomational)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyMTUxMzgxMjIwLThjMDUxZmIyNTRiMTJjNjIyMzdmZDA3MTQxZWUwZTFjZjQwNGYxZGM5MzRmNzZlMWI5ZWUyOTkzMjE5Njg1NDg)

Playwright CLI is utility tool for [Playwright](https://github.com/Microsoft/playwright). With the CLI, you can:

* [Generate code](#generate-code): Record user interactions and generate Playwright scripts.
* [Open pages](#open-pages): Open pages in Chromium, Firefox and WebKit (Safari) on all platforms.
  * Emulate [devices](#emulate-devices), [color schemes](#emulate-color-scheme-and-viewport-size) and [geolocation](#emulate-geolocation-language-and-timezone).
* [Inspect selectors](#inspect-selectors): Use the Playwright DevTools API to inspect selectors.
* Generate [page screenshots](#take-screenshot) and [PDFs](#generate-pdf)

## Usage

```sh
$ npx playwright-cli --help

# To save as a dependency
$ npm install -D playwright-cli
```

## Generate code

```sh
$ npx playwright-cli codegen wikipedia.org
```

Run `codegen` and perform actions in the browser. Playwright CLI will generate JavaScript code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif">

## Open pages

With `open`, you can use Playwright bundled browsers to browse web pages. Playwright provides cross-platform WebKit builds that can be used to reproduce Safari rendering across Windows, Linux and macOS.

```sh
# Open page in Chromium
npx playwright-cli open example.com
```

```sh
# Open page in WebKit
npx playwright-cli wk example.com
```

### Emulate devices
`open` can emulate mobile and tablet devices ([see all devices](https://github.com/microsoft/playwright/blob/master/src/server/deviceDescriptors.ts)).

```sh
# Emulate iPhone 11.
npx playwright-cli --device="iPhone 11" open wikipedia.org
```

### Emulate color scheme and viewport size
```sh
# Emulate screen size and color scheme.
npx playwright-cli --viewport-size=800,600 --color-scheme=dark open twitter.com
```

### Emulate geolocation, language and timezone
```sh
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
npx playwright-cli --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" open maps.google.com
```

## Inspect selectors
During `open` or `codegen`, you can use following API inside the developer tools console of any browser.

<img src="https://user-images.githubusercontent.com/284612/92536317-37dd9380-f1ee-11ea-875d-daf1b206dd56.png">

#### playwright.$(selector)

Query Playwright selector, using the actual Playwright query engine, for example:

```js
> playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

#### playwright.$$(selector)

Same as `playwright.$`, but returns all matching elements.

```js
> playwright.$$('li >> text=John')

> [<li>, <li>, <li>, <li>]
```

#### playwright.inspect(selector)

Reveal element in the Elements panel (if DevTools of the respective browser supports it).

```js
> playwright.inspect('text=Log in')
```

#### playwright.selector(element)

Generates selector for the given element.

```js
> playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Take screenshot

```sh
# See command help
$ npx playwright-cli screenshot --help
```

```sh
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
npx playwright-cli \
  --device="iPhone 11" \
  --color-scheme=dark \
  screenshot \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh
# Capture a full page screenshot
npx playwright-cli screenshot --full-page en.wikipedia.org wiki-full.png
```

## Generate PDF

PDF generation only works in Headless Chromium.

```sh
# See command help
$ npx playwright-cli pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

## Known limitations
Opening WebKit Web Inspector will disconnect Playwright from the browser. In such cases, code generation will stop.
