// Global setup for smoke tests
console.log('🔥 Setting up smoke tests...');
console.log(`API URL: ${process.env.API_URL || 'http://localhost:3001'}`);
console.log(`Web URL: ${process.env.WEB_URL || 'http://localhost:3000'}`);

// Add any global test setup here
global.fetch = global.fetch || require('node-fetch');