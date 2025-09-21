#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

/**
 * Comprehensive test runner for the Class Schedule Sync application
 * Runs unit tests, integration tests, E2E tests, and performance tests
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, colors.cyan)
  log(`${title}`, colors.cyan + colors.bright)
  log(`${'='.repeat(60)}`, colors.cyan)
}

function logStep(step) {
  log(`\n→ ${step}`, colors.blue)
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green)
}

function logError(message) {
  log(`✗ ${message}`, colors.red)
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow)
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites')
  
  const checks = [
    { command: 'node', args: ['--version'], name: 'Node.js' },
    { command: 'npm', args: ['--version'], name: 'npm' },
    { command: 'docker', args: ['--version'], name: 'Docker' },
  ]

  for (const check of checks) {
    try {
      await runCommand(check.command, check.args, { stdio: 'pipe' })
      logSuccess(`${check.name} is available`)
    } catch (error) {
      logError(`${check.name} is not available`)
      throw error
    }
  }
}

async function setupTestEnvironment() {
  logSection('Setting Up Test Environment')
  
  logStep('Starting test database')
  try {
    await runCommand('docker', ['run', '-d', '--name', 'test-postgres', 
      '-e', 'POSTGRES_PASSWORD=test', 
      '-e', 'POSTGRES_DB=test', 
      '-p', '5433:5432', 
      'postgres:15'])
    logSuccess('Test database started')
  } catch (error) {
    logWarning('Test database might already be running')
  }

  logStep('Starting test Redis')
  try {
    await runCommand('docker', ['run', '-d', '--name', 'test-redis', 
      '-p', '6380:6379', 
      'redis:7'])
    logSuccess('Test Redis started')
  } catch (error) {
    logWarning('Test Redis might already be running')
  }

  // Wait for services to be ready
  logStep('Waiting for services to be ready')
  await new Promise(resolve => setTimeout(resolve, 5000))
}

async function runUnitTests() {
  logSection('Running Unit Tests')
  
  logStep('Running API unit tests')
  await runCommand('npm', ['run', 'test'], { cwd: 'apps/api' })
  logSuccess('API unit tests passed')
  
  logStep('Running Web unit tests')
  await runCommand('npm', ['run', 'test', '--', '--run'], { cwd: 'apps/web' })
  logSuccess('Web unit tests passed')
}

async function runIntegrationTests() {
  logSection('Running Integration Tests')
  
  logStep('Running API integration tests')
  await runCommand('npm', ['run', 'test:e2e'], { cwd: 'apps/api' })
  logSuccess('API integration tests passed')
}

async function runE2ETests() {
  logSection('Running End-to-End Tests')
  
  logStep('Building applications')
  await runCommand('npm', ['run', 'build'], { cwd: 'apps/api' })
  await runCommand('npm', ['run', 'build'], { cwd: 'apps/web' })
  
  logStep('Starting applications')
  const apiProcess = spawn('npm', ['run', 'start:prod'], { 
    cwd: 'apps/api',
    detached: true,
    stdio: 'pipe'
  })
  
  const webProcess = spawn('npm', ['run', 'start'], { 
    cwd: 'apps/web',
    detached: true,
    stdio: 'pipe'
  })
  
  // Wait for applications to start
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  try {
    logStep('Running Playwright tests')
    await runCommand('npm', ['run', 'test:e2e'], { cwd: 'apps/web' })
    logSuccess('E2E tests passed')
  } finally {
    logStep('Stopping applications')
    process.kill(-apiProcess.pid)
    process.kill(-webProcess.pid)
  }
}

async function runPerformanceTests() {
  logSection('Running Performance Tests')
  
  logStep('Running API performance tests')
  await runCommand('npm', ['run', 'test', '--', '--testNamePattern="Performance"'], { cwd: 'apps/api' })
  logSuccess('Performance tests passed')
}

async function generateCoverageReport() {
  logSection('Generating Coverage Report')
  
  logStep('Generating API coverage')
  await runCommand('npm', ['run', 'test:cov'], { cwd: 'apps/api' })
  
  logStep('Generating Web coverage')
  await runCommand('npm', ['run', 'test:coverage'], { cwd: 'apps/web' })
  
  logSuccess('Coverage reports generated')
}

async function cleanupTestEnvironment() {
  logSection('Cleaning Up Test Environment')
  
  logStep('Stopping test containers')
  try {
    await runCommand('docker', ['stop', 'test-postgres', 'test-redis'])
    await runCommand('docker', ['rm', 'test-postgres', 'test-redis'])
    logSuccess('Test containers cleaned up')
  } catch (error) {
    logWarning('Some containers might not exist')
  }
}

async function generateTestReport() {
  logSection('Generating Test Report')
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      coverage: {
        api: null,
        web: null,
      },
    },
    suites: [],
  }

  // Read coverage reports if they exist
  try {
    const apiCoverage = JSON.parse(fs.readFileSync('apps/api/coverage/coverage-summary.json', 'utf8'))
    report.summary.coverage.api = apiCoverage.total
  } catch (error) {
    logWarning('API coverage report not found')
  }

  try {
    const webCoverage = JSON.parse(fs.readFileSync('apps/web/coverage/coverage-summary.json', 'utf8'))
    report.summary.coverage.web = webCoverage.total
  } catch (error) {
    logWarning('Web coverage report not found')
  }

  // Write test report
  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2))
  logSuccess('Test report generated: test-report.json')
}

async function main() {
  const args = process.argv.slice(2)
  const suites = args.length > 0 ? args : ['unit', 'integration', 'e2e', 'performance']
  
  log(`\n${colors.bright}Class Schedule Sync - Test Runner${colors.reset}`)
  log(`Running test suites: ${suites.join(', ')}`)
  
  try {
    await checkPrerequisites()
    await setupTestEnvironment()
    
    if (suites.includes('unit')) {
      await runUnitTests()
    }
    
    if (suites.includes('integration')) {
      await runIntegrationTests()
    }
    
    if (suites.includes('e2e')) {
      await runE2ETests()
    }
    
    if (suites.includes('performance')) {
      await runPerformanceTests()
    }
    
    await generateCoverageReport()
    await generateTestReport()
    
    logSection('Test Run Complete')
    logSuccess('All tests passed successfully!')
    
  } catch (error) {
    logSection('Test Run Failed')
    logError(`Error: ${error.message}`)
    process.exit(1)
  } finally {
    await cleanupTestEnvironment()
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\nReceived SIGINT, cleaning up...', colors.yellow)
  await cleanupTestEnvironment()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  log('\nReceived SIGTERM, cleaning up...', colors.yellow)
  await cleanupTestEnvironment()
  process.exit(0)
})

if (require.main === module) {
  main()
}

module.exports = {
  runUnitTests,
  runIntegrationTests,
  runE2ETests,
  runPerformanceTests,
  generateCoverageReport,
}