# CineGraph

A movie recommendation explorer where recommendations come from your **friend
network**, not a black-box algorithm. Built on **CognoDB** (a managed graph
database speaking openCypher over Bolt) with a Node/Express API and a
vanilla HTML/CSS/JS frontend.

> Built for the Wexa AI take-home assignment.

---

## Why a graph database?

The whole point of CineGraph is a question relational tables answer badly:
*"what should I watch, based on the people I trust, and the people **they**
trust?"*

- **The core query is a variable-depth traversal.** "Friends, and friends of
  friends" is a 1–2 hop walk over a self-referential `FRIEND` relationship.
  In SQL that's a self-join for hop 1, a second self-join (or a recursive
  CTE) for hop 2, and it gets worse at hop 3+. In Cypher it's one pattern:
  `(u)-[:FRIEND*1..2]-(connected)`.
- **Relationships carry meaning, not just foreign keys.** A `RATED`
  relationship has its own properties (`rating`, `createdAt`) sitting *on
  the edge* between a person and a movie — no join table, no composite key,
  and the traversal `(user)-[:RATED]->(movie)` reads exactly like the
  sentence it represents.
- **"Awkward for SQL" queries fall out naturally:**
  - *Six degrees* — the shortest chain of friendships between two people —
    is `shortestPath()` over an unbounded-depth pattern. In SQL this needs a
    recursive CTE with a manually bounded depth and cycle detection.
  - *Whose taste predicts mine* — ranking recommended movies by **how many**
    distinct friends-of-friends rated them highly — is a traversal +
    aggregation in one query, instead of stitching together several joined,
    de-duplicated subqueries.
- **The model grows the way the domain grows.** Add a `Genre` node, a
  `FOLLOWS` relationship, a `Director` — each is a new label/relationship
  type, not a new column or table with more join complexity.

None of this is impossible in a relational database — it's just that a
graph database makes the *interesting* questions the *cheap* ones.

---

## Data model

```
        FRIEND                FRIEND
 (User)◄───────►(User)◄───────►(User)   ...friendship is a mutual,
    │                             │      undirected edge between people
    │ RATED {rating, createdAt}   │ RATED {rating, createdAt}
    ▼                             ▼
 (Movie {id, title,          (Movie {id, title,
         year, genre})               year, genre})
```

**Nodes**
| Label   | Properties                          |
|---------|--------------------------------------|
| `User`  | `id`, `name`, `email`                |
| `Movie` | `id`, `title`, `year`, `genre`       |

**Relationships**
| Type     | Direction        | Properties            | Meaning                        |
|----------|------------------|------------------------|---------------------------------|
| `FRIEND` | stored one-way, queried as undirected | — | mutual friendship between two users |
| `RATED`  | `User → Movie`   | `rating` (1–5), `createdAt` | a user's rating of a movie |

The seed data models a small social graph: 5 users, 6 friendships (with a
couple of cross-links so multi-hop traversals have something to find), 10
movies, and 15 ratings.

---

## What's in the repo

```
wexa-cognodb-movie-app/
├── backend/
│   ├── server.js            # entry point: loads env, starts the API
│   ├── seed.js               # populates CognoDB with demo data
│   ├── src/
│   │   ├── app.js            # express app, routing, static frontend
│   │   ├── db.js             # CognoDB driver + connectivity tracking
│   │   └── routes/
│   │       ├── users.js
│   │       ├── movies.js
│   │       ├── recommendations.js
│   │       ├── graph.js
│   │       └── path.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js             # fetch() calls + D3 force-graph rendering
└── README.md
```

The backend serves the frontend as static files, so the whole app runs as a
**single Node service** — one process, one deploy target.

---

## 1. Set up CognoDB Cloud

1. Sign up at [console.cognodb.com](https://console.cognodb.com/signup) (no
   credit card needed for the free tier).
2. Create a free **c0** instance and pick a region. It provisions in under a
   minute.
3. Copy the connection URI (`bolt+s://<instance-id>.databases.cognodb.com`)
   and the generated password for the `cognodb` user — **the password is
   shown once**, save it immediately.

## 2. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
NEO4J_URI=bolt+s://<your-instance-id>.databases.cognodb.com
NEO4J_USER=cognodb
NEO4J_PASSWORD=<your-generated-password>
PORT=3000
```

`.env` is git-ignored — credentials never get committed.

## 3. Install, seed, and run

```bash
cd backend
npm install
npm run seed     # loads users, movies, friendships and ratings
npm start        # starts the API + serves the frontend
```

Open **http://localhost:3000** — that's the whole app, frontend and API
together.

For local development with auto-restart on file changes:

```bash
npm run dev
```

---

## API reference

All endpoints are prefixed with `/api` and use parameterised Cypher
queries via the official `neo4j-driver` — no string-concatenated Cypher
anywhere in the codebase.

| Method | Endpoint                              | Description |
|--------|----------------------------------------|--------------|
| GET | `/api/health`                            | DB connectivity status |
| GET | `/api/users`                             | List all users |
| GET | `/api/users/:userId`                     | Get one user |
| GET | `/api/users/:userId/friends`             | A user's friends |
| GET | `/api/users/:userId/ratings`             | A user's ratings |
| GET | `/api/movies`                            | Browse the catalog |
| GET | `/api/movies/search?q=`                  | Search movies by title |
| GET | `/api/movies/:movieId`                   | Get one movie |
| GET | `/api/movies/:movieId/ratings`           | Who rated this movie |
| GET | `/api/recommendations/friends/:userId`   | Friend-of-friend suggestions |
| GET | `/api/recommendations/smart/:userId`     | **2-hop** movie recommendations |
| GET | `/api/graph/:userId`                     | Nodes/links for the graph explorer |
| GET | `/api/path/:fromId/:toId`                | Shortest friendship path ("six degrees") |

### The headline query — `GET /api/recommendations/smart/:userId`

```cypher
MATCH (u:User {id: $userId})-[:FRIEND*1..2]-(connected:User)-[r:RATED]->(movie:Movie)
WHERE connected <> u
  AND r.rating >= 4
  AND NOT EXISTS { MATCH (u)-[:RATED]->(movie) }
RETURN movie.id AS id, movie.title AS title, movie.year AS year, movie.genre AS genre,
       COUNT(DISTINCT connected) AS connections,
       AVG(r.rating) AS averageRating,
       COLLECT(DISTINCT connected.name)[0..3] AS sampleFriends
ORDER BY connections DESC, averageRating DESC
LIMIT 10
```

Walks out 1–2 friendship hops, collects movies those connections rated
4+ that the user hasn't seen, and ranks by how many distinct connections
liked it and how highly.

### Six degrees — `GET /api/path/:fromId/:toId`

```cypher
MATCH (a:User {id: $fromId}), (b:User {id: $toId})
MATCH p = shortestPath((a)-[:FRIEND*..6]-(b))
RETURN [n IN nodes(p) | {id: n.id, name: n.name}] AS people, length(p) AS hops
```

Unknown-depth shortest path between two people — the canonical
"awkward-for-SQL, natural-for-graph" query.

---

## Engineering notes

- **Config**: connection details are read from environment variables only;
  `.env` is git-ignored, and `.env.example` documents the required shape.
- **Error handling**: the API starts serving immediately rather than
  blocking on CognoDB; a background connectivity check runs every 30s. If
  the database is unreachable, `/api/*` routes return a `503` with a plain
  message instead of hanging or leaking a stack trace, and the frontend
  polls `/api/health` to show a banner and recover automatically once the
  database comes back.
- **Layering**: routes are grouped by resource (`users`, `movies`,
  `recommendations`, `graph`, `path`) with a single shared driver module,
  so each file stays small and easy to walk through.
- **Frontend**: no build step — plain HTML/CSS/JS plus D3 (via CDN) for the
  force-directed graph — so it's easy to host anywhere that serves static
  files, or alongside the API as it is here.

---

## Deploying the demo

Any host that runs a Node web service works (Render, Railway, Fly.io,
etc.). Point it at `backend/` as the root, set the build command to
`npm install`, the start command to `npm start`, and add the three
`NEO4J_*` environment variables (plus `PORT` if your host requires it) in
the host's dashboard — never in the repo.

- **Hosted demo:** _add your link here_
- **Screen recording:** _add your link here_
- **Screenshots:** _add screenshots of the Overview, Recommendations, and
  Connection Graph tabs here_

---

# Wexa CognoDB Movie Recommendation App

A graph-powered movie recommendation and social discovery application built with **CognoDB/Neo4j**, Node.js, Express, and a lightweight HTML/CSS/JavaScript frontend.

The application models users, friendships, movies, and ratings as a graph and uses Cypher queries to perform multi-hop recommendations and relationship analysis.

---

## 1. Project Overview

This project demonstrates how a graph database can be used to build a movie recommendation system.

Instead of treating users, movies, friendships, and ratings as independent relational records, the application represents them as connected graph entities.

The application supports:

- Movie search
- Browsing a large movie catalog
- Movie pagination
- User profiles
- Friend relationships
- Movie ratings
- Personalized recommendations
- Two-hop social recommendations
- Six-degrees / shortest-path analysis
- Graph visualization
- Database health monitoring
- Graceful error handling

The current movie catalog contains **101,000+ real movie records** imported from the IMDb public dataset.

---

# 2. Features

## Movie Search

Users can search the movie catalog by title.

Search results are loaded from CognoDB through the backend API.

The application uses pagination so that thousands of movies are not loaded into the browser simultaneously.

## Movie Catalog

The database currently contains more than:

```text
101,000 movies
