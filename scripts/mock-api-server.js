#!/usr/bin/env node

/**
 * Mock API Server for Test Mode
 * Simple Express server with mock endpoints
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Mock data
const mockSubjects = [
  {
    id: 1,
    name: 'Software Project Management',
    code: '960200',
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Database Systems',
    code: '960300',
    color: '#10B981',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Web Development',
    code: '960400',
    color: '#F59E0B',
    createdAt: new Date().toISOString(),
  },
];

const mockSections = [
  {
    id: 1,
    subjectId: 1,
    sectionCode: '001',
    days: ['MO', 'WE'],
    startTime: '09:00',
    endTime: '10:30',
    room: 'Room 301',
    startDate: '2024-01-15',
    endDate: '2024-05-15',
    skipDates: ['2024-04-13', '2024-04-15'],
  },
  {
    id: 2,
    subjectId: 2,
    sectionCode: '002',
    days: ['TU', 'TH'],
    startTime: '13:00',
    endTime: '14:30',
    room: 'Lab 201',
    startDate: '2024-01-15',
    endDate: '2024-05-15',
    skipDates: [],
  },
];

const mockEvents = [
  {
    id: 1,
    subjectId: 1,
    sectionId: 1,
    title: 'Software Project Management',
    startTime: '2024-01-15T09:00:00+07:00',
    endTime: '2024-01-15T10:30:00+07:00',
    location: 'Room 301',
    isRecurring: true,
  },
  {
    id: 2,
    subjectId: 2,
    sectionId: 2,
    title: 'Database Systems',
    startTime: '2024-01-16T13:00:00+07:00',
    endTime: '2024-01-16T14:30:00+07:00',
    location: 'Lab 201',
    isRecurring: true,
  },
];

const mockUser = {
  id: 'mock-user-123',
  email: 'test.user@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
};

// Health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'test',
    uptime: process.uptime(),
    checks: {
      database: { status: 'healthy', responseTime: 50 },
      redis: { status: 'healthy', responseTime: 25 },
      memory: { status: 'healthy', details: { heapUsedMB: 128, rssMB: 256 } },
    },
  });
});

app.get('/health/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

// Test mode endpoints
app.get('/test-mode/status', (req, res) => {
  res.json({
    testMode: true,
    environment: 'test',
    mockServices: {
      googleApi: true,
      redis: true,
      database: true,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/test-mode/sample-data', (req, res) => {
  const type = req.query.type;
  const sampleData = {
    subjects: mockSubjects,
    sections: mockSections,
    events: mockEvents,
  };

  if (type && sampleData[type]) {
    res.json({ data: sampleData[type] });
  } else {
    res.json({ data: sampleData });
  }
});

app.post('/test-mode/mock-auth', (req, res) => {
  const { email, name } = req.body;
  
  const user = {
    ...mockUser,
    email: email || mockUser.email,
    name: name || mockUser.name,
    accessToken: 'mock-access-token-' + Date.now(),
    refreshToken: 'mock-refresh-token-' + Date.now(),
  };

  res.json({
    success: true,
    user,
    message: 'Mock authentication successful',
  });
});

app.post('/test-mode/reset-data', (req, res) => {
  res.json({
    success: true,
    message: 'Test data has been reset',
    timestamp: new Date().toISOString(),
  });
});

app.get('/test-mode/google-calendar-mock', (req, res) => {
  res.json({
    mockEnabled: true,
    mockCalendars: [
      {
        id: 'primary',
        summary: 'Test Calendar',
        primary: true,
      },
      {
        id: 'mock-calendar-2',
        summary: 'Secondary Test Calendar',
        primary: false,
      },
    ],
    mockEvents: [
      {
        id: 'mock-event-1',
        summary: 'Software Project Management',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
        location: 'Room 301',
      },
    ],
  });
});

// Auth endpoints
app.get('/auth/google', (req, res) => {
  res.redirect('http://localhost:3000/auth/callback?code=mock-auth-code&state=test');
});

app.get('/auth/google/callback', (req, res) => {
  res.json({
    success: true,
    user: mockUser,
    accessToken: 'mock-access-token-' + Date.now(),
    refreshToken: 'mock-refresh-token-' + Date.now(),
  });
});

app.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/auth/me', (req, res) => {
  res.json({ user: mockUser });
});

// API endpoints
app.get('/api/subjects', (req, res) => {
  res.json(mockSubjects);
});

app.post('/api/subjects', (req, res) => {
  const newSubject = {
    id: mockSubjects.length + 1,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  mockSubjects.push(newSubject);
  res.status(201).json(newSubject);
});

app.post('/api/subjects/quick-add', (req, res) => {
  const {
    subjectName,
    subjectCode,
    sectionCode,
    days,
    startTime,
    endTime,
    room,
    startDate,
    endDate,
    skipDates = [],
  } = req.body;

  // Create subject
  const subject = {
    id: mockSubjects.length + 1,
    name: subjectName,
    code: subjectCode,
    color: '#' + Math.floor(Math.random()*16777215).toString(16),
    createdAt: new Date().toISOString(),
  };
  mockSubjects.push(subject);

  // Create section
  const section = {
    id: mockSections.length + 1,
    subjectId: subject.id,
    sectionCode,
    days,
    startTime,
    endTime,
    room,
    startDate,
    endDate,
    skipDates,
  };
  mockSections.push(section);

  res.status(201).json({
    success: true,
    subject,
    section,
    eventsGenerated: 24, // Mock number
    message: 'Class added successfully',
  });
});

app.get('/api/sections', (req, res) => {
  res.json(mockSections);
});

app.get('/api/events', (req, res) => {
  res.json(mockEvents);
});

app.post('/api/sync/google', (req, res) => {
  const { direction, range } = req.body;
  
  res.json({
    success: true,
    syncId: 'mock-sync-' + Date.now(),
    direction,
    range,
    eventsProcessed: mockEvents.length,
    eventsCreated: mockEvents.length,
    eventsUpdated: 0,
    eventsDeleted: 0,
    message: 'Sync completed successfully',
  });
});

app.get('/api/sync/status', (req, res) => {
  res.json({
    lastSync: new Date().toISOString(),
    status: 'completed',
    eventsProcessed: mockEvents.length,
  });
});

app.post('/api/spotlight/search', (req, res) => {
  const { text } = req.body;
  const results = mockSubjects.filter(subject => 
    subject.name.toLowerCase().includes(text.toLowerCase()) ||
    (subject.code && subject.code.toLowerCase().includes(text.toLowerCase()))
  );
  
  res.json({
    results,
    query: text,
    total: results.length,
  });
});

app.post('/api/import/upload', (req, res) => {
  res.json({
    success: true,
    jobId: 'mock-import-' + Date.now(),
    message: 'File uploaded successfully',
    preview: {
      subjects: 2,
      sections: 3,
      estimatedEvents: 48,
    },
  });
});

// Catch all for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
    },
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      details: error.message,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🧪 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📊 Test endpoints:`);
  console.log(`   • http://localhost:${PORT}/health`);
  console.log(`   • http://localhost:${PORT}/test-mode/status`);
  console.log(`   • http://localhost:${PORT}/test-mode/sample-data`);
  console.log(`   • http://localhost:${PORT}/api/subjects`);
});

module.exports = app;