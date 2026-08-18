/**
 * db.js — owns the single CognoDB driver instance for the app and tracks
 * whether the database is currently reachable, so routes can fail fast
 * with a friendly message instead of hanging on a dead connection.
 */
const neo4j = require('neo4j-driver');

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error(
    '❌ Missing CognoDB connection details.\n' +
    '   Copy backend/.env.example to backend/.env and fill in NEO4J_URI, ' +
    'NEO4J_USER and NEO4J_PASSWORD from your CognoDB Cloud instance.'
  );
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  {
    // Return plain JS numbers instead of Neo4j's lossless Integer objects.
    // Safe here since none of our values (ids are strings, ratings/years
    // are small numbers) can lose precision.
    disableLosslessIntegers: true
  }
);

let connected = false;

async function verifyConnection() {
  try {
    await driver.verifyConnectivity();
    if (!connected) console.log('✅ Connected to CognoDB');
    connected = true;
  } catch (err) {
    if (connected) console.error('❌ Lost connection to CognoDB:', err.message);
    else console.error('❌ Could not reach CognoDB:', err.message);
    connected = false;
  }
  return connected;
}

function isConnected() {
  return connected;
}

// Re-check connectivity in the background so the API recovers on its own
// if CognoDB comes back after a blip, without needing a restart.
setInterval(() => {
  verifyConnection().catch(() => {});
}, 30000);

module.exports = { driver, verifyConnection, isConnected };
