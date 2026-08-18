/**
 * server.js — entry point. Loads environment variables, verifies the
 * CognoDB connection, and starts the HTTP server (which also serves the
 * static frontend — see src/app.js).
 */
require('dotenv').config();

const app = require('./src/app');
const { driver, verifyConnection } = require('./src/db');

const PORT = process.env.PORT || 3000;

console.log('🎬 Starting CineGraph API...');

// Don't block the HTTP server on the database: start listening right away
// (so /api/health and the frontend are always reachable) and verify the
// CognoDB connection in the background. If it fails, routes will report a
// 503 via isConnected() until the background retry (see src/db.js) succeeds.
verifyConnection().catch(() => {});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
  console.log(`📡 API base:      http://localhost:${PORT}/api`);
  console.log(`🩺 Health check:  http://localhost:${PORT}/api/health`);
});

async function shutdown(signal) {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
  await driver.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
