const express = require('express');
const { driver } = require('../db');

const router = express.Router();

// GET /api/users - everyone, for the viewer switcher
router.get('/', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User)
       RETURN u.id AS id, u.name AS name, u.email AS email
       ORDER BY u.name`
    );
    res.json(result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      email: r.get('email')
    })));
  } catch (err) {
    console.error('GET /users error:', err.message);
    res.status(500).json({ error: 'Could not load users.' });
  } finally {
    await session.close();
  }
});

// GET /api/users/:userId
router.get('/:userId', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})
       RETURN u.id AS id, u.name AS name, u.email AS email`,
      { userId: req.params.userId }
    );
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const r = result.records[0];
    res.json({ id: r.get('id'), name: r.get('name'), email: r.get('email') });
  } catch (err) {
    console.error('GET /users/:userId error:', err.message);
    res.status(500).json({ error: 'Could not load this user.' });
  } finally {
    await session.close();
  }
});

// GET /api/users/:userId/friends
router.get('/:userId/friends', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:FRIEND]-(friend:User)
       RETURN DISTINCT friend.id AS id, friend.name AS name, friend.email AS email
       ORDER BY friend.name`,
      { userId: req.params.userId }
    );
    res.json(result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      email: r.get('email')
    })));
  } catch (err) {
    console.error('GET /users/:userId/friends error:', err.message);
    res.status(500).json({ error: 'Could not load friends.' });
  } finally {
    await session.close();
  }
});

// GET /api/users/:userId/ratings
router.get('/:userId/ratings', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)
       RETURN m.id AS movieId, m.title AS title, m.year AS year, m.genre AS genre,
              r.rating AS rating, r.createdAt AS ratedAt
       ORDER BY r.createdAt DESC`,
      { userId: req.params.userId }
    );
    res.json(result.records.map(r => ({
      movieId: r.get('movieId'),
      title: r.get('title'),
      year: r.get('year'),
      genre: r.get('genre'),
      rating: r.get('rating'),
      ratedAt: r.get('ratedAt') ? r.get('ratedAt').toString() : null
    })));
  } catch (err) {
    console.error('GET /users/:userId/ratings error:', err.message);
    res.status(500).json({ error: 'Could not load ratings.' });
  } finally {
    await session.close();
  }
});

module.exports = router;
