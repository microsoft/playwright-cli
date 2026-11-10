## How this repo depends on Playwright

This repo ships the npm package `@playwright/cli`. The CLI itself is in `microsoft/playwright`, in
`packages/playwright-core/src/tools/`: `cli-client/` has the commands and their options,
`cli-daemon/` has the daemon that keeps the browser open between commands, and `backend/` has the
tools that the commands run.

- **What this repo owns:** `playwright-cli.js`, which runs the CLI of the pinned `playwright-core`
  and adds the update check, `skillCheck.js`, the README, and the tests of the packaged CLI.
- **What is a copy:** `skills/playwright-cli/` is a copy of
  `packages/playwright-core/src/tools/skills/playwright-cli/`. `node scripts/update.js` refreshes
  it on a roll. Change it upstream.
- **The pin:** `package.json` pins an alpha of `playwright` and `playwright-core`.
  `npm view playwright-core@<alpha> gitHead` prints the upstream commit of an alpha, and
  `npm view @playwright/cli@<version> dependencies.playwright-core` prints the alpha of a release.
  The pin is older than the tip of upstream `main`.
- **Where a fix goes:** most bugs and features are upstream. Work in a checkout of
  `microsoft/playwright` next to this repo, `../playwright`, as its `AGENTS.md` says. The tests of
  the CLI are its `tests/mcp/cli-*.spec.ts`, with the `cli` fixture of `tests/mcp/cli-fixtures.ts`,
  and `npm run test-playwright-cli` runs them. Fix here only what this repo owns.
- **How a fix arrives:** with a roll, after `playwright@next` has the upstream commit. The upstream
  PR says `Refs <issue url>` for an issue of this repo, and the roll PR here says `Fixes`.

## Build and test

```bash
npm ci
npm test                                 # tests/integration.spec.ts
npx playwright test -g "open data URL"
```

There is no build step and no lint. Tests are in `tests/integration.spec.ts`. They run
`playwright-cli.js` with `runCli()` in the output directory of the test, and the `npmRegistry`
fixture serves a fake registry for the update check. Add a case to the test whose setup is closest
instead of a new test.

## Commit Convention

Semantic commit messages: `label(scope): description`

Labels: `fix`, `feat`, `chore`, `docs`, `test`, `devops`

```bash
git checkout -b fix-39562
# ... make changes ...
git add <changed-files>
git commit -m "$(cat <<'EOF'
fix(proxy): handle SOCKS proxy authentication

Fixes: https://github.com/microsoft/playwright/issues/39562
EOF
)"
git push origin fix-39562
gh pr create --repo microsoft/playwright --head username:fix-39562 \
  --title "fix(proxy): handle SOCKS proxy authentication" \
  --body "$(cat <<'EOF'
## Summary
- <describe the change very! briefly>

Fixes https://github.com/microsoft/playwright/issues/39562
EOF
)"
```

Never add Co-Authored-By agents in commit message.
Branch naming for issue fixes: `fix-<issue-number>`

## Rolling Playwright and preparing a release

See [.claude/skills/dev/roll.md](.claude/skills/dev/roll.md) and [.claude/skills/dev/release.md](.claude/skills/dev/release.md).

## Bots

The Playwright bot does the work below. It opens pull requests as the
`microsoft-playwright-automation` app. [triage.yml](.github/workflows/triage.yml) and
[review.yml](.github/workflows/review.yml) hand it the labels:

- `agent-triage` on an issue: finds the cause and fixes the issue if it can. A fix in `microsoft/playwright` opens as a draft PR there.
- `agent-implement` on an issue: implements what the issue and the maintainers' comments say.
- `agent-task` on an issue: does what the issue asks, with the skills of this repo.
- `agent-review` on a PR: revises the PR, as the maintainers' review comments say.
- [roll.yml](.github/workflows/roll.yml) and [release.yml](.github/workflows/release.yml), from the Actions tab: they hand a task to the bot. Roll Playwright to `playwright@next`, as the roll skill says. Or open the `chore: mark v<version>` PR with the release notes as its description, as the release skill says. Copy the notes into the release draft.
- [task.yml](.github/workflows/task.yml), from the Actions tab: hands the bot the task that you type, with the skills of this repo.

Apply a label again to start another run.
