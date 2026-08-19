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

/* =========================
   API HEALTH
========================= */

app.get('/api/health', (req, res) => {
  const ok = isConnected();

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'unavailable',
    database: 'CognoDB',
    timestamp: new Date().toISOString()
  });
});

/* =========================
   API DATABASE CHECK
========================= */

app.use('/api', (req, res, next) => {
  if (!isConnected()) {
    return res.status(503).json({
      error:
        'The database is temporarily unreachable. Please try again shortly.'
    });
  }

  next();
});

/* =========================
   API ROUTES
========================= */

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

/* =========================
   FRONTEND
========================= */

// backend/src/app.js
// frontend is two levels above this file

const frontendPath = path.resolve(__dirname, '../../frontend');

console.log('=================================');
console.log('Frontend path:', frontendPath);
console.log('=================================');

// Serve CSS, JavaScript, images, etc.
app.use(
  express.static(frontendPath, {
    index: 'index.html'
  })
);

// Explicitly serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Explicit CSS route
app.get('/css/style.css', (req, res) => {
  res.sendFile(path.join(frontendPath, 'css', 'style.css'));
});

// Explicit JavaScript route
app.get('/js/app.js', (req, res) => {
  res.sendFile(path.join(frontendPath, 'js', 'app.js'));
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Something went wrong on our end.'
  });
});

module.exports = app;
