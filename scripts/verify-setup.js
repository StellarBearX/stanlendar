#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Class Schedule Sync setup...\n');

// Check if required files exist
const requiredFiles = [
  'package.json',
  'turbo.json',
  'apps/web/package.json',
  'apps/api/package.json',
  'packages/types/package.json',
  '.env',
  'apps/web/.env.local',
  'docker-compose.yml'
];

console.log('📁 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing!`);
  }
}

// Check if node_modules exist
console.log('\n📦 Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('✅ Root dependencies installed');
} else {
  console.log('❌ Root dependencies not installed - run `npm install`');
}

if (fs.existsSync('apps/web/node_modules')) {
  console.log('✅ Web dependencies installed');
} else {
  console.log('❌ Web dependencies not installed');
}

if (fs.existsSync('apps/api/node_modules')) {
  console.log('✅ API dependencies installed');
} else {
  console.log('❌ API dependencies not installed');
}

// Check TypeScript compilation
console.log('\n🔧 Checking TypeScript compilation...');
try {
  execSync('npm run type-check', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  console.log(error.stdout?.toString() || error.message);
}

// Check build
console.log('\n🏗️  Checking build process...');
try {
  execSync('npm run build', { stdio: 'pipe' });
  console.log('✅ Build successful');
} catch (error) {
  console.log('❌ Build failed');
  console.log(error.stdout?.toString() || error.message);
}

console.log('\n🎉 Setup verification complete!');
console.log('\nNext steps:');
console.log('1. Start Docker services: docker-compose up -d');
console.log('2. Configure your .env files with real values');
console.log('3. Run database migrations: npm run db:migrate');
console.log('4. Start development: npm run dev');