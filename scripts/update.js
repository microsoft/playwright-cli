const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const skillsDir = path.join(rootDir, 'skills');

function run(command, options = {}) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: rootDir, ...options });
}

async function main() {
  // 1. Install latest @playwright/cli as dev dependency
  console.log('\n=== Installing @playwright/cli ===\n');
  run('npm install --save-dev @playwright/cli@latest');
  const { version } = require(path.join(rootDir, 'node_modules', '@playwright', 'cli', 'package.json'));
  console.log(`Installed @playwright/cli version: ${version}`);

  // 2. Run playwright-cli install-skills
  console.log('\n=== Running playwright-cli install --skills ===\n');
  run('npx playwright-cli install --skills');

  // 3. Move generated skills into the existing skills folder
  console.log('\n=== Updating skills folder ===\n');
  const generatedSkillsDir = path.join(rootDir, '.claude', 'skills', 'playwright-cli');
  const targetSkillsDir = path.join(skillsDir, 'playwright-cli');

  try {
    await fs.access(generatedSkillsDir);
    // Remove existing skills and copy new ones
    await fs.rm(targetSkillsDir, { recursive: true, force: true });
    await fs.cp(generatedSkillsDir, targetSkillsDir, { recursive: true });
    console.log(`Copied skills from ${generatedSkillsDir} to ${targetSkillsDir}`);

    // Clean up generated skills directory
    await fs.rm(path.join(rootDir, '.claude', 'skills'), { recursive: true });
    console.log('Cleaned up generated skills directory');
  } catch {
    console.warn('Warning: Generated skills directory not found at', generatedSkillsDir);
  }

  // 4. Copy README from @playwright/cli to root folder
  console.log('\n=== Copying README ===\n');
  const packageReadme = path.join(rootDir, 'node_modules', '@playwright', 'cli', 'README.md');
  const rootReadme = path.join(rootDir, 'README.md');

  try {
    await fs.copyFile(packageReadme, rootReadme);
    console.log(`Copied README from ${packageReadme} to ${rootReadme}`);
  } catch {
    console.warn('Warning: README not found at', packageReadme);
  }

  console.log('\n=== Update complete! ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
