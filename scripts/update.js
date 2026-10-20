/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const skillsDir = path.join(rootDir, 'skills');

function run(command, options = {}) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: rootDir, ...options });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // 1. Regenerate the skills from the installed Playwright version.
  console.log('\n=== Running playwright-cli install --skills ===\n');
  run('node playwright-cli.js install --skills');

  // 2. Move generated skills into the existing skills folder
  console.log('\n=== Updating skills folder ===\n');
  const generatedSkillsDir = path.join(rootDir, '.claude', 'skills', 'playwright-cli');
  const targetSkillsDir = path.join(skillsDir, 'playwright-cli');

  if (!await exists(generatedSkillsDir))
    throw new Error(`Generated skills directory not found at ${generatedSkillsDir}`);

  // Stage the copy next to the target and swap it in, so that a failure midway
  // cannot leave the committed skills folder deleted.
  const stagingDir = `${targetSkillsDir}.new`;
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.cp(generatedSkillsDir, stagingDir, { recursive: true });

  const backupDir = `${targetSkillsDir}.old`;
  await fs.rm(backupDir, { recursive: true, force: true });
  if (await exists(targetSkillsDir))
    await fs.rename(targetSkillsDir, backupDir);
  try {
    await fs.rename(stagingDir, targetSkillsDir);
  } catch (error) {
    // Put the previous skills back rather than leaving nothing behind.
    if (await exists(backupDir))
      await fs.rename(backupDir, targetSkillsDir);
    throw error;
  }
  await fs.rm(backupDir, { recursive: true, force: true });
  console.log(`Copied skills from ${generatedSkillsDir} to ${targetSkillsDir}`);

  // 3. Clean up generated skills directory
  await fs.rm(generatedSkillsDir, { recursive: true });
  console.log('Cleaned up generated skills directory');

  console.log('\n=== Update complete! ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
