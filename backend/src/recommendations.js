const express = require('express');
const { driver } = require('../db');

const router = express.Router();

// GET /api/recommendations/friends/:userId
// "People you may know": friends-of-friends who aren't already friends.
router.get('/friends/:userId', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:FRIEND]-(:User)-[:FRIEND]-(candidate:User)
       WHERE candidate <> u AND NOT (u)-[:FRIEND]-(candidate)
       RETURN DISTINCT candidate.id AS id, candidate.name AS name, candidate.email AS email
       LIMIT 5`,
      { userId: req.params.userId }
    );
    res.json(result.records.map(r => ({
      id: r.get('id'), name: r.get('name'), email: r.get('email')
    })));
  } catch (err) {
    console.error('GET /recommendations/friends error:', err.message);
    res.status(500).json({ error: 'Could not compute friend suggestions.' });
  } finally {
    await session.close();
  }
});

// GET /api/recommendations/smart/:userId
//
// The core 2-hop traversal: movies rated highly (>=4) by people up to two
// friend-hops away, that this user hasn't rated yet, ranked by how many
// of those connections liked it and how highly. This is the kind of query
// a relational schema makes painful — it needs an unknown-depth traversal
// over a self-referential friendship table plus a NOT-IN anti-join,
// whereas here it's a single, parameterised, readable pattern match.
router.get('/smart/:userId', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:FRIEND*1..2]-(connected:User)-[r:RATED]->(movie:Movie)
       WHERE connected <> u
         AND r.rating >= 4
         AND NOT EXISTS { MATCH (u)-[:RATED]->(movie) }
       RETURN movie.id AS id, movie.title AS title, movie.year AS year, movie.genre AS genre,
              COUNT(DISTINCT connected) AS connections,
              AVG(r.rating) AS averageRating,
              COLLECT(DISTINCT connected.name)[0..3] AS sampleFriends
       ORDER BY connections DESC, averageRating DESC
       LIMIT 10`,
      { userId: req.params.userId }
    );
    res.json(result.records.map(r => ({
      id: r.get('id'),
      title: r.get('title'),
      year: r.get('year'),
      genre: r.get('genre'),
      connections: r.get('connections'),
      averageRating: Math.round(r.get('averageRating') * 10) / 10,
      sampleFriends: r.get('sampleFriends')
    })));
  } catch (err) {
    console.error('GET /recommendations/smart error:', err.message);
    res.status(500).json({ error: 'Could not compute recommendations.' });
  } finally {
    await session.close();
  }
});

module.exports = router;
