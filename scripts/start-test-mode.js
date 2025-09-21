#!/usr/bin/env node

/**
 * Quick Start Script for Test Mode
 * Starts the application in test mode without requiring real API keys
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${message}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

async function startTestMode() {
  logHeader('🧪 STARTING TEST MODE');
  logInfo('Setting up Class Schedule Sync in test mode...\n');

  // Check if dependencies are installed
  logInfo('📦 Checking dependencies...');
  if (!fs.existsSync('node_modules')) {
    logWarning('Dependencies not found. Installing...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      logSuccess('Dependencies installed');
    } catch (error) {
      logError('Failed to install dependencies');
      process.exit(1);
    }
  } else {
    logSuccess('Dependencies found');
  }

  // Copy test environment files
  logInfo('🔧 Setting up test environment...');
  
  const envFiles = [
    { src: 'apps/api/.env.test', dest: 'apps/api/.env' },
    { src: 'apps/web/.env.test', dest: 'apps/web/.env' },
  ];

  for (const { src, dest } of envFiles) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      logSuccess(`Copied ${src} to ${dest}`);
    } else {
      logWarning(`${src} not found, creating basic config...`);
      
      if (dest.includes('api')) {
        fs.writeFileSync(dest, `
NODE_ENV=test
PORT=3001
DATABASE_URL=sqlite::memory:
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-for-development-only-32-chars
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GOOGLE_CLIENT_ID=mock-google-client-id
GOOGLE_CLIENT_SECRET=mock-google-client-secret
FRONTEND_URL=http://localhost:3000
ENABLE_MOCK_MODE=true
ENABLE_GOOGLE_API_MOCK=true
ENABLE_REDIS_MOCK=true
        `.trim());
      } else {
        fs.writeFileSync(dest, `
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=mock-google-client-id
NEXT_PUBLIC_APP_ENV=test
NEXT_PUBLIC_ENABLE_MOCK_MODE=true
        `.trim());
      }
      logSuccess(`Created basic ${dest}`);
    }
  }

  // Build the applications
  logInfo('🏗️  Building applications...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    logSuccess('Applications built successfully');
  } catch (error) {
    logWarning('Build failed, but continuing in development mode...');
  }

  // Start the applications
  logHeader('🚀 STARTING APPLICATIONS');
  
  logInfo('Starting API server on http://localhost:3001');
  logInfo('Starting Web server on http://localhost:3000');
  logInfo('');
  logSuccess('🧪 TEST MODE ENABLED - No real API keys required!');
  logInfo('');
  logInfo('Available test endpoints:');
  logInfo('  • http://localhost:3001/test-mode/status');
  logInfo('  • http://localhost:3001/test-mode/sample-data');
  logInfo('  • http://localhost:3001/test-mode/mock-auth');
  logInfo('  • http://localhost:3001/health');
  logInfo('');
  logInfo('Press Ctrl+C to stop the servers');
  logInfo('');

  // Start both servers
  const apiProcess = spawn('npm', ['run', 'dev:api'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  const webProcess = spawn('npm', ['run', 'dev:web'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  // Handle API output
  apiProcess.stdout.on('data', (data) => {
    process.stdout.write(`${colors.blue}[API]${colors.reset} ${data}`);
  });

  apiProcess.stderr.on('data', (data) => {
    process.stderr.write(`${colors.blue}[API]${colors.reset} ${data}`);
  });

  // Handle Web output
  webProcess.stdout.on('data', (data) => {
    process.stdout.write(`${colors.green}[WEB]${colors.reset} ${data}`);
  });

  webProcess.stderr.on('data', (data) => {
    process.stderr.write(`${colors.green}[WEB]${colors.reset} ${data}`);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    logInfo('\n🛑 Shutting down servers...');
    apiProcess.kill('SIGINT');
    webProcess.kill('SIGINT');
    
    setTimeout(() => {
      logSuccess('Servers stopped. Goodbye! 👋');
      process.exit(0);
    }, 1000);
  });

  // Handle process errors
  apiProcess.on('error', (error) => {
    logError(`API process error: ${error.message}`);
  });

  webProcess.on('error', (error) => {
    logError(`Web process error: ${error.message}`);
  });

  apiProcess.on('exit', (code) => {
    if (code !== 0) {
      logError(`API process exited with code ${code}`);
    }
  });

  webProcess.on('exit', (code) => {
    if (code !== 0) {
      logError(`Web process exited with code ${code}`);
    }
  });
}

// Show help
function showHelp() {
  logInfo('Usage: npm run test-mode [options]');
  logInfo('');
  logInfo('Options:');
  logInfo('  --help, -h    Show this help message');
  logInfo('  --status      Check test mode status');
  logInfo('  --reset       Reset test environment');
  logInfo('');
  logInfo('Examples:');
  logInfo('  npm run test-mode         # Start in test mode');
  logInfo('  npm run test-mode --status # Check status');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.includes('--status')) {
  logInfo('Checking test mode status...');
  
  const apiEnvExists = fs.existsSync('apps/api/.env');
  const webEnvExists = fs.existsSync('apps/web/.env');
  
  logInfo(`API .env file: ${apiEnvExists ? '✅ Found' : '❌ Missing'}`);
  logInfo(`Web .env file: ${webEnvExists ? '✅ Found' : '❌ Missing'}`);
  
  if (apiEnvExists) {
    const apiEnv = fs.readFileSync('apps/api/.env', 'utf8');
    const isMockMode = apiEnv.includes('ENABLE_MOCK_MODE=true');
    logInfo(`Mock mode: ${isMockMode ? '✅ Enabled' : '❌ Disabled'}`);
  }
  
  process.exit(0);
}

if (args.includes('--reset')) {
  logInfo('Resetting test environment...');
  
  const filesToRemove = ['apps/api/.env', 'apps/web/.env'];
  filesToRemove.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      logSuccess(`Removed ${file}`);
    }
  });
  
  logSuccess('Test environment reset complete');
  process.exit(0);
}

// Start test mode
startTestMode().catch(error => {
  logError(`Failed to start test mode: ${error.message}`);
  process.exit(1);
});

module.exports = { startTestMode };