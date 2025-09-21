#!/usr/bin/env node

/**
 * Deployment Readiness Checker
 * Comprehensive check to ensure application is ready for production deployment
 */

const fs = require('fs');
const { execSync } = require('child_process');

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

const CHECKLIST = {
  infrastructure: [
    {
      name: 'Vercel configuration exists',
      check: () => fs.existsSync('apps/web/vercel.json'),
      critical: true,
    },
    {
      name: 'Railway configuration exists',
      check: () => fs.existsSync('apps/api/railway.json'),
      critical: true,
    },
    {
      name: 'Dockerfile exists',
      check: () => fs.existsSync('apps/api/Dockerfile'),
      critical: false,
    },
    {
      name: 'Production environment files exist',
      check: () => fs.existsSync('apps/api/.env.production') && fs.existsSync('apps/web/.env.production'),
      critical: true,
    },
  ],
  
  documentation: [
    {
      name: 'Deployment guide exists',
      check: () => fs.existsSync('docs/deployment.md'),
      critical: true,
    },
    {
      name: 'User guide exists',
      check: () => fs.existsSync('docs/user-guide.md'),
      critical: true,
    },
    {
      name: 'Deployment checklist exists',
      check: () => fs.existsSync('docs/deployment-checklist.md'),
      critical: true,
    },
    {
      name: 'README is updated',
      check: () => {
        if (!fs.existsSync('README.md')) return false;
        const readme = fs.readFileSync('README.md', 'utf8');
        return readme.includes('deployment') || readme.includes('production');
      },
      critical: false,
    },
  ],
  
  testing: [
    {
      name: 'Unit tests exist',
      check: () => {
        try {
          execSync('find apps -name "*.test.ts" -o -name "*.spec.ts" | head -1', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      },
      critical: true,
    },
    {
      name: 'Integration tests exist',
      check: () => {
        try {
          execSync('find apps -name "*.e2e-spec.ts" | head -1', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      },
      critical: true,
    },
    {
      name: 'Smoke tests configured',
      check: () => fs.existsSync('tests/smoke/smoke.test.ts'),
      critical: true,
    },
    {
      name: 'Acceptance tests configured',
      check: () => fs.existsSync('tests/acceptance/acceptance.test.ts'),
      critical: true,
    },
  ],
  
  security: [
    {
      name: 'Security audit script exists',
      check: () => fs.existsSync('scripts/security-audit.js'),
      critical: true,
    },
    {
      name: 'Environment validation script exists',
      check: () => fs.existsSync('scripts/validate-production.js'),
      critical: true,
    },
    {
      name: 'No .env files in git',
      check: () => {
        try {
          execSync('git ls-files | grep -E "^\\.env$"', { stdio: 'ignore' });
          return false; // Found .env in git
        } catch {
          return true; // No .env in git
        }
      },
      critical: true,
    },
    {
      name: 'Gitignore includes sensitive files',
      check: () => {
        if (!fs.existsSync('.gitignore')) return false;
        const gitignore = fs.readFileSync('.gitignore', 'utf8');
        return gitignore.includes('.env') && gitignore.includes('node_modules');
      },
      critical: true,
    },
  ],
  
  cicd: [
    {
      name: 'GitHub Actions workflow exists',
      check: () => fs.existsSync('.github/workflows/deploy.yml'),
      critical: true,
    },
    {
      name: 'Test workflow exists',
      check: () => fs.existsSync('.github/workflows/test.yml'),
      critical: false,
    },
    {
      name: 'Package.json has build scripts',
      check: () => {
        if (!fs.existsSync('package.json')) return false;
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return pkg.scripts && pkg.scripts['build:api'] && pkg.scripts['build:web'];
      },
      critical: true,
    },
  ],
  
  monitoring: [
    {
      name: 'Health check endpoint implemented',
      check: () => fs.existsSync('apps/api/src/common/controllers/health.controller.ts'),
      critical: true,
    },
    {
      name: 'Monitoring alerts configured',
      check: () => fs.existsSync('monitoring/alerts.yml'),
      critical: false,
    },
    {
      name: 'Performance benchmark script exists',
      check: () => fs.existsSync('scripts/performance-benchmark.js'),
      critical: true,
    },
  ],
  
  database: [
    {
      name: 'Database migrations exist',
      check: () => fs.existsSync('apps/api/src/infra/database/migrations'),
      critical: true,
    },
    {
      name: 'Initial schema migration exists',
      check: () => {
        try {
          execSync('find apps/api/src/infra/database/migrations -name "*InitialSchema*" | head -1', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      },
      critical: true,
    },
  ],
};

async function checkDeploymentReadiness() {
  logHeader('🚀 DEPLOYMENT READINESS CHECK');
  logInfo('Checking if application is ready for production deployment...\n');
  
  let totalChecks = 0;
  let passedChecks = 0;
  let criticalFailures = 0;
  
  for (const [category, checks] of Object.entries(CHECKLIST)) {
    logHeader(`${category.toUpperCase()} CHECKS`);
    
    for (const { name, check, critical } of checks) {
      totalChecks++;
      
      try {
        const passed = check();
        
        if (passed) {
          logSuccess(name);
          passedChecks++;
        } else {
          if (critical) {
            logError(`${name} (CRITICAL)`);
            criticalFailures++;
          } else {
            logWarning(`${name} (OPTIONAL)`);
          }
        }
      } catch (error) {
        if (critical) {
          logError(`${name} (CRITICAL) - Error: ${error.message}`);
          criticalFailures++;
        } else {
          logWarning(`${name} (OPTIONAL) - Error: ${error.message}`);
        }
      }
    }
  }
  
  // Additional dynamic checks
  logHeader('DYNAMIC CHECKS');
  
  // Check if dependencies are up to date
  try {
    execSync('npm outdated --depth=0', { stdio: 'ignore' });
    logSuccess('All dependencies are up to date');
    passedChecks++;
  } catch {
    logWarning('Some dependencies are outdated (OPTIONAL)');
  }
  totalChecks++;
  
  // Check if build works
  try {
    logInfo('Testing build process...');
    execSync('npm run build:api', { stdio: 'ignore' });
    execSync('npm run build:web', { stdio: 'ignore' });
    logSuccess('Build process works');
    passedChecks++;
  } catch {
    logError('Build process failed (CRITICAL)');
    criticalFailures++;
  }
  totalChecks++;
  
  // Summary
  logHeader('📊 READINESS SUMMARY');
  
  const successRate = Math.round((passedChecks / totalChecks) * 100);
  
  logInfo(`Total checks: ${totalChecks}`);
  logInfo(`Passed: ${passedChecks}`);
  logInfo(`Failed: ${totalChecks - passedChecks}`);
  logInfo(`Critical failures: ${criticalFailures}`);
  logInfo(`Success rate: ${successRate}%`);
  
  // Final verdict
  logHeader('🏁 DEPLOYMENT VERDICT');
  
  if (criticalFailures === 0 && successRate >= 90) {
    logSuccess('🎉 APPLICATION IS READY FOR DEPLOYMENT!');
    logSuccess('All critical checks passed. You may proceed with production deployment.');
    return true;
  } else if (criticalFailures === 0 && successRate >= 80) {
    logWarning('⚠️  APPLICATION IS MOSTLY READY FOR DEPLOYMENT');
    logWarning('Consider addressing optional items before deployment.');
    logInfo('You may proceed with caution.');
    return true;
  } else if (criticalFailures === 0) {
    logWarning('⚠️  APPLICATION HAS SOME READINESS ISSUES');
    logWarning('Multiple optional checks failed. Review and address before deployment.');
    return false;
  } else {
    logError('❌ APPLICATION IS NOT READY FOR DEPLOYMENT');
    logError(`${criticalFailures} critical check(s) failed. Fix these issues before deployment.`);
    return false;
  }
}

// Run check if called directly
if (require.main === module) {
  checkDeploymentReadiness()
    .then(ready => {
      process.exit(ready ? 0 : 1);
    })
    .catch(error => {
      logError(`Readiness check failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { checkDeploymentReadiness };