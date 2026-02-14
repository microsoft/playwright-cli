# How to roll Playwright dependency

## Steps

1. **Update Playwright packages** in `package.json`:
   - Update `playwright` (dependency) and `@playwright/test` (devDependency) to the target version.
   - Run `npm install` to update `package-lock.json`.

2. **Run the update script** to sync skills and README:
   ```bash
   node scripts/update.js
   ```
   This script:
   - Runs `node playwright-cli.js install --skills` to regenerate skills from the new Playwright version.
   - Copies the generated skills from `.claude/skills/playwright-cli/` into `skills/playwright-cli/`.
   - Cleans up the generated `.claude/skills/` directory.

3. **Update README.md** with relevant changes from the updated skill at `skills/playwright-cli/SKILL.md`. Compare the skill file with the README and update any sections that are out of date (commands, flags, default behaviors, examples).

4. **Verify** the CLI works:
   ```bash
   node playwright-cli.js --help
   ```

5. **Test** the CLI:
   ```bash
   npm run test
   ```

5. **Create a branch and commit**:
   - Branch name: `roll_<version>` (e.g. `roll_214`)
   - Commit message: `chore: roll Playwright to <version>`

## Key files

| File | Role |
|---|---|
| `package.json` | Playwright version pins (`playwright`, `@playwright/test`) |
| `playwright-cli.js` | CLI entry point — requires Playwright's program module |
| `scripts/update.js` | Automation script for syncing skills and README after version bump |
| `skills/playwright-cli/SKILL.md` | Skill definition installed from Playwright (source of truth for commands) |
| `README.md` | User-facing docs — must reflect current skill commands and behavior |
