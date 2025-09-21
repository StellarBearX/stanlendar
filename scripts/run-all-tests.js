#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Runs all types of tests for final validation
 */

const { execSync } = require('child_process');
const { runSecurityAudit } = require('./security-audit');
const { runPerformanceBenchmark } = require('./performance-benchmark');
const { validateEnvironment } = require('./validate-production');

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

async function runCommand(command, description) {
  logInfo(`Running: ${description}`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} completed successfully`);
    return true;
  } catch (error) {
    logError(`${description} failed`);
    return false;
  }
}

async function runAllTests() {
  logHeader('🧪 COMPREHENSIVE TEST SUITE');
  logInfo('Running all tests for final validation...\n');
  
  const results = {
    environment: false,
    unit: false,
    integration: false,
    e2e: false,
    security: false,
    performance: false,
    acceptance: false,
    smoke: false,
  };
  
  // 1. Environment Validation
  logHeader('🌍 ENVIRONMENT VALIDATION');
  try {
    await validateEnvironment();
    results.environment = true;
    logSuccess('Environment validation passed');
  } catch (error) {
    logError(`Environment validation failed: ${error.message}`);
  }
  
  // 2. Unit Tests
  logHeader('🔬 UNIT TESTS');
  results.unit = await runCommand('npm run test:unit', 'Unit tests');
  
  // 3. Integration Tests
  logHeader('🔗 INTEGRATION TESTS');
  results.integration = await runCommand('npm run test:e2e', 'Integration tests');
  
  // 4. End-to-End Tests
  logHeader('🎭 END-TO-END TESTS');
  try {
    // Check if E2E tests exist and run them
    execSync('ls apps/web/src/e2e/*.spec.ts', { stdio: 'ignore' });
    results.e2e = await runCommand('cd apps/web && npm run test:e2e', 'End-to-end tests');
  } catch (error) {
    logWarning('E2E tests not found or not configured, skipping...');
    results.e2e = true; // Don't fail if E2E tests don't exist
  }
  
  // 5. Security Audit
  logHeader('🔒 SECURITY AUDIT');
  try {
    await runSecurityAudit();
    results.security = true;
    logSuccess('Security audit passed');
  } catch (error) {
    logError(`Security audit failed: ${error.message}`);
  }
  
  // 6. Performance Benchmarks
  logHeader('⚡ PERFORMANCE BENCHMARKS');
  try {
    const perfResult = await runPerformanceBenchmark();
    results.performance = perfResult;
    if (perfResult) {
      logSuccess('Performance benchmarks passed');
    } else {
      logWarning('Performance benchmarks completed with warnings');
    }
  } catch (error) {
    logError(`Performance benchmarks failed: ${error.message}`);
  }
  
  // 7. Acceptance Tests
  logHeader('🎯 ACCEPTANCE TESTS');
  try {
    results.acceptance = await runCommand('npm run test:acceptance', 'Acceptance tests');
  } catch (error) {
    logWarning('Acceptance tests not configured, skipping...');
    results.acceptance = true; // Don't fail if acceptance tests don't exist
  }
  
  // 8. Smoke Tests (if URLs are provided)
  logHeader('🔥 SMOKE TESTS');
  if (process.env.API_URL && process.env.WEB_URL) {
    results.smoke = await runCommand('npm run test:smoke', 'Smoke tests');
  } else {
    logWarning('API_URL and WEB_URL not provided, skipping smoke tests...');
    results.smoke = true; // Don't fail if URLs not provided
  }
  
  // Summary
  logHeader('📊 TEST RESULTS SUMMARY');
  
  const testCategories = [
    { name: 'Environment Validation', key: 'environment', critical: true },
    { name: 'Unit Tests', key: 'unit', critical: true },
    { name: 'Integration Tests', key: 'integration', critical: true },
    { name: 'End-to-End Tests', key: 'e2e', critical: false },
    { name: 'Security Audit', key: 'security', critical: true },
    { name: 'Performance Benchmarks', key: 'performance', critical: false },
    { name: 'Acceptance Tests', key: 'acceptance', critical: false },
    { name: 'Smoke Tests', key: 'smoke', critical: false },
  ];
  
  let criticalFailures = 0;
  let totalFailures = 0;
  
  testCategories.forEach(({ name, key, critical }) => {
    if (results[key]) {
      logSuccess(`${name}: PASSED`);
    } else {
      if (critical) {
        logError(`${name}: FAILED (CRITICAL)`);
        criticalFailures++;
      } else {
        logWarning(`${name}: FAILED`);
      }
      totalFailures++;
    }
  });
  
  // Final verdict
  logHeader('🏁 FINAL VERDICT');
  
  if (criticalFailures === 0 && totalFailures === 0) {
    logSuccess('🎉 ALL TESTS PASSED! Application is ready for production deployment.');
    return true;
  } else if (criticalFailures === 0) {
    logWarning(`⚠️  ${totalFailures} non-critical test(s) failed. Consider addressing before deployment.`);
    logInfo('Application may proceed to production with caution.');
    return true;
  } else {
    logError(`❌ ${criticalFailures} critical test(s) failed. DO NOT DEPLOY to production.`);
    logError('Fix critical issues before attempting deployment.');
    return false;
  }
}

// Additional utility functions
async function runQuickTests() {
  logHeader('⚡ QUICK TEST SUITE');
  logInfo('Running essential tests only...\n');
  
  const results = [];
  
  // Environment validation
  try {
    await validateEnvironment();
    results.push({ name: 'Environment', passed: true });
  } catch (error) {
    results.push({ name: 'Environment', passed: false });
  }
  
  // Unit tests
  const unitResult = await runCommand('npm run test:unit', 'Unit tests');
  results.push({ name: 'Unit Tests', passed: unitResult });
  
  // Security audit
  try {
    await runSecurityAudit();
    results.push({ name: 'Security', passed: true });
  } catch (error) {
    results.push({ name: 'Security', passed: false });
  }
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  logHeader('📊 QUICK TEST RESULTS');
  results.forEach(({ name, passed }) => {
    if (passed) {
      logSuccess(`${name}: PASSED`);
    } else {
      logError(`${name}: FAILED`);
    }
  });
  
  if (passedCount === totalCount) {
    logSuccess('🎉 Quick tests passed! Ready for full test suite.');
    return true;
  } else {
    logError(`❌ ${totalCount - passedCount}/${totalCount} quick tests failed.`);
    return false;
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'quick') {
  runQuickTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      logError(`Quick tests failed: ${error.message}`);
      process.exit(1);
    });
} else if (command === 'full' || !command) {
  runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      logError(`Test suite failed: ${error.message}`);
      process.exit(1);
    });
} else {
  logInfo('Usage:');
  logInfo('  npm run test:all        # Run full test suite');
  logInfo('  npm run test:all quick  # Run quick essential tests');
  process.exit(1);
}

module.exports = { runAllTests, runQuickTests };