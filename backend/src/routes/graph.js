const express = require('express');
const { driver } = require('../db');

const router = express.Router();

// GET /api/graph/:userId
// Returns { nodes, links } shaped for a force-directed graph: the chosen
// user, their friends, and the movies rated (by them or their friends),
// so the frontend can render the friendship + taste network directly.
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const userResult = await session.run(
      `MATCH (u:User {id: $userId}) RETURN u.id AS id, u.name AS name`,
      { userId }
    );
    if (userResult.records.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const centerUser = userResult.records[0];

    const friendsResult = await session.run(
      `MATCH (u:User {id: $userId})-[:FRIEND]-(friend:User)
       RETURN DISTINCT friend.id AS id, friend.name AS name`,
      { userId }
    );

    const ownRatingsResult = await session.run(
      `MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)
       RETURN m.id AS id, m.title AS title, r.rating AS rating`,
      { userId }
    );

    const friendRatingsResult = await session.run(
      `MATCH (u:User {id: $userId})-[:FRIEND]-(friend:User)-[r:RATED]->(m:Movie)
       WHERE r.rating >= 3
       RETURN friend.id AS friendId, m.id AS movieId, m.title AS title, r.rating AS rating
       LIMIT 40`,
      { userId }
    );

    const nodes = new Map();
    const links = [];

    nodes.set(centerUser.get('id'), {
      id: centerUser.get('id'), label: centerUser.get('name'), type: 'user', center: true
    });

    friendsResult.records.forEach(r => {
      const id = r.get('id');
      nodes.set(id, { id, label: r.get('name'), type: 'user' });
      links.push({ source: userId, target: id, type: 'FRIEND' });
    });

    ownRatingsResult.records.forEach(r => {
      const id = r.get('id');
      if (!nodes.has(id)) nodes.set(id, { id, label: r.get('title'), type: 'movie' });
      links.push({ source: userId, target: id, type: 'RATED', rating: r.get('rating') });
    });

    friendRatingsResult.records.forEach(r => {
      const movieId = r.get('movieId');
      if (!nodes.has(movieId)) nodes.set(movieId, { id: movieId, label: r.get('title'), type: 'movie' });
      links.push({ source: r.get('friendId'), target: movieId, type: 'RATED', rating: r.get('rating') });
    });

    res.json({ nodes: Array.from(nodes.values()), links });
  } catch (err) {
    console.error('GET /graph/:userId error:', err.message);
    res.status(500).json({ error: 'Could not build the graph view.' });
  } finally {
    await session.close();
  }
});

module.exports = router;
