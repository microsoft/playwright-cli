# How to prepare a release

A release is a `chore: mark v<next-patch>` commit whose PR body is the release notes. Example: https://github.com/microsoft/playwright-cli/pull/367.

## Steps

1. **Bump the patch version** in `package.json` (e.g. `0.1.7` → `0.1.8`), then `npm install` to sync `package-lock.json`. This is the entry point — everything else (branch name, PR title, release notes filename) keys off the new version.

2. **Find the baseline.** The previous release is the last `chore: mark v...` commit on `main`. Read the Playwright version pinned at that commit — that's the baseline for the diff.
   ```bash
   git log --oneline | grep "mark v" | head -1
   git show <sha>:package.json | grep '"playwright"'
   ```

3. **Figure out the playwright commit window.** Convert the baseline's alpha timestamp to a UTC date, and use the new alpha's date as the upper bound. Alphas are either `1.X.0-alpha-<ms-epoch>` or `1.X.0-alpha-<YYYY-MM-DD>`.
   ```bash
   date -u -d @<seconds> '+%Y-%m-%d %H:%M:%S UTC'   # for ms-epoch, divide by 1000 first
   ```

4. **List Playwright commits in the window.** Run from `~/code/playwright` (a local Playwright checkout). `--after` / `--before` work on any ref regardless of what `origin/main` currently points at; `--since` / `--until` can silently return empty if the branch is behind.
   ```bash
   cd ~/code/playwright && git log --after='<baseline-date>' --before='<new-date>' --pretty=format:'%h %ci %s'
   ```

5. **Filter to CLI-relevant commits.** Keep anything touching the CLI surface or its runtime; drop internal/unrelated churn.
   - **Keep:** `src/tools/cli-client/**`, `src/tools/cli-daemon/**`, `src/tools/mcp/**`, `remote/playwrightConnection`, CDP-attach paths, tracing/video APIs the CLI exposes, and anything with a `fix(cli)` / `feat(cli)` / `fix(mcp)` / `feat(mcp)` prefix.
   - **Drop:** test-runner rolls, firefox/chromium/webkit version bumps, docs-only, test infra, unrelated refactors.
   - Use `git show --stat <sha>` to sanity-check whether a commit's files touch the CLI.

6. **Pull issue context for each kept PR.** The PR's linked issue often has better user-facing wording than the PR/commit title.
   ```bash
   gh pr view <pr> --repo microsoft/playwright --json title,body,closingIssuesReferences
   gh issue view <issue> --repo microsoft/playwright-cli --json title,body,state
   ```

7. **Write the release notes** to `RELEASE_NOTES_v<version>.md`. Use this exact shape — **no top-level `#` header**, the PR title is the heading:

   ```markdown
   ## ✨ Highlights

   - **<emoji> <issue wording, not commit wording>** ([microsoft/playwright#<issue>](https://github.com/microsoft/playwright/issues/<issue>)) — the user-facing effect, naming the new commands / flags / config options. ([microsoft/playwright#<pr>](https://github.com/microsoft/playwright/pull/<pr>))

   ## 🐛 Fixes

   - `<commit subject>` — what changed and why it matters. ([#<pr>](https://github.com/microsoft/playwright/pull/<pr>))

   ## 📦 Upgrading

   ```bash
   npm install -g @playwright/cli@<version>
   ```
   ```

   Example highlight titles: `**🎬 Smooth 60 fps, styleable videos**`, `**🧰 WebMCP tools show up in the snapshot**`, `**🌗 Switch between light and dark color scheme**`, `**📁 Absolute paths in results**`.

   Wording rules:
   - **Section headings carry their emoji** (`✨ Highlights`, `🐛 Fixes`, `📦 Upgrading`), and **every highlight title starts with one unicode emoji** that fits the feature. No emojis in the Fixes bullets.
   - **Order highlights by how exciting they are to a user, not chronologically.** Showy features (video, new commands, new agent capabilities) go first; config knobs go last.
   - **Advertise the benefit, not the mechanism**: `video-start --fps=60` records smooth 60 fps videos, not "`--fps <n>` sets a custom frame rate". Use a concrete, copy-pasteable invocation.
   - **Don't carry caveats over from the upstream PR description** (browser limitations, "still capped at…"). They are often stale by the time the PR merges — leave them out unless verified.
   - **Highlights lead with the user-reported problem from the linked issue**, not the commit subject. Drop internal terms (`cdpPort`, `tombstones`) from highlight bullets.
   - Only list things that change user-visible behavior. Skip internal cleanups unless they have a user-facing effect — check that the CLI actually exercises the fixed path (e.g. `state-save` does not pass `indexedDB`, so an IndexedDB snapshot fix is not a CLI fix).
   - Reference both the issue (if any — it may live in `microsoft/playwright-cli` or `microsoft/playwright`, link whichever) and the microsoft/playwright PR. A highlight without an issue just omits the issue link.

8. **Commit, push, open PR.** The PR body is the contents of the release notes file (no `#` header, no filename).
   ```bash
   git checkout -b mark-v<version>
   git add package.json package-lock.json
   git commit -m "chore: mark v<version>"
   git push -u origin mark-v<version>
   gh pr create --repo microsoft/playwright-cli \
     --head pavelfeldman:mark-v<version> \
     --base main \
     --title "chore: mark v<version>" \
     --body "$(cat RELEASE_NOTES_v<version>.md)"
   ```

## Pitfalls

- **Don't use `--since` / `--until`** when diffing Playwright — if `origin/main` in the local checkout is behind, they return empty. `--after` / `--before` against the local ref work.
- **Don't include a `# playwright-cli vX.Y.Z` header** in the PR body — GitHub already renders the PR title.
- **Don't paraphrase the commit subject as the highlight.** A user who filed an issue described the pain; reuse their framing.
- **Don't include test-runner / browser-version-roll commits** in release notes — they're noise for CLI users.
