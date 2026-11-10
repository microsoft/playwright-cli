---
name: playwright-triage
description: Triage and fix an issue in microsoft/playwright-cli. Where the code of the CLI is, how to reproduce on tip-of-tree in microsoft/playwright, where a fix goes, how to run a published version, and what not to run from a PR of a third party.
---

# Playwright CLI Issue Triage

## Where the code is

This repo is the npm package `@playwright/cli`: `playwright-cli.js` with its update check,
`skillCheck.js`, the README, the skill in `skills/playwright-cli/` and some tests of the packaged
CLI. `package.json` pins the alpha of `playwright` and `playwright-core` that the package runs. The
CLI is in `microsoft/playwright`, in `packages/playwright-core/src/tools/`: `cli-client/` has the
commands and their options, `cli-daemon/` has the daemon that keeps the browser open between
commands, and `backend/` has the tools that the commands run. Most bugs and most feature requests
are fixed there.

Fix a bug here only when the cause is in a file that this repo owns. `skills/playwright-cli/` is a
copy of `packages/playwright-core/src/tools/skills/playwright-cli/`, which `scripts/update.js`
refreshes on a roll, so its fix is upstream too.

## Reproduce on tip-of-tree

The pinned alpha is older than tip-of-tree. `npm view playwright-core@<alpha> gitHead` prints the
upstream commit that an alpha was built from.

Reproduce in a checkout of `microsoft/playwright` at the tip of `main`, next to this repo, in
`../playwright`. Write the repro as a test in its `tests/mcp/cli-*.spec.ts`, with the `cli` fixture
of `tests/mcp/cli-fixtures.ts`. `npm run test-playwright-cli` runs those tests. Read its `AGENTS.md`
in full before you write the test. It says how to build, test and lint it.

The CLI uses Google Chrome by default. When it is missing, install it with
`npx playwright install chrome`.

## Fix in microsoft/playwright

When the cause is upstream, fix it in `../playwright`: create the branch `fix-<n>` from `main`, put
the regression test in its `tests/mcp/cli-*.spec.ts`, build and lint as its `AGENTS.md` says, and
commit in its convention, for example `fix(cli): ...`. The PR there says
`Refs https://github.com/microsoft/playwright-cli/issues/<n>`: the issue stays open until this repo
rolls to the fix. Open one PR, here or in `microsoft/playwright`, not both. Do not change
`package.json` here in the same change.

After the upstream PR merges, the fix reaches this repo with a roll. Check that `playwright@next`
has it:
`git -C ../playwright merge-base --is-ancestor <fix commit> <gitHead of playwright-core@next>`. If
it has the fix, roll this repo to it, as [roll.md](../dev/roll.md) says, and add a test here when
the tests of this repo can cover the issue. That PR says `Fixes <issue url>`. If it does not have
the fix yet, the next alpha brings it.

**Check the linked PRs in both repos.** A PR in `microsoft/playwright` links this issue with its
full URL or as `microsoft/playwright-cli#<n>`. Search there too:
`repo:microsoft/playwright is:pr "playwright-cli/issues/<n>"` and
`repo:microsoft/playwright is:pr "playwright-cli#<n>"`. A PR there from the team or from
`microsoft-playwright-automation` is a team PR. Verify a PR there in `../playwright`.

**Already fixed** means that tip-of-tree passes and the pinned version fails. The fix reaches users
with the next roll. Find the upstream PR with
`git -C ../playwright log <gitHead of the pinned alpha>..main -- packages/playwright-core/src/tools`,
and name it.

## Published versions

To run a published version, for example the version of the reporter or to bisect, create an empty
directory outside the repo for each version, and run there:

```bash
npm init -y
npm i @playwright/cli@<version>
npx playwright-cli --help
```

The fixtures of the repo are not available there. Run the condensed repro as `npx playwright-cli`
commands, or as a script that spawns them, in that directory. Serve the page from a `data:` URL or
from `http.createServer()` in the script. Run `npx playwright-cli close-all` when you are done, so
that no daemon stays open.

`npm view @playwright/cli@<version> dependencies.playwright-core` prints the alpha of a release.
Match a regression to upstream commits with
`git -C ../playwright log <good gitHead>..<bad gitHead> -- packages/playwright-core/src/tools`.

## PRs from third parties

Do not run a PR in this repo that changes `package.json`, `package-lock.json`, `scripts/`,
`.github/`, `.azure-pipelines/` or `.claude/`. For a PR in `microsoft/playwright`, the list in
`../playwright/.claude/skills/playwright-triage/SKILL.md` applies.
