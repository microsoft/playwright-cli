# Docker Browser

Run the browser inside a Docker container while keeping `playwright-cli` on the host. This gives you a clean, isolated browser environment that does not appear on your host display, and lets you observe the running session through a web-based VNC viewer.

## When to use this

- You need browser isolation from your local machine
- You want to bake in custom certificates, proxies, or environment variables
- You need the browser headful (for sites that detect headless) without it showing on your desktop
- You are running multiple agent sessions and want separate, reproducible browser environments

## Setup

### 1. Start the browser container

```bash
cd docker
./playwright-browser.sh start
```

The container exposes:
- `ws://localhost:3000` — Playwright WebSocket server (used by `playwright-cli`)
- `http://localhost:6080/vnc.html` — noVNC web viewer to watch the browser

### 2. Configure playwright-cli to use the container

Copy `docker/cli.config.json` to your project's `.playwright/cli.config.json`:

```bash
mkdir -p .playwright
cp docker/cli.config.json .playwright/cli.config.json
```

Or pass it explicitly:

```bash
playwright-cli --config docker/cli.config.json open https://example.com
```

### 3. Use playwright-cli normally

Pass `--browser=chromium` when opening a new session (the container has Chromium pre-installed):

```bash
playwright-cli open --browser=chromium https://example.com
playwright-cli snapshot
playwright-cli click e3
playwright-cli screenshot
playwright-cli close
```

All commands run against the browser inside the container.

### 4. Watch the browser

```bash
./playwright-browser.sh vnc
# Opens http://localhost:6080/vnc.html in your browser
```

### 5. Stop the container

```bash
./playwright-browser.sh stop
```

## Custom certificates or proxy

To bake in custom CA certificates or proxy settings, extend the `Dockerfile`:

```dockerfile
FROM playwright-browser  # or rebuild from docker/Dockerfile

# Custom CA certificate
COPY my-ca.pem /usr/local/share/ca-certificates/my-ca.crt
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/my-ca.crt
```

Add proxy settings via `launchOptions` in `cli.config.json`:

```json
{
  "browser": {
    "remoteEndpoint": "ws://localhost:3000",
    "launchOptions": {
      "proxy": { "server": "http://myproxy:3128" }
    }
  }
}
```

## Persistent browser profile

By default the container mounts `~/.playwright-browser-profile` as the browser profile directory. This persists cookies and storage across container restarts.

To use a custom profile path, edit the volume mount in `playwright-browser.sh`:

```bash
-v "/path/to/my/profile:/data/browser-profile"
```

## Session isolation

Use named sessions to run multiple isolated browser containers simultaneously:

```bash
# Start two containers on different ports
SERVER_PORT=3000 ./playwright-browser.sh start
SERVER_PORT=3001 ./playwright-browser.sh start

# Point each session at its own container
playwright-cli -s=session-a --config config-a.json open https://example.com
playwright-cli -s=session-b --config config-b.json open https://example.com
```
