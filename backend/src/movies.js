const express = require('express');
const { driver } = require('../db');

const router = express.Router();

// GET /api/movies - browse everything
router.get('/', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (m:Movie)
       RETURN m.id AS id, m.title AS title, m.year AS year, m.genre AS genre
       ORDER BY m.title
       LIMIT 24
SKIP $skip`
    );
    res.json(result.records.map(r => ({
      id: r.get('id'), title: r.get('title'), year: r.get('year'), genre: r.get('genre')
    })));
  } catch (err) {
    console.error('GET /movies error:', err.message);
    res.status(500).json({ error: 'Could not load movies.' });
  } finally {
    await session.close();
  }
});

// GET /api/movies/search?q=matrix
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) return res.json({
    movies: [],
    page: 1,
    limit: 24,
    hasNext: false
  });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 24;
  const skip = (page - 1) * limit;

  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (m:Movie)
       WHERE toLower(m.title) CONTAINS toLower($q)
       RETURN m.id AS id,
              m.title AS title,
              m.year AS year,
              m.genre AS genre
       ORDER BY m.title
       SKIP $skip
       LIMIT $limit`,
      {
        q,
        skip,
        limit
      }
    );

    const movies = result.records.map(r => ({
      id: r.get('id'),
      title: r.get('title'),
      year: r.get('year'),
      genre: r.get('genre')
    }));

    res.json({
      movies,
      page,
      limit,
      hasNext: movies.length === limit
    });

  } catch (err) {
    console.error('GET /movies/search error:', err.message);
    res.status(500).json({ error: 'Search failed.' });
  } finally {
    await session.close();
  }
});

// GET /api/movies/:movieId/ratings - who rated it, in what order
router.get('/:movieId/ratings', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User)-[r:RATED]->(m:Movie {id: $movieId})
       RETURN u.id AS userId, u.name AS userName, r.rating AS rating, r.createdAt AS ratedAt
       ORDER BY r.rating DESC`,
      { movieId: req.params.movieId }
    );
    res.json(result.records.map(r => ({
      userId: r.get('userId'),
      userName: r.get('userName'),
      rating: r.get('rating'),
      ratedAt: r.get('ratedAt') ? r.get('ratedAt').toString() : null
    })));
  } catch (err) {
    console.error('GET /movies/:movieId/ratings error:', err.message);
    res.status(500).json({ error: 'Could not load ratings for this movie.' });
  } finally {
    await session.close();
  }
});

module.exports = router;
