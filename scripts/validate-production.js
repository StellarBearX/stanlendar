#!/usr/bin/env node

/**
 * Production Environment Validation Script
 * Validates that all required environment variables and configurations
 * are properly set for production deployment.
 */

const https = require('https');
const crypto = require('crypto');

// Color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

// Required environment variables
const requiredEnvVars = {
  // Application
  NODE_ENV: { required: true, expectedValue: 'production' },
  PORT: { required: false, type: 'number' },
  
  // Database
  DATABASE_URL: { required: true, type: 'url' },
  
  // Redis
  REDIS_URL: { required: true, type: 'url' },
  
  // Authentication
  JWT_SECRET: { required: true, minLength: 32 },
  ENCRYPTION_KEY: { required: true, exactLength: 64, type: 'hex' },
  SESSION_SECRET: { required: true, minLength: 32 },
  
  // Google OAuth
  GOOGLE_CLIENT_ID: { required: true },
  GOOGLE_CLIENT_SECRET: { required: true },
  GOOGLE_REDIRECT_URI: { required: true, type: 'url' },
  
  // Frontend
  FRONTEND_URL: { required: true, type: 'url' },
  
  // Security
  CORS_ORIGIN: { required: true, type: 'url' },
  CSRF_SECRET: { required: true, minLength: 32 },
};

// Validation functions
function validateUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateHex(value) {
  return /^[0-9a-fA-F]+$/.test(value);
}

function validateNumber(value) {
  return !isNaN(parseInt(value, 10));
}

// Main validation function
async function validateEnvironment() {
  logInfo('🔍 Starting production environment validation...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion >= 18) {
    logSuccess(`Node.js version: ${nodeVersion}`);
  } else {
    logError(`Node.js version ${nodeVersion} is not supported. Minimum required: 18.x`);
    hasErrors = true;
  }
  
  // Validate environment variables
  logInfo('\n📋 Validating environment variables...');
  
  for (const [varName, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[varName];
    
    if (!value) {
      if (config.required) {
        logError(`${varName} is required but not set`);
        hasErrors = true;
      } else {
        logWarning(`${varName} is not set (optional)`);
        hasWarnings = true;
      }
      continue;
    }
    
    // Check expected value
    if (config.expectedValue && value !== config.expectedValue) {
      logError(`${varName} should be "${config.expectedValue}" but is "${value}"`);
      hasErrors = true;
      continue;
    }
    
    // Check type validations
    if (config.type === 'url' && !validateUrl(value)) {
      logError(`${varName} is not a valid URL: ${value}`);
      hasErrors = true;
      continue;
    }
    
    if (config.type === 'number' && !validateNumber(value)) {
      logError(`${varName} is not a valid number: ${value}`);
      hasErrors = true;
      continue;
    }
    
    if (config.type === 'hex' && !validateHex(value)) {
      logError(`${varName} is not valid hexadecimal: ${value.substring(0, 8)}...`);
      hasErrors = true;
      continue;
    }
    
    // Check length requirements
    if (config.minLength && value.length < config.minLength) {
      logError(`${varName} must be at least ${config.minLength} characters long`);
      hasErrors = true;
      continue;
    }
    
    if (config.exactLength && value.length !== config.exactLength) {
      logError(`${varName} must be exactly ${config.exactLength} characters long`);
      hasErrors = true;
      continue;
    }
    
    logSuccess(`${varName} is properly configured`);
  }
  
  // Validate URL accessibility
  logInfo('\n🌐 Validating URL accessibility...');
  
  const urlsToCheck = [
    { name: 'Frontend URL', url: process.env.FRONTEND_URL },
    { name: 'API URL', url: process.env.API_URL },
  ].filter(item => item.url);
  
  for (const { name, url } of urlsToCheck) {
    try {
      await checkUrlAccessibility(url);
      logSuccess(`${name} is accessible: ${url}`);
    } catch (error) {
      logWarning(`${name} is not accessible: ${url} (${error.message})`);
      hasWarnings = true;
    }
  }
  
  // Security validations
  logInfo('\n🔒 Performing security validations...');
  
  // Check if secrets are properly random
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && isWeakSecret(jwtSecret)) {
    logWarning('JWT_SECRET appears to be weak or predictable');
    hasWarnings = true;
  } else if (jwtSecret) {
    logSuccess('JWT_SECRET appears to be strong');
  }
  
  // Check HTTPS usage
  const frontendUrl = process.env.FRONTEND_URL;
  const apiUrl = process.env.API_URL;
  
  if (frontendUrl && !frontendUrl.startsWith('https://')) {
    logError('FRONTEND_URL must use HTTPS in production');
    hasErrors = true;
  }
  
  if (apiUrl && !apiUrl.startsWith('https://')) {
    logError('API_URL must use HTTPS in production');
    hasErrors = true;
  }
  
  // Database connection validation
  logInfo('\n🗄️  Validating database configuration...');
  
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
      logSuccess('Database SSL is properly configured');
    } else {
      logWarning('Database SSL configuration not detected');
      hasWarnings = true;
    }
  }
  
  // Redis configuration validation
  logInfo('\n🔴 Validating Redis configuration...');
  
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.startsWith('rediss://')) {
    logSuccess('Redis TLS is properly configured');
  } else if (redisUrl) {
    logWarning('Redis TLS configuration not detected');
    hasWarnings = true;
  }
  
  // Summary
  logInfo('\n📊 Validation Summary:');
  
  if (hasErrors) {
    logError('❌ Validation failed with errors. Please fix the issues above before deploying.');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('⚠️  Validation completed with warnings. Review the warnings above.');
    logInfo('You may proceed with deployment, but consider addressing the warnings.');
  } else {
    logSuccess('✅ All validations passed! Environment is ready for production deployment.');
  }
}

// Helper functions
function checkUrlAccessibility(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 5000 }, (response) => {
      if (response.statusCode >= 200 && response.statusCode < 400) {
        resolve();
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function isWeakSecret(secret) {
  // Check for common weak patterns
  const weakPatterns = [
    /^(secret|password|key|token)$/i,
    /^(123|abc|test|dev)/i,
    /^(.)\1{10,}$/, // Repeated characters
  ];
  
  return weakPatterns.some(pattern => pattern.test(secret));
}

// Run validation if called directly
if (require.main === module) {
  validateEnvironment().catch(error => {
    logError(`Validation failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { validateEnvironment };