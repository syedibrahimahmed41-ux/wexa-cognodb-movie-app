const path = require('path');
const express = require('express');
const cors = require('cors');

const { isConnected } = require('./db');
const usersRouter = require('./routes/users');
const moviesRouter = require('./routes/movies');
const recommendationsRouter = require('./routes/recommendations');
const graphRouter = require('./routes/graph');
const pathRouter = require('./routes/path');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  const ok = isConnected();

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'unavailable',
    database: 'CognoDB',
    timestamp: new Date().toISOString()
  });
});

// Database protection
app.use('/api', (req, res, next) => {
  if (!isConnected()) {
    return res.status(503).json({
      error: 'The database is temporarily unreachable. Please try again shortly.'
    });
  }

  next();
});

// API routes
app.use('/api/users', usersRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/graph', graphRouter);
app.use('/api/path', pathRouter);

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not found.'
  });
});

// --------------------------------------------------
// FRONTEND
// --------------------------------------------------

const frontendPath = path.resolve(__dirname, '../../frontend');

console.log('=================================');
console.log('Frontend directory:', frontendPath);
console.log('=================================');

app.use(express.static(frontendPath));

// Send index.html for the main website
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Something went wrong on our end.'
  });
});

module.exports = app;
