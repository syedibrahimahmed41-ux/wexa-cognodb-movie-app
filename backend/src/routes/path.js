const express = require('express');
const { driver } = require('../db');

const router = express.Router();

// GET /api/path/:fromId/:toId
//
// Shortest chain of friendships connecting two users - a "six degrees"
// query. This is exactly the kind of question a relational join table
// makes awkward: you'd need a recursive CTE with an unknown, unbounded
// depth. Here it's Neo4j's built-in shortestPath() over a variable-length
// pattern.
router.get('/:fromId/:toId', async (req, res) => {
  const { fromId, toId } = req.params;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:User {id: $fromId}), (b:User {id: $toId})
       MATCH p = shortestPath((a)-[:FRIEND*..6]-(b))
       RETURN [n IN nodes(p) | {id: n.id, name: n.name}] AS people, length(p) AS hops`,
      { fromId, toId }
    );

    if (result.records.length === 0) {
      return res.json({ connected: false, people: [], hops: null });
    }

    const record = result.records[0];
    res.json({
      connected: true,
      people: record.get('people'),
      hops: record.get('hops')
    });
  } catch (err) {
    console.error('GET /path error:', err.message);
    res.status(500).json({ error: 'Could not compute the connection path.' });
  } finally {
    await session.close();
  }
});

module.exports = router;
