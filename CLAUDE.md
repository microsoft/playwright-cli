## Build and test

The CLI source lives in `microsoft/playwright`, in `packages/playwright-core/src/tools/`. This repo
ships `@playwright/cli`: `playwright-cli.js` runs the CLI of the `playwright-core` alpha that
`package.json` pins, and adds the update check, with `skillCheck.js`. `skills/playwright-cli/` is a
copy of the skill that `playwright-cli install --skills` writes, and `node scripts/update.js`
refreshes it.

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

Labels start GitHub Actions workflows that run the Copilot CLI and open pull requests as the
`microsoft-playwright-automation` app:

- `needs-triage`, `needs-triage-mac`, `needs-triage-win` on an issue: [triage.yml](.github/workflows/triage.yml) reproduces and fixes it, with the skill in [.claude/skills/playwright-triage/](.claude/skills/playwright-triage/SKILL.md). A fix in `microsoft/playwright` opens as a draft PR there.
- `needs-revision`, `needs-revision-mac`, `needs-revision-win` on a PR that triage opened here: [revision.yml](.github/workflows/revision.yml) addresses the maintainers' review comments.
- `needs-roll` on an issue: [roll.yml](.github/workflows/roll.yml) rolls Playwright to `playwright@next`, as the roll skill says.
- `needs-release` on an issue: [release.yml](.github/workflows/release.yml) opens the `chore: mark v<version>` PR with the release notes as its description, as the release skill says. Copy the notes into the release draft.

Apply a label again to start another run. [bots.md](https://github.com/microsoft/playwright/blob/main/.github/workflows/bots.md) in `microsoft/playwright` describes triage and revision.
