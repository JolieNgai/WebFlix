import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

import { pgHealth, closePg, pgQuery } from "./config/postgres.js";
import { authRouter, verifyToken } from "./routes/authenticate.js";
import watchlistRoutes from "./routes/watchlist.js";
import reviewRoutes from "./routes/reviews.js";

console.log("🔧 Booting server.js …");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use("/api", authRouter);
app.use("/api/reviews", reviewRoutes(pgQuery, verifyToken)); 

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("Set MONGODB_URI or MONGO_URI before starting the API.");

const dbName = process.env.DB_NAME || "inf2003_db";
console.log("🧩 ENV:", { hasURI: !!uri, dbName });

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let Movies;

// ============ Helpers ============

const escapeRegExp = (str = "") =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toNumber(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseNamesField(raw) {
  if (!raw) return [];

  const extractName = (v) => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object" && "name" in v && v.name) return v.name;
    return null;
  };

  if (Array.isArray(raw)) {
    return raw.map(extractName).filter(Boolean);
  }

  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw.replace(/'/g, '"'));
      if (Array.isArray(arr)) {
        return arr.map(extractName).filter(Boolean);
      }
    } catch (e) {
      // ignore parse error
    }
  }

  return [];
}

function parseCollection(raw) {
  if (!raw) {
    return { id: null, name: null, poster_path: null, poster_url: null };
  }

  let obj = null;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw.replace(/'/g, '"'));
    } catch (e) {
      obj = null;
    }
  } else if (typeof raw === "object") {
    obj = raw;
  }

  if (!obj) {
    return { id: null, name: null, poster_path: null, poster_url: null };
  }

  const poster_path = obj.poster_path || null;
  const poster_url = poster_path
    ? `https://image.tmdb.org/t/p/w500${poster_path}`
    : null;

  return {
    id: obj.id ?? null,
    name: obj.name || null,
    poster_path,
    poster_url,
  };
}

function normalizeMovie(doc) {
  if (!doc) return null;

  let release_date = null;
  let year = null;

  if (doc.release_date) {
    const dt = new Date(doc.release_date);
    if (!Number.isNaN(dt.getTime())) {
      release_date = dt.toISOString().slice(0, 10);
      year = dt.getUTCFullYear();
    } else if (typeof doc.release_date === "string") {
      release_date = doc.release_date;
    }
  }

  const poster_path = doc.poster_path || null;
  const poster_url = poster_path
    ? `https://image.tmdb.org/t/p/w500${poster_path}`
    : null;

  return {
    title: doc.title,
    original_title: doc.original_title || null,
    release_date,
    year,
    tagline: doc.tagline || null,
    overview: doc.overview || null,
    runtime: toNumber(doc.runtime),
    vote_average: toNumber(doc.vote_average),
    vote_count: toNumber(doc.vote_count),
    popularity: toNumber(doc.popularity),
    budget: toNumber(doc.budget),
    revenue: toNumber(doc.revenue),
    status: doc.status || null,
    homepage: doc.homepage || null,
    imdb_id: doc.imdb_id || null,
    adult: !!doc.adult,
    original_language: doc.original_language || null,
    genres: parseNamesField(doc.genres),
    spoken_languages: parseNamesField(doc.spoken_languages),
    production_companies: parseNamesField(doc.production_companies),
    production_countries: parseNamesField(doc.production_countries),
    poster_path,
    poster_url,
    collection: parseCollection(doc.belongs_to_collection),
  };
}

// ============ DB init ============

async function init() {
  console.log("⏳ Connecting to MongoDB …");
  await client.connect();
  db = client.db(dbName);
  Movies = db.collection("movies_metadata");
  console.log("✅ Connected to MongoDB:", db.databaseName);
  // try {
  //   await client.connect();
  //   db = client.db(dbName);
  //   Movies = db.collection("movies_metadata");
  //   console.log("✅ Connected to MongoDB:", db.databaseName);
  // } catch (err) {
  //   console.error("⚠️ MongoDB connection failed. Server will still start, but movie routes will return 503:", err.message);
  //   db = null;
  //   Movies = null;
  // }
}

// ============ Routes ============

app.get("/health", async (_req, res) => {
  if (!db) {
    return res.status(503).json({ ok: 0, error: "Mongo DB not initialised yet" });
  }
  try { 
    // i changed some stuff here to fit in postgre
    // await db.command({ ping: 1 });
    // res.json({ ok: 1 });

    await db.command({ ping: 1 });
    const pgOk = await pgHealth();
    res.json({
      ok: pgOk ? 1 : 0,
      mongo: 1,
      postgres: pgOk ? 1 : 0,
    });
  } catch (e) {
    res.status(500).json({ ok: 0, error: e.message });
  }
});


// GET /api/movies?limit=24&page=1&q=goldeneye&minRating=0
app.get("/api/movies", async (req, res) => {
  if (!Movies) {
    return res.status(503).json({ error: "DB not connected yet" });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const q = (req.query.q || "").trim();

    const minRatingParam = req.query.minRating;
    let minRating = null;
    if (typeof minRatingParam !== "undefined") {
      const parsed = parseFloat(minRatingParam);
      if (!Number.isNaN(parsed)) {
        minRating = parsed;
      }
    }

    const filter = q
      ? { title: { $regex: q, $options: "i" } }
      : {};

    // Only movies with vote_average > minRating (e.g. > 0)
    if (minRating !== null) {
      filter.vote_average = { $gt: minRating };
    }

    // edited this portion for watchlist
    const projection = {
      // _id: 0,
      title: 1,
      original_title: 1,
      release_date: 1,
      tagline: 1,
      overview: 1,
      runtime: 1,
      vote_average: 1,
      vote_count: 1,
      popularity: 1,
      budget: 1,
      revenue: 1,
      status: 1,
      homepage: 1,
      imdb_id: 1,
      adult: 1,
      original_language: 1,
      genres: 1,
      spoken_languages: 1,
      production_companies: 1,
      production_countries: 1,
      poster_path: 1,
      belongs_to_collection: 1,
    };

    const totalCount = await Movies.countDocuments(filter);
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;
    const skip = (page - 1) * limit;

    const docs = await Movies.find(filter, { projection })
      .sort({ release_date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // added this portion for watchlist
    const movies = docs.map((doc) => {
      const movie = normalizeMovie(doc);
      movie._id = doc._id.toString();
      return movie;
    });

    res.json({
      page,
      limit,
      totalCount,
      totalPages,
      count: movies.length,
      documents: movies,
    });
  } catch (err) {
    console.error("❌ /api/movies error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Detailed single movie by title (case-insensitive exact match)
app.get("/api/movies/by-title/:title", async (req, res) => {
  if (!Movies) {
    return res.status(503).json({ error: "DB not connected yet" });
  }

  try {
    const title = req.params.title;
    const projection = {
      _id: 0,
      title: 1,
      original_title: 1,
      release_date: 1,
      tagline: 1,
      overview: 1,
      runtime: 1,
      vote_average: 1,
      vote_count: 1,
      popularity: 1,
      budget: 1,
      revenue: 1,
      status: 1,
      homepage: 1,
      imdb_id: 1,
      adult: 1,
      original_language: 1,
      genres: 1,
      spoken_languages: 1,
      production_companies: 1,
      production_countries: 1,
      poster_path: 1,
      belongs_to_collection: 1,
    };

    const doc = await Movies.findOne(
      { title: { $regex: `^${escapeRegExp(title)}$`, $options: "i" } },
      { projection }
    );

    if (!doc) {
      return res.status(404).json({ error: "Movie not found" });
    }

    const movie = normalizeMovie(doc);
    res.json(movie);
  } catch (err) {
    console.error("❌ /api/movies/by-title error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Shutdown handling ============

process.on("SIGINT", async () => {
  try {
    await client.close();
    await closePg();
  } finally {
    process.exit(0);
  }
});

// ============ Start server ============

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await init();
    console.log("✅ DB init done");
    app.use("/api/watchlist", verifyToken, watchlistRoutes(pgQuery, Movies, normalizeMovie));
  } catch (err) {
    console.error("❌ Failed to init DB, starting server anyway:", err);
    // We still start the HTTP server so Cloud Run health checks pass.
  }

  app.listen(PORT, () => {
    console.log(`🚀 API ready on port ${PORT}`);
  });
}

start();


// const port = process.env.PORT || 3000;
// init().finally(() => {
//   app.listen(port, () => {
//     console.log(`API ready on http://localhost:${port} (Mongo: ${db ? "ok" : "failed"}`);
//   });
// });
