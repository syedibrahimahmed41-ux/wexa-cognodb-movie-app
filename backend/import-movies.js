require('dotenv').config();

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const neo4j = require('neo4j-driver');

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error('Missing NEO4J_URI, NEO4J_USER or NEO4J_PASSWORD');
  process.exit(1);
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { disableLosslessIntegers: true }
);

const DATA_FILE = './data/title.basics.tsv.gz';

// Change this number if you want more movies.
const MAX_MOVIES = 10000;

// Movies are inserted in batches instead of one at a time.
const BATCH_SIZE = 500;

async function importMovies() {
  const session = driver.session();

  try {
    await driver.verifyConnectivity();

    console.log('✅ Connected to CognoDB');
    console.log(`🎬 Importing up to ${MAX_MOVIES} real movies...\n`);

    // Make sure Movie IDs are indexed.
    await session.run(`
      CREATE INDEX movie_id_index IF NOT EXISTS
      FOR (m:Movie)
      ON (m.id)
    `);

    const fileStream = fs.createReadStream(DATA_FILE);
    const gunzip = zlib.createGunzip();

    const rl = readline.createInterface({
      input: fileStream.pipe(gunzip),
      crlfDelay: Infinity
    });

    let firstLine = true;
    let batch = [];
    let imported = 0;
    let skipped = 0;

    for await (const line of rl) {
      if (firstLine) {
        firstLine = false;
        continue;
      }

      const columns = line.split('\t');

      const [
        imdbId,
        titleType,
        primaryTitle,
        originalTitle,
        isAdult,
        startYear,
        endYear,
        runtimeMinutes,
        genres
      ] = columns;

      // Only import actual movies.
      if (titleType !== 'movie') {
        continue;
      }

      // Ignore movies without a known release year.
      if (!startYear || startYear === '\\N') {
        skipped++;
        continue;
      }

      // Ignore titles without a name.
      if (!primaryTitle || primaryTitle === '\\N') {
        skipped++;
        continue;
      }

      const year = Number(startYear);

      if (!Number.isInteger(year)) {
        skipped++;
        continue;
      }

      // IMDb can contain multiple genres.
      // Example: "Action,Adventure,Sci-Fi"
      const genre =
        genres && genres !== '\\N'
          ? genres.split(',')[0]
          : 'Unknown';

      batch.push({
        id: imdbId,
        title: primaryTitle,
        year,
        genre
      });

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(session, batch);

        imported += batch.length;

        console.log(`🎬 Imported ${imported} movies`);

        batch = [];

        if (imported >= MAX_MOVIES) {
          break;
        }
      }
    }

    // Insert remaining movies.
    if (batch.length > 0 && imported < MAX_MOVIES) {
      const remaining = MAX_MOVIES - imported;
      const finalBatch = batch.slice(0, remaining);

      await insertBatch(session, finalBatch);

      imported += finalBatch.length;
    }

    console.log('\n================================');
    console.log('🎉 Movie import complete!');
    console.log('================================');
    console.log(`Movies imported: ${imported}`);
    console.log(`Movies skipped:  ${skipped}`);
    console.log('================================\n');

  } catch (error) {
    console.error('\n❌ Import failed:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await session.close();
    await driver.close();
  }
}

async function insertBatch(session, movies) {
  await session.run(
    `
    UNWIND $movies AS movie

    MERGE (m:Movie {id: movie.id})

    SET m.title = movie.title,
        m.year = movie.year,
        m.genre = movie.genre
    `,
    { movies }
  );
}

importMovies();