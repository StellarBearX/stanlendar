#!/usr/bin/env node

/**
 * Security Audit Script
 * Performs comprehensive security checks on the application
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function runSecurityAudit() {
  logInfo('🔒 Starting comprehensive security audit...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // 1. NPM Audit
  logInfo('📦 Running npm audit...');
  try {
    execSync('npm audit --audit-level=high', { stdio: 'inherit' });
    logSuccess('NPM audit passed - no high/critical vulnerabilities found');
  } catch (error) {
    logError('NPM audit found high/critical vulnerabilities');
    hasErrors = true;
  }
  
  // 2. Check for hardcoded secrets
  logInfo('\n🔍 Scanning for hardcoded secrets...');
  const secretPatterns = [
    /password\s*=\s*['"][^'"]+['"]/gi,
    /secret\s*=\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
    /token\s*=\s*['"][^'"]+['"]/gi,
    /private[_-]?key\s*=\s*['"][^'"]+['"]/gi,
  ];
  
  const filesToCheck = [
    'apps/api/src/**/*.ts',
    'apps/web/src/**/*.ts',
    'apps/web/src/**/*.tsx',
  ];
  
  let secretsFound = false;
  
  for (const pattern of filesToCheck) {
    try {
      const files = execSync(`find ${pattern.replace('**/*', '.')} -name "*.ts" -o -name "*.tsx" 2>/dev/null || true`, { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
      
      for (const file of files) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          for (const secretPattern of secretPatterns) {
            if (secretPattern.test(content)) {
              logWarning(`Potential hardcoded secret in ${file}`);
              secretsFound = true;
              hasWarnings = true;
            }
          }
        }
      }
    } catch (error) {
      // Ignore file system errors
    }
  }
  
  if (!secretsFound) {
    logSuccess('No hardcoded secrets detected');
  }
  
  // 3. Check environment variable usage
  logInfo('\n🌍 Checking environment variable security...');
  
  const envFiles = ['.env', '.env.example', '.env.production', 'apps/api/.env.production', 'apps/web/.env.production'];
  let envIssues = false;
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      
      // Check for actual secrets in .env files (should only be in .env.example)
      if (!envFile.includes('example') && !envFile.includes('production')) {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('=') && !line.startsWith('#')) {
            const [key, value] = line.split('=', 2);
            if (value && value.length > 10 && !value.includes('your-') && !value.includes('localhost')) {
              logWarning(`Potential real secret in ${envFile}: ${key}`);
              envIssues = true;
              hasWarnings = true;
            }
          }
        }
      }
    }
  }
  
  if (!envIssues) {
    logSuccess('Environment variable usage looks secure');
  }
  
  // 4. Check TypeScript configuration
  logInfo('\n📝 Checking TypeScript security settings...');
  
  const tsConfigFiles = ['tsconfig.json', 'apps/api/tsconfig.json', 'apps/web/tsconfig.json'];
  let tsIssues = false;
  
  for (const tsConfigFile of tsConfigFiles) {
    if (fs.existsSync(tsConfigFile)) {
      const content = fs.readFileSync(tsConfigFile, 'utf8');
      const config = JSON.parse(content);
      
      if (config.compilerOptions) {
        // Check for strict mode
        if (!config.compilerOptions.strict) {
          logWarning(`TypeScript strict mode not enabled in ${tsConfigFile}`);
          tsIssues = true;
          hasWarnings = true;
        }
        
        // Check for noImplicitAny
        if (config.compilerOptions.noImplicitAny === false) {
          logWarning(`noImplicitAny disabled in ${tsConfigFile}`);
          tsIssues = true;
          hasWarnings = true;
        }
      }
    }
  }
  
  if (!tsIssues) {
    logSuccess('TypeScript configuration is secure');
  }
  
  // 5. Check package.json for security issues
  logInfo('\n📋 Checking package.json security...');
  
  const packageFiles = ['package.json', 'apps/api/package.json', 'apps/web/package.json'];
  let packageIssues = false;
  
  for (const packageFile of packageFiles) {
    if (fs.existsSync(packageFile)) {
      const content = fs.readFileSync(packageFile, 'utf8');
      const pkg = JSON.parse(content);
      
      // Check for scripts that might be dangerous
      if (pkg.scripts) {
        for (const [scriptName, scriptContent] of Object.entries(pkg.scripts)) {
          if (typeof scriptContent === 'string') {
            if (scriptContent.includes('rm -rf') && !scriptContent.includes('node_modules')) {
              logWarning(`Potentially dangerous script in ${packageFile}: ${scriptName}`);
              packageIssues = true;
              hasWarnings = true;
            }
          }
        }
      }
    }
  }
  
  if (!packageIssues) {
    logSuccess('Package.json files look secure');
  }
  
  // 6. Check for common security misconfigurations
  logInfo('\n⚙️  Checking for security misconfigurations...');
  
  let configIssues = false;
  
  // Check main.ts for security middleware
  const mainTsPath = 'apps/api/src/main.ts';
  if (fs.existsSync(mainTsPath)) {
    const content = fs.readFileSync(mainTsPath, 'utf8');
    
    if (!content.includes('helmet') && !content.includes('security')) {
      logWarning('Security middleware (helmet) not detected in main.ts');
      configIssues = true;
      hasWarnings = true;
    }
    
    if (!content.includes('cors')) {
      logWarning('CORS configuration not detected in main.ts');
      configIssues = true;
      hasWarnings = true;
    }
    
    if (!content.includes('rateLimit') && !content.includes('throttle')) {
      logWarning('Rate limiting not detected in main.ts');
      configIssues = true;
      hasWarnings = true;
    }
  }
  
  if (!configIssues) {
    logSuccess('Security configurations look good');
  }
  
  // 7. Check for test files in production build
  logInfo('\n🧪 Checking for test files in production...');
  
  const distPath = 'apps/api/dist';
  let testFilesInProd = false;
  
  if (fs.existsSync(distPath)) {
    try {
      const testFiles = execSync(`find ${distPath} -name "*.test.js" -o -name "*.spec.js" 2>/dev/null || true`, { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
      
      if (testFiles.length > 0) {
        logWarning(`Test files found in production build: ${testFiles.length} files`);
        testFilesInProd = true;
        hasWarnings = true;
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  if (!testFilesInProd) {
    logSuccess('No test files in production build');
  }
  
  // 8. Check Docker security (if Dockerfile exists)
  logInfo('\n🐳 Checking Docker security...');
  
  const dockerfilePath = 'apps/api/Dockerfile';
  let dockerIssues = false;
  
  if (fs.existsSync(dockerfilePath)) {
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    
    if (!content.includes('USER ') || content.includes('USER root')) {
      logWarning('Dockerfile should run as non-root user');
      dockerIssues = true;
      hasWarnings = true;
    }
    
    if (content.includes('ADD ') && !content.includes('COPY ')) {
      logWarning('Use COPY instead of ADD in Dockerfile for security');
      dockerIssues = true;
      hasWarnings = true;
    }
  }
  
  if (!dockerIssues && fs.existsSync(dockerfilePath)) {
    logSuccess('Docker configuration looks secure');
  } else if (!fs.existsSync(dockerfilePath)) {
    logInfo('No Dockerfile found, skipping Docker security check');
  }
  
  // Summary
  logInfo('\n📊 Security Audit Summary:');
  
  if (hasErrors) {
    logError('❌ Security audit failed with critical issues. Please fix immediately.');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('⚠️  Security audit completed with warnings. Review and address if needed.');
    logInfo('Consider fixing warnings before production deployment.');
  } else {
    logSuccess('✅ Security audit passed! No issues detected.');
  }
}

// Run audit if called directly
if (require.main === module) {
  runSecurityAudit().catch(error => {
    logError(`Security audit failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runSecurityAudit };