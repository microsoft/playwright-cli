# playwright-cli

Playwright CLI for **SKILLS**

## Getting Started

## Installation

```bash
npm install -g @playwright/mcp@latest
playwright-cli --help
```

## Demo

Your agent will be running those, but it does not mean you can't play with it:

```
playwright-cli open https://demo.playwright.dev/todomvc/ --headed
playwright-cli type "Buy groceries"
playwright-cli press Enter
playwright-cli type "Water flowers"
playwright-cli press Enter
playwright-cli check e21
playwright-cli check e35
playwright-cli screenshot
```

### Skills-less operation

Point your agent at the CLI and let it cook. It'll read the skill off `playwright-cli --help` on its own:

```
Test the "add todo" flow on https://demo.playwright.dev/todomvc using playwright-cli.
Check playwright-cli --help for available commands.
```

### Installing skills

Claude Code, GitHub copilot and others will let you install the Playwright skills into the agentic loop.

#### plugin (recommended)
```bash
/plugin marketplace add microsoft/playwright-cli
/plugin install playwright-cli
```

#### manual

```bash
mkdir -p .claude/skills/playwright-cli
curl -o .claude/skills/playwright-cli/SKILL.md \
  https://raw.githubusercontent.com/microsoft/playwright-cli/main/skills/playwright-cli/SKILL.md
```

## Headed operation

Playwright CLI is headless by default. If you'd like to see the browser, pass `--headed` to `open`:

```bash
playwright-cli open https://playwright.dev --headed
```

## Sessions

Playwright CLI will use a dedicated persistent profile by default. It means that
your cookies and other storage state will be preserved between the calls. You can use different
instances of the browser for different projects with sessions.

Following will result in two browsers with separate profiles being available. Pass `--session` to
the invocation to talk to a specific browser.

```bash
playwright-cli open https://playwright.dev
playwright-cli --session=example open https://example.com
playwright-cli session-list
```

You can run your coding agent with the `PLAYWRIGHT_CLI_SESSION` environment variable:

```bash
PLAYWRIGHT_CLI_SESSION=todo-app claude .
```

Or instruct it to prepend `--session` to the calls.

Manage your sessions as follows:

```bash
playwright-cli session-list             # list all sessions
playwright-cli session-stop [name]      # stop session
playwright-cli session-stop-all         # stop all sessions
playwright-cli session-delete [name]    # delete session data along with the profiles
```


## Commands

### Core

```bash
playwright-cli open <url>               # open url
playwright-cli close                    # close the page
playwright-cli type <text>              # type text into editable element
playwright-cli click <ref> [button]     # perform click on a web page
playwright-cli dblclick <ref> [button]  # perform double click on a web page
playwright-cli fill <ref> <text>        # fill text into editable element
playwright-cli drag <startRef> <endRef> # perform drag and drop between two elements
playwright-cli hover <ref>              # hover over element on page
playwright-cli select <ref> <val>       # select an option in a dropdown
playwright-cli upload <file>            # upload one or multiple files
playwright-cli check <ref>              # check a checkbox or radio button
playwright-cli uncheck <ref>            # uncheck a checkbox or radio button
playwright-cli snapshot                 # capture page snapshot to obtain element ref
playwright-cli eval <func> [ref]        # evaluate javascript expression on page or element
playwright-cli dialog-accept [prompt]   # accept a dialog
playwright-cli dialog-dismiss           # dismiss a dialog
playwright-cli resize <w> <h>           # resize the browser window
```

### Navigation

```bash
playwright-cli go-back                  # go back to the previous page
playwright-cli go-forward               # go forward to the next page
playwright-cli reload                   # reload the current page
```

### Keyboard

```bash
playwright-cli press <key>              # press a key on the keyboard, `a`, `arrowleft`
playwright-cli keydown <key>            # press a key down on the keyboard
playwright-cli keyup <key>              # press a key up on the keyboard
```

### Mouse

```bash
playwright-cli mousemove <x> <y>        # move mouse to a given position
playwright-cli mousedown [button]       # press mouse down
playwright-cli mouseup [button]         # press mouse up
playwright-cli mousewheel <dx> <dy>     # scroll mouse wheel
```

### Save as

```bash
playwright-cli screenshot [ref]         # screenshot of the current page or element
playwright-cli pdf                      # save page as pdf
```

### Tabs

```bash
playwright-cli tab-list                 # list all tabs
playwright-cli tab-new [url]            # create a new tab
playwright-cli tab-close [index]        # close a browser tab
playwright-cli tab-select <index>       # select a browser tab
```

### DevTools

```bash
playwright-cli console [min-level]      # list console messages
playwright-cli network                  # list all network requests since loading the page
playwright-cli run-code <code>          # run playwright code snippet
playwright-cli tracing-start            # start trace recording
playwright-cli tracing-stop             # stop trace recording
```
