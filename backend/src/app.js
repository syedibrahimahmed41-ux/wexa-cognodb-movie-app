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

// Health check always answers, even if the DB is down, so the frontend
// can poll it to show a "database unreachable" banner.
app.get('/api/health', (req, res) => {
  const ok = isConnected();
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'unavailable',
    database: 'CognoDB',
    timestamp: new Date().toISOString()
  });
});

// Every other /api route fails fast with a friendly message if we already
// know CognoDB is unreachable, instead of letting each query hang/timeout.
app.use('/api', (req, res, next) => {
  if (!isConnected()) {
    return res.status(503).json({
      error: 'The database is temporarily unreachable. Please try again shortly.'
    });
  }
  next();
});

app.use('/api/users', usersRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/graph', graphRouter);
app.use('/api/path', pathRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Serve the static frontend (index.html, css, js) from the sibling folder.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Centralized error handler for anything a route forwards via next(err).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

module.exports = app;
