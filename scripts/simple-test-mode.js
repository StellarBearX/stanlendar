#!/usr/bin/env node

/**
 * Simple Test Mode - Start without TypeScript compilation
 * Just run the basic servers for testing
 */

const { spawn } = require('child_process');
const fs = require('fs');

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

async function startSimpleTestMode() {
  logHeader('🧪 SIMPLE TEST MODE');
  logInfo('Starting basic test servers...\n');

  // Setup basic environment files
  logInfo('🔧 Setting up basic test environment...');
  
  // Create basic API .env
  const apiEnv = `
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
LOG_LEVEL=debug
  `.trim();

  // Create basic Web .env
  const webEnv = `
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=mock-google-client-id
NEXT_PUBLIC_APP_ENV=test
NEXT_PUBLIC_ENABLE_MOCK_MODE=true
  `.trim();

  fs.writeFileSync('apps/api/.env', apiEnv);
  fs.writeFileSync('apps/web/.env', webEnv);
  
  logSuccess('Environment files created');

  // Start Web server only (since API has TypeScript errors)
  logHeader('🌐 STARTING WEB SERVER');
  
  logInfo('Starting Web server on http://localhost:3000');
  logInfo('');
  logSuccess('🧪 SIMPLE TEST MODE - Web Only');
  logInfo('');
  logInfo('Available endpoints:');
  logInfo('  • http://localhost:3000 - Web Application');
  logInfo('');
  logWarning('Note: API server has TypeScript errors, running Web only');
  logInfo('Press Ctrl+C to stop the server');
  logInfo('');

  // Start web server
  const webProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: 'apps/web',
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
    logInfo('\n🛑 Shutting down server...');
    webProcess.kill('SIGINT');
    
    setTimeout(() => {
      logSuccess('Server stopped. Goodbye! 👋');
      process.exit(0);
    }, 1000);
  });

  // Handle process errors
  webProcess.on('error', (error) => {
    logError(`Web process error: ${error.message}`);
  });

  webProcess.on('exit', (code) => {
    if (code !== 0) {
      logError(`Web process exited with code ${code}`);
    }
  });
}

// Start simple test mode
startSimpleTestMode().catch(error => {
  logError(`Failed to start simple test mode: ${error.message}`);
  process.exit(1);
});

module.exports = { startSimpleTestMode };