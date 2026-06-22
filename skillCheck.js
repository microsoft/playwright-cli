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

// @ts-check

const fs = require('fs');
const path = require('path');

function bundledSkillFile() {
  const programPath = require.resolve('playwright-core/lib/tools/cli-client/program');
  return path.join(path.dirname(programPath), 'skill', 'SKILL.md');
}

function installedSkillTargets() {
  const cwd = process.cwd();
  return [
    { dir: path.join(cwd, '.claude', 'skills', 'playwright-cli'), command: 'playwright-cli install --skills' },
    { dir: path.join(cwd, '.agents', 'skills', 'playwright-cli'), command: 'playwright-cli install --skills=agents' },
  ];
}

/**
 * @param {string} file
 * @returns
 */
function readSkill(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function frame(lines) {
  const width = Math.max(...lines.map(line => line.length));
  const top = '╔' + '═'.repeat(width + 2) + '╗';
  const bottom = '╚' + '═'.repeat(width + 2) + '╝';
  const body = lines.map(line => `║ ${line.padEnd(width)} ║`);
  return [top, ...body, bottom].join('\n') + '\n';
}

function checkInstalledSkills() {
  try {
    const bundled = readSkill(bundledSkillFile());
    if (!bundled)
      return;
    for (const target of installedSkillTargets()) {
      const installed = readSkill(path.join(target.dir, 'SKILL.md'));
      if (installed === null)
        continue;
      if (installed !== bundled) {
        process.stderr.write(frame([
          `The playwright-cli skill at '${path.relative(process.cwd(), target.dir)}'`,
          `does not match the tool version.`,
          ``,
          `Run \`${target.command}\``,
          `to install the up-to-date skill.`,
        ]));
      }
    }
  } catch {
  }
}

module.exports = { checkInstalledSkills, frame };
