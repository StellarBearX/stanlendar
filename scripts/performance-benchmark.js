#!/usr/bin/env node

/**
 * Performance Benchmark Script
 * Tests application performance against defined benchmarks
 */

const https = require('https');
const { performance } = require('perf_hooks');

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

// Performance benchmarks
const BENCHMARKS = {
  healthCheck: { maxTime: 1000, description: 'Health check response time' },
  apiResponse: { maxTime: 2000, description: 'API response time' },
  frontendLoad: { maxTime: 3000, description: 'Frontend initial load time' },
  concurrentRequests: { maxTime: 5000, description: 'Concurrent requests handling' },
  databaseQuery: { maxTime: 1000, description: 'Database query response time' },
  redisQuery: { maxTime: 500, description: 'Redis query response time' },
};

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    const request = https.get(url, { timeout: 10000, ...options }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data: data,
          duration: Math.round(duration),
        });
      });
    });
    
    request.on('error', (error) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      reject({
        error: error.message,
        duration: Math.round(duration),
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      reject({
        error: 'Request timeout',
        duration: Math.round(duration),
      });
    });
  });
}

async function testHealthCheckPerformance() {
  logInfo('🏥 Testing health check performance...');
  
  try {
    const result = await makeRequest(`${API_URL}/health`);
    
    if (result.statusCode === 200) {
      if (result.duration <= BENCHMARKS.healthCheck.maxTime) {
        logSuccess(`Health check: ${result.duration}ms (target: <${BENCHMARKS.healthCheck.maxTime}ms)`);
        return true;
      } else {
        logWarning(`Health check: ${result.duration}ms (target: <${BENCHMARKS.healthCheck.maxTime}ms)`);
        return false;
      }
    } else {
      logError(`Health check failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.error || error.message}`);
    return false;
  }
}

async function testApiResponseTime() {
  logInfo('🔌 Testing API response time...');
  
  try {
    const result = await makeRequest(`${API_URL}/health`);
    
    if (result.statusCode === 200) {
      if (result.duration <= BENCHMARKS.apiResponse.maxTime) {
        logSuccess(`API response: ${result.duration}ms (target: <${BENCHMARKS.apiResponse.maxTime}ms)`);
        return true;
      } else {
        logWarning(`API response: ${result.duration}ms (target: <${BENCHMARKS.apiResponse.maxTime}ms)`);
        return false;
      }
    } else {
      logError(`API request failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`API request failed: ${error.error || error.message}`);
    return false;
  }
}

async function testFrontendLoadTime() {
  logInfo('🌐 Testing frontend load time...');
  
  try {
    const result = await makeRequest(WEB_URL);
    
    if ([200, 302].includes(result.statusCode)) {
      if (result.duration <= BENCHMARKS.frontendLoad.maxTime) {
        logSuccess(`Frontend load: ${result.duration}ms (target: <${BENCHMARKS.frontendLoad.maxTime}ms)`);
        return true;
      } else {
        logWarning(`Frontend load: ${result.duration}ms (target: <${BENCHMARKS.frontendLoad.maxTime}ms)`);
        return false;
      }
    } else {
      logError(`Frontend request failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Frontend request failed: ${error.error || error.message}`);
    return false;
  }
}

async function testConcurrentRequests() {
  logInfo('🚀 Testing concurrent request handling...');
  
  const concurrentCount = 10;
  const startTime = performance.now();
  
  try {
    const requests = Array(concurrentCount).fill(null).map(() => 
      makeRequest(`${API_URL}/health`)
    );
    
    const results = await Promise.all(requests);
    const endTime = performance.now();
    const totalDuration = Math.round(endTime - startTime);
    
    const successCount = results.filter(r => r.statusCode === 200).length;
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);
    
    if (successCount === concurrentCount && totalDuration <= BENCHMARKS.concurrentRequests.maxTime) {
      logSuccess(`Concurrent requests: ${totalDuration}ms total, ${avgDuration}ms avg (target: <${BENCHMARKS.concurrentRequests.maxTime}ms)`);
      return true;
    } else if (successCount < concurrentCount) {
      logError(`Concurrent requests: ${successCount}/${concurrentCount} succeeded`);
      return false;
    } else {
      logWarning(`Concurrent requests: ${totalDuration}ms total (target: <${BENCHMARKS.concurrentRequests.maxTime}ms)`);
      return false;
    }
  } catch (error) {
    logError(`Concurrent requests failed: ${error.error || error.message}`);
    return false;
  }
}

async function testDatabasePerformance() {
  logInfo('🗄️  Testing database performance...');
  
  try {
    const result = await makeRequest(`${API_URL}/health`);
    
    if (result.statusCode === 200) {
      const health = JSON.parse(result.data);
      const dbResponseTime = health.checks?.database?.responseTime;
      
      if (dbResponseTime && dbResponseTime <= BENCHMARKS.databaseQuery.maxTime) {
        logSuccess(`Database query: ${dbResponseTime}ms (target: <${BENCHMARKS.databaseQuery.maxTime}ms)`);
        return true;
      } else if (dbResponseTime) {
        logWarning(`Database query: ${dbResponseTime}ms (target: <${BENCHMARKS.databaseQuery.maxTime}ms)`);
        return false;
      } else {
        logWarning('Database response time not available in health check');
        return false;
      }
    } else {
      logError(`Health check failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Database performance test failed: ${error.error || error.message}`);
    return false;
  }
}

async function testRedisPerformance() {
  logInfo('🔴 Testing Redis performance...');
  
  try {
    const result = await makeRequest(`${API_URL}/health`);
    
    if (result.statusCode === 200) {
      const health = JSON.parse(result.data);
      const redisResponseTime = health.checks?.redis?.responseTime;
      
      if (redisResponseTime && redisResponseTime <= BENCHMARKS.redisQuery.maxTime) {
        logSuccess(`Redis query: ${redisResponseTime}ms (target: <${BENCHMARKS.redisQuery.maxTime}ms)`);
        return true;
      } else if (redisResponseTime) {
        logWarning(`Redis query: ${redisResponseTime}ms (target: <${BENCHMARKS.redisQuery.maxTime}ms)`);
        return false;
      } else {
        logWarning('Redis response time not available in health check');
        return false;
      }
    } else {
      logError(`Health check failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Redis performance test failed: ${error.error || error.message}`);
    return false;
  }
}

async function testMemoryUsage() {
  logInfo('💾 Testing memory usage...');
  
  try {
    const result = await makeRequest(`${API_URL}/health`);
    
    if (result.statusCode === 200) {
      const health = JSON.parse(result.data);
      const memoryDetails = health.checks?.memory?.details;
      
      if (memoryDetails) {
        const heapUsedMB = memoryDetails.heapUsedMB;
        const rssMB = memoryDetails.rssMB;
        
        // Thresholds: 512MB heap, 1GB RSS
        if (heapUsedMB <= 512 && rssMB <= 1024) {
          logSuccess(`Memory usage: ${heapUsedMB}MB heap, ${rssMB}MB RSS (within limits)`);
          return true;
        } else {
          logWarning(`Memory usage: ${heapUsedMB}MB heap, ${rssMB}MB RSS (high usage)`);
          return false;
        }
      } else {
        logWarning('Memory usage details not available in health check');
        return false;
      }
    } else {
      logError(`Health check failed with status ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Memory usage test failed: ${error.error || error.message}`);
    return false;
  }
}

async function runPerformanceBenchmark() {
  logInfo('⚡ Starting performance benchmark...\n');
  logInfo(`Testing against:`);
  logInfo(`  API: ${API_URL}`);
  logInfo(`  Web: ${WEB_URL}\n`);
  
  const tests = [
    { name: 'Health Check Performance', test: testHealthCheckPerformance },
    { name: 'API Response Time', test: testApiResponseTime },
    { name: 'Frontend Load Time', test: testFrontendLoadTime },
    { name: 'Concurrent Requests', test: testConcurrentRequests },
    { name: 'Database Performance', test: testDatabasePerformance },
    { name: 'Redis Performance', test: testRedisPerformance },
    { name: 'Memory Usage', test: testMemoryUsage },
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    try {
      const passed = await test();
      results.push({ name, passed });
    } catch (error) {
      logError(`${name} test failed: ${error.message}`);
      results.push({ name, passed: false });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  logInfo('\n📊 Performance Benchmark Summary:');
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach(({ name, passed }) => {
    if (passed) {
      logSuccess(`${name}: PASSED`);
    } else {
      logWarning(`${name}: FAILED`);
    }
  });
  
  logInfo(`\nOverall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logSuccess('🎉 All performance benchmarks passed!');
    return true;
  } else if (passedTests >= totalTests * 0.8) {
    logWarning('⚠️  Most performance benchmarks passed, but some need attention.');
    return false;
  } else {
    logError('❌ Performance benchmarks failed. Significant issues detected.');
    return false;
  }
}

// Run benchmark if called directly
if (require.main === module) {
  runPerformanceBenchmark()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Performance benchmark failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runPerformanceBenchmark };