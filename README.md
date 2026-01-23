# playwright-cli

Headless browser automation CLI for AI agents.

## Getting Started

Install globally via npm:

```bash
npm install -g @playwright/mcp
playwright-cli --help
```

Then point your agent to the CLI and let it explore:

```
Test the "add todo" flow on https://demo.playwright.dev/todomvc using playwright-cli.
Check playwright-cli --help for available commands.
```

### Installing the Skill

AI coding agents like GitHub Copilot and Claude Code can learn new capabilities through [skills](https://agentskills.io). To add playwright-cli as a skill:

**Plugin (recommended):**

```bash
/plugin marketplace add microsoft/playwright-cli
/plugin install playwright-cli
```

**Manual install:**

```bash
mkdir -p .claude/skills/playwright-cli
curl -o .claude/skills/playwright-cli/SKILL.md \
  https://raw.githubusercontent.com/microsoft/playwright-cli/main/skills/playwright-cli/SKILL.md
```

**Using Skills CLI:**

```bash
npx skills add microsoft/playwright-cli
```

## Commands

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
  press <key>                 press a key on the keyboard, `a`, `arrowleft`
  keydown <key>               press a key down on the keyboard
  keyup <key>                 press a key up on the keyboard

Mouse:
  mousemove <x> <y>           move mouse to a given position
  mousedown [button]          press mouse down
  mouseup [button]            press mouse up
  mousewheel <dx> <dy>        scroll mouse wheel

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

