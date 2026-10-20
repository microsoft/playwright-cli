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
  const corePath = require.resolve('playwright-core/package.json');
  return path.join(path.dirname(corePath), 'lib', 'tools', 'skills', 'playwright-cli', 'SKILL.md');
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
  // Normalize line endings, they could be affected by git or editor settings.
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
}

/**
 * Lists the markdown files of a skill directory, relative to it.
 * @param {string} dir
 * @returns {string[]}
 */
function skillFiles(dir) {
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} current
   * @param {string} prefix
   */
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory())
        walk(path.join(current, entry.name), relativePath);
      else if (entry.name.endsWith('.md'))
        files.push(relativePath);
    }
  };
  walk(dir, '');
  return files;
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function frame(lines) {
  if (!lines.length)
    return '';
  const width = Math.max(...lines.map(line => line.length));
  const top = '╔' + '═'.repeat(width + 2) + '╗';
  const bottom = '╚' + '═'.repeat(width + 2) + '╝';
  const body = lines.map(line => `║ ${line.padEnd(width)} ║`);
  return [top, ...body, bottom].join('\n') + '\n';
}

function checkInstalledSkills() {
  try {
    const bundledFile = bundledSkillFile();
    if (!readSkill(bundledFile))
      return;
    const bundledDir = path.dirname(bundledFile);
    // The skill is SKILL.md plus its reference guides, so compare them all: a
    // stale reference file misleads the agent just as much as a stale SKILL.md.
    const files = skillFiles(bundledDir);
    for (const target of installedSkillTargets()) {
      if (readSkill(path.join(target.dir, 'SKILL.md')) === null)
        continue;
      // A missing file reads as null and therefore counts as out of date.
      const outOfDate = files.some(file =>
        readSkill(path.join(target.dir, file)) !== readSkill(path.join(bundledDir, file)));
      if (outOfDate) {
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
