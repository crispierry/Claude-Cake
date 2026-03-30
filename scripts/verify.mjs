import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAKE_SCHOOLS, DEFAULT_SCHOOL_KEY, SELECTABLE_SCHOOLS, SITE_CONFIG } from '../app/site-config.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function abs(path) {
  return resolve(rootDir, path);
}

async function assertExists(path) {
  await access(abs(path));
}

function runSyntaxCheck(path) {
  execFileSync(process.execPath, ['--check', abs(path)], {
    cwd: rootDir,
    stdio: 'pipe',
  });
}

async function assertLocalReferences(path) {
  const contents = await readFile(abs(path), 'utf8');
  const refs = [...contents.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('#') || ref.startsWith('data:')) {
      throw new Error(`${path} contains an external or unsupported reference: ${ref}`);
    }
    await assertExists(ref);
  }
}

async function assertNoExternalRuntimeUrls(path) {
  const contents = await readFile(abs(path), 'utf8');
  if (/https?:\/\//.test(contents)) {
    throw new Error(`${path} contains an external runtime URL`);
  }
}

async function verifyPackageScripts() {
  const packageJson = JSON.parse(await readFile(abs('package.json'), 'utf8'));
  if (packageJson?.scripts?.verify !== 'node scripts/verify.mjs') {
    throw new Error('package.json must expose "npm run verify" as "node scripts/verify.mjs"');
  }
}

async function verifyNetlifyConfig() {
  const netlifyConfig = await readFile(abs('netlify.toml'), 'utf8');
  if (!netlifyConfig.includes('command = "npm run verify"')) {
    throw new Error('netlify.toml must run "npm run verify" before publish');
  }
  if (!netlifyConfig.includes('publish = "."')) {
    throw new Error('netlify.toml must publish the repository root');
  }
}

async function verifyContentConfig() {
  if (!SITE_CONFIG.event.recipientName || !SITE_CONFIG.event.congratsHeadline) {
    throw new Error('site config is missing required event copy');
  }
  if (!SELECTABLE_SCHOOLS[DEFAULT_SCHOOL_KEY]) {
    throw new Error(`default school key "${DEFAULT_SCHOOL_KEY}" is not configured`);
  }

  for (const school of CAKE_SCHOOLS) {
    await assertExists(school.logo);
  }

  for (const school of Object.values(SELECTABLE_SCHOOLS)) {
    if (!school.audio) {
      throw new Error(`selectable school "${school.name}" is missing an audio file`);
    }
    await assertExists(school.audio);
  }
}

async function main() {
  const syntaxCheckedFiles = [
    'app/bootstrap.js',
    'app/shared-ui.js',
    'app/site-config.js',
    'app/cake-experience.js',
    'scripts/verify.mjs',
    'vendor/three/controls/OrbitControls.js',
  ];

  const requiredFiles = [
    'index.html',
    'styles.css',
    'package.json',
    'netlify.toml',
    'vendor/three/three.module.js',
    'vendor/three/controls/OrbitControls.js',
  ];

  for (const file of requiredFiles) {
    await assertExists(file);
  }

  for (const file of syntaxCheckedFiles) {
    runSyntaxCheck(file);
  }

  await assertLocalReferences('index.html');
  await verifyPackageScripts();
  await verifyNetlifyConfig();
  await verifyContentConfig();

  const runtimeFiles = [
    'index.html',
    'app/bootstrap.js',
    'app/shared-ui.js',
    'app/site-config.js',
    'app/cake-experience.js',
  ];

  for (const file of runtimeFiles) {
    await assertNoExternalRuntimeUrls(file);
  }

  console.log('Verification passed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
