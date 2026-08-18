/**
 * seed.js — populates CognoDB with a small, realistic dataset for the
 * CineGraph demo: 5 users, a friendship network (with a couple of extra
 * cross-links so multi-hop queries have something interesting to find),
 * 10 movies, and ratings.
 *
 * Run with: npm run seed   (from the backend/ folder)
 */
require('dotenv').config();
const neo4j = require('neo4j-driver');

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error(
    '❌ Missing NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD.\n' +
    '   Copy backend/.env.example to backend/.env and fill it in first.'
  );
  process.exit(1);
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { disableLosslessIntegers: true }
);

const users = [
  { id: 'u1', name: 'Alice Chen', email: 'alice@example.com' },
  { id: 'u2', name: 'Bob Martinez', email: 'bob@example.com' },
  { id: 'u3', name: 'Charlie Okafor', email: 'charlie@example.com' },
  { id: 'u4', name: 'Diana Kowalski', email: 'diana@example.com' },
  { id: 'u5', name: 'Eve Thompson', email: 'eve@example.com' }
];

// Stored as one directed edge per pair; every route queries FRIEND
// relationships without a direction, so friendship behaves as mutual.
const friendships = [
  ['u1', 'u2'],
  ['u2', 'u3'],
  ['u3', 'u4'],
  ['u4', 'u5'],
  ['u1', 'u3'],
  ['u2', 'u5']
];

const movies = [
  { id: 'm1', title: 'Inception', year: 2010, genre: 'Sci-Fi' },
  { id: 'm2', title: 'Interstellar', year: 2014, genre: 'Sci-Fi' },
  { id: 'm3', title: 'The Dark Knight', year: 2008, genre: 'Action' },
  { id: 'm4', title: 'The Matrix', year: 1999, genre: 'Sci-Fi' },
  { id: 'm5', title: 'Pulp Fiction', year: 1994, genre: 'Crime' },
  { id: 'm6', title: 'The Godfather', year: 1972, genre: 'Drama' },
  { id: 'm7', title: 'The Shawshank Redemption', year: 1994, genre: 'Drama' },
  { id: 'm8', title: 'Fight Club', year: 1999, genre: 'Drama' },
  { id: 'm9', title: 'Whiplash', year: 2014, genre: 'Drama' },
  { id: 'm10', title: 'The Prestige', year: 2006, genre: 'Mystery' }
];

// [userId, movieId, rating]
const ratings = [
  ['u1', 'm1', 5], ['u1', 'm4', 4], ['u1', 'm10', 5],
  ['u2', 'm3', 5], ['u2', 'm5', 4], ['u2', 'm9', 4],
  ['u3', 'm2', 5], ['u3', 'm6', 4], ['u3', 'm7', 4],
  ['u4', 'm2', 5], ['u4', 'm3', 4], ['u4', 'm8', 3],
  ['u5', 'm7', 5], ['u5', 'm6', 4], ['u5', 'm1', 4]
];

async function seed() {
  const session = driver.session();

  try {
    await driver.verifyConnectivity();
    console.log('✅ Connected to CognoDB\n');

    console.log('🗑️  Clearing existing data...');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('👥 Creating users...');
    for (const u of users) {
      await session.run('CREATE (:User {id: $id, name: $name, email: $email})', u);
    }

    console.log('🤝 Creating friendships...');
    for (const [a, b] of friendships) {
      await session.run(
        `MATCH (a:User {id: $a}), (b:User {id: $b})
         MERGE (a)-[:FRIEND]->(b)`,
        { a, b }
      );
    }

    console.log('🎬 Creating movies...');
    for (const m of movies) {
      await session.run('CREATE (:Movie {id: $id, title: $title, year: $year, genre: $genre})', m);
    }

    console.log('⭐ Creating ratings...');
    for (const [userId, movieId, rating] of ratings) {
      await session.run(
        `MATCH (u:User {id: $userId}), (m:Movie {id: $movieId})
         MERGE (u)-[:RATED {rating: $rating, createdAt: datetime()}]->(m)`,
        { userId, movieId, rating }
      );
    }

    console.log('\n🔍 Sanity-checking the 2-hop recommendation query for Alice (u1)...');
    const test = await session.run(
      `MATCH (u:User {id: 'u1'})-[:FRIEND*1..2]-(connected:User)-[r:RATED]->(movie:Movie)
       WHERE connected <> u AND r.rating >= 4
         AND NOT EXISTS { MATCH (u)-[:RATED]->(movie) }
       RETURN movie.title AS title, COUNT(DISTINCT connected) AS connections, AVG(r.rating) AS avgRating
       ORDER BY connections DESC, avgRating DESC
       LIMIT 5`
    );
    if (test.records.length === 0) {
      console.log('   (no recommendations found — check the data above)');
    } else {
      test.records.forEach(r => {
        console.log(`   - ${r.get('title')} (${r.get('connections')} connections, avg ${r.get('avgRating').toFixed(2)})`);
      });
    }

    const counts = await session.run(`
      MATCH (u:User) WITH count(u) AS users
      MATCH (m:Movie) WITH users, count(m) AS movies
      MATCH ()-[r:RATED]->() WITH users, movies, count(r) AS ratings
      MATCH ()-[f:FRIEND]-()
      RETURN users, movies, ratings, count(f) / 2 AS friendships
    `);
    const row = counts.records[0];
    console.log('\n📊 Seed summary:');
    console.log(`   Users:       ${row.get('users')}`);
    console.log(`   Movies:      ${row.get('movies')}`);
    console.log(`   Friendships: ${row.get('friendships')}`);
    console.log(`   Ratings:     ${row.get('ratings')}`);

    console.log('\n✅ Done. Start the API with: npm start');
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await driver.close();
  }
}

seed();
