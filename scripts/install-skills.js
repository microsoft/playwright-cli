const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');

const rootDir = path.resolve(__dirname, '..');
const homedir = require('os').homedir();

function run(command, options = {}) {
  execSync(command, { stdio: 'inherit', cwd: rootDir, ...options });
}

async function promptTargets() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🎯 Select installation targets for Playwright CLI skills:\n');
  console.log('  1) Claude Code (~/.claude/skills)');
  console.log('  2) GitHub Copilot (~/.copilot/skills)');
  console.log('  3) Both\n');

  return new Promise((resolve) => {
    rl.question('Enter your choice (1, 2, or 3): ', (answer) => {
      rl.close();
      
      const choice = answer.trim();
      switch (choice) {
        case '1':
          resolve(['claude']);
          break;
        case '2':
          resolve(['copilot']);
          break;
        case '3':
          resolve(['claude', 'copilot']);
          break;
        default:
          console.log('\nInvalid choice. Installing to both targets as default.');
          resolve(['claude', 'copilot']);
      }
    });
  });
}

async function copySkills(sourceDir, targetName) {
  const targetDir = targetName === 'claude' ? '.claude' : '.copilot';
  const targetPath = path.join(homedir, targetDir, 'skills', 'playwright-cli');
  
  console.log(`\n📦 Installing skills to ~/${targetDir}/skills/playwright-cli...`);
  
  try {
    await fs.access(sourceDir);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.cp(sourceDir, targetPath, { recursive: true });
    console.log(`✓ Skills installed successfully!`);
  } catch (err) {
    console.warn(`⚠ Warning: Could not install to ${targetPath}:`, err.message);
    throw err;
  }
}

async function handleInstallSkills(options = {}) {
  console.log('🚀 Playwright CLI Skill Installer\n');
  
  // Get user's target selection
  let targets;
  if (options.targets) {
    targets = options.targets;
  } else {
    targets = await promptTargets();
  }
  
  // Run the original install command to generate skills in local .claude directory
  console.log('\n📥 Generating skills...');
  const { program } = require('playwright/lib/mcp/terminal/program');
  const packageLocation = require.resolve(path.join(rootDir, 'package.json'));
  
  // Call the upstream install with --skills (creates in cwd/.claude/skills)
  await program(packageLocation);
  
  // Source is the local .claude/skills/playwright-cli created by upstream
  const localSkillsPath = path.join(process.cwd(), '.claude', 'skills', 'playwright-cli');
  
  // Copy to selected user home directory targets
  for (const target of targets) {
    const targetDir = target === 'claude' ? '.claude' : '.copilot';
    const targetPath = path.join(homedir, targetDir, 'skills', 'playwright-cli');
    
    console.log(`\n📦 Installing skills to ~/${targetDir}/skills/playwright-cli...`);
    
    try {
      await fs.access(localSkillsPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.rm(targetPath, { recursive: true, force: true });
      await fs.cp(localSkillsPath, targetPath, { recursive: true });
      console.log(`✓ Skills installed successfully!`);
    } catch (err) {
      console.warn(`⚠ Warning: Could not install to ${targetPath}:`, err.message);
    }
  }
  
  console.log('\n✨ Installation complete!\n');
}

module.exports = { handleInstallSkills };
