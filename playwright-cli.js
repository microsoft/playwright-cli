#!/usr/bin/env node
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

const { program } = require('playwright-core/lib/tools/cli-client/program');
const fs = require('fs');
const path = require('path');
const os = require('os');
const packageJson = require('./package.json');

const DEFAULT_MAX_OUTPUT_SIZE = 1048576;

function getOutputMode() {
  try {
    const configPath = path.join(process.cwd(), '.playwright', 'cli.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.outputMode || null;
    }
  } catch {}
  return null;
}

function getMaxStdOutputSize() {
  try {
    const configPath = path.join(process.cwd(), '.playwright', 'cli.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.maxStdOutputSize !== undefined) {
        return config.maxStdOutputSize;
      }
    }
  } catch {}
  return DEFAULT_MAX_OUTPUT_SIZE;
}

function getOutputDir() {
  try {
    const configPath = path.join(process.cwd(), '.playwright', 'cli.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.outputDir) {
        return config.outputDir;
      }
    }
  } catch {}
  return path.join(os.tmpdir(), 'playwright-cli-output');
}

async function main() {
  const outputMode = getOutputMode();
  
  if (outputMode !== 'fileOnLargeOutput') {
    await program({ embedderVersion: packageJson.version });
    return;
  }

  const maxSize = getMaxStdOutputSize();
  const outputDir = getOutputDir();
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const originalLog = console.log;
  let outputBuffer = '';
  
  console.log = (...args) => {
    outputBuffer += args.map(a => String(a)).join(' ') + '\n';
  };

  try {
    await program({ embedderVersion: packageJson.version });
  } finally {
    console.log = originalLog;
  }

  const outputSize = Buffer.byteLength(outputBuffer, 'utf8');
  
  if (outputSize > maxSize) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `output-${timestamp}.txt`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, outputBuffer, 'utf8');
    originalLog(`\nOutput exceeded ${maxSize} bytes (${outputSize} bytes). Saved to: ${filePath}`);
  } else {
    originalLog(outputBuffer);
  }
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});