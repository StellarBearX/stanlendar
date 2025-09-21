#!/usr/bin/env node

/**
 * Complete Test Mode - Mock API + Next.js Web
 * No TypeScript compilation required
 */

const { spawn } = require('child_process');
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

async function startCompleteTestMode() {
  logHeader('🧪 COMPLETE TEST MODE');
  logInfo('Starting Mock API + Next.js Web servers...\n');

  // Check if dependencies are installed
  logInfo('📦 Checking dependencies...');
  if (!fs.existsSync('node_modules')) {
    logWarning('Dependencies not found. Installing...');
    try {
      const { execSync } = require('child_process');
      execSync('npm install', { stdio: 'inherit' });
      logSuccess('Dependencies installed');
    } catch (error) {
      logError('Failed to install dependencies');
      process.exit(1);
    }
  } else {
    logSuccess('Dependencies found');
  }

  // Install express and cors for mock API if not present
  logInfo('📦 Checking mock API dependencies...');
  try {
    require('express');
    require('cors');
    logSuccess('Mock API dependencies found');
  } catch (error) {
    logWarning('Installing express and cors for mock API...');
    try {
      const { execSync } = require('child_process');
      execSync('npm install express cors', { stdio: 'inherit' });
      logSuccess('Mock API dependencies installed');
    } catch (installError) {
      logError('Failed to install mock API dependencies');
      process.exit(1);
    }
  }

  // Setup environment files
  logInfo('🔧 Setting up test environment...');
  
  const webEnv = `
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_GOOGLE_CLIENT_ID=mock-google-client-id
NEXT_PUBLIC_APP_ENV=test
NEXT_PUBLIC_ENABLE_MOCK_MODE=true
  `.trim();

  fs.writeFileSync('apps/web/.env', webEnv);
  logSuccess('Web environment configured');

  // Start the servers
  logHeader('🚀 STARTING SERVERS');
  
  logInfo('Starting Mock API server on http://localhost:3002');
  logInfo('Starting Next.js Web server on http://localhost:3000');
  logInfo('');
  logSuccess('🧪 COMPLETE TEST MODE ENABLED');
  logInfo('');
  logInfo('Available endpoints:');
  logInfo('  • http://localhost:3000 - Web Application');
  logInfo('  • http://localhost:3002/health - API Health Check');
  logInfo('  • http://localhost:3002/test-mode/status - Test Mode Status');
  logInfo('  • http://localhost:3002/test-mode/sample-data - Sample Data');
  logInfo('  • http://localhost:3002/api/subjects - Subjects API');
  logInfo('');
  logInfo('Press Ctrl+C to stop both servers');
  logInfo('');

  // Start Mock API server
  const apiProcess = spawn('node', ['scripts/mock-api-server.js'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  // Start Next.js Web server
  const webProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: 'apps/web',
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
    if (code !== 0 && code !== null) {
      logError(`API process exited with code ${code}`);
    }
  });

  webProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      logError(`Web process exited with code ${code}`);
    }
  });
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  logInfo('Complete Test Mode - Mock API + Next.js Web');
  logInfo('');
  logInfo('Usage: npm run test-mode:complete [options]');
  logInfo('');
  logInfo('Options:');
  logInfo('  --help, -h    Show this help message');
  logInfo('');
  logInfo('Features:');
  logInfo('  • Mock API server with all endpoints');
  logInfo('  • Next.js web application');
  logInfo('  • No TypeScript compilation required');
  logInfo('  • Sample data included');
  logInfo('  • Mock authentication');
  process.exit(0);
}

// Start complete test mode
startCompleteTestMode().catch(error => {
  logError(`Failed to start complete test mode: ${error.message}`);
  process.exit(1);
});

module.exports = { startCompleteTestMode };