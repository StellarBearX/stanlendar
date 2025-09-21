// Global setup for acceptance tests
console.log('🎯 Setting up acceptance tests...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`API URL: ${process.env.API_URL || 'http://localhost:3001'}`);
console.log(`Web URL: ${process.env.WEB_URL || 'http://localhost:3000'}`);

// Add fetch polyfill for Node.js
global.fetch = global.fetch || require('node-fetch');

// Set longer timeout for acceptance tests
jest.setTimeout(60000);