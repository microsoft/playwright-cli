# playwright-cli

## Install

```
$ npm install --save-dev playwright-cli
```

## Usage

```sh
Usage: playwright-cli [options] [command]

Options:
  -V, --version                          output the version number
  -b, --browser <browserType>            browser to use, one of cr, chromium, ff, firefox, wk, webkit (default: "chromium")
  --color-scheme <scheme>                emulate preferred color scheme, "light" or "dark"
  --device <deviceName>                  emulate device, for example  "iPhone 11"
  --geolocation <coordinates>            specify geolocation coordinates, for example "37.819722,-122.478611"
  --lang <language>                      specify language / locale, for example "en-GB"
  --proxy-server <proxy>                 specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"
  --timezone <time zone>                 time zone to emulate, for example "Europe/Rome"
  --timeout <timeout>                    timeout for Playwright actions in milliseconds, defaults to 10000 (default: "10000")
  --user-agent <ua string>               specify user agent string
  --viewport-size <size>                 specify browser viewport size in pixels, for example "1280, 720"
  -h, --help                             display help for command

Commands:
  open [url]                             open page in browser specified via -b, --browser
  cr [url]                               open page in Chromium
  ff [url]                               open page in Firefox
  wk [url]                               open page in WebKit
  codegen [url]                          open page and generate code for user actions
  screenshot [options] <url> <filename>  capture a page screenshot
  pdf [options] <url> <filename>         save page as pdf
  help [command]                         display help for command
```