---
name: playwright-cli
description: Control browsers from the command line. Navigate pages, click elements, fill forms, take screenshots, and inspect network traffic using Playwright.
---

`playwright-cli` is a command-line interface for controlling browsers.
You can use it to navigate pages, click elements, fill forms, take screenshots, and inspect network traffic.

Run it either as a global CLI tool (`playwright-cli`), or if installed locally, prefer the local installation via `npx playwright-cli` so you don't conflict with other users.


```bash
$ playwright-cli --help

Usage: playwright-cli <command> [args] [options]

Core:
  open <url>                  open url
  close                       close the page
  type <text>                 type text into editable element
  click <ref> [button]        perform click on a web page
  dblclick <ref> [button]     perform double click on a web page
  fill <ref> <text>           fill text into editable element
  drag <startRef> <endRef>    perform drag and drop between two elements
  hover <ref>                 hover over element on page
  select <ref> <val>          select an option in a dropdown
  upload <file>               upload one or multiple files
  check <ref>                 check a checkbox or radio button
  uncheck <ref>               uncheck a checkbox or radio button
  snapshot                    capture page snapshot to obtain element ref
  eval <func> [ref]           evaluate javascript expression on page or element
  dialog-accept [prompt]      accept a dialog
  dialog-dismiss              dismiss a dialog
  resize <w> <h>              resize the browser window

Navigation:
  go-back                     go back to the previous page
  go-forward                  go forward to the next page
  reload                      reload the current page

Keyboard:
  key-press <key>             press a key on the keyboard, `a`, `arrowleft`
  key-down <key>              press a key down on the keyboard
  key-up <key>                press a key up on the keyboard

Mouse:
  mouse-move <x> <y>          move mouse to a given position
  mouse-down [button]         press mouse down
  mouse-up [button]           press mouse up
  mouse-wheel <dx> <dy>       scroll mouse wheel

Save as:
  screenshot [ref]            screenshot of the current page or element
  pdf                         save page as pdf

Tabs:
  tab-list                    list all tabs
  tab-new [url]               create a new tab
  tab-close [index]           close a browser tab
  tab-select <index>          select a browser tab

DevTools:
  console [min-level]         list console messages
  network                     list all network requests since loading the page
  run-code <code>             run playwright code snippet
  tracing-start               start trace recording
  tracing-stop                stop trace recording

Sessions:
  session-list                list all sessions
  session-stop [name]         stop session
  session-stop-all            stop all sessions
  session-delete [name]       delete session data
```
