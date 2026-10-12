import "dotenv/config";
import { MongoClient } from "mongodb";
import { Client } from "pg";
import { getPgOptions } from "../config/pg_options.js";

// Only an exact title identifying one document is safe to migrate.
// Existing movie IDs are never changed, including after a film is renamed.
export async function migrateReviewMovieIds(pg, Movies) {
  const result = await pg.query("SELECT DISTINCT movie_title FROM reviews WHERE movie_id IS NULL");
  const summary = { matchedTitles: 0, migratedReviews: 0, ambiguousTitles: 0, unmatchedTitles: 0 };
  for (const row of result.rows) {
    const matches = await Movies.find({ title: row.movie_title }, { projection: { _id: 1 } }).limit(2).toArray();
    if (matches.length === 1) {
      const updated = await pg.query(
        "UPDATE reviews SET movie_id = $1 WHERE movie_id IS NULL AND movie_title = $2",
        [matches[0]._id.toString(), row.movie_title]
      );
      summary.matchedTitles++;
      summary.migratedReviews += updated.rowCount;
    } else if (matches.length > 1) summary.ambiguousTitles++;
    else summary.unmatchedTitles++;
  }
  return summary;
}

export async function runReviewMovieMigration() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is required to migrate review movie references.");
  const mongo = new MongoClient(uri);
  const pg = new Client(getPgOptions());
  try {
    await mongo.connect();
    await pg.connect();
    const summary = await migrateReviewMovieIds(pg, mongo.db(process.env.DB_NAME || "inf2003_db").collection("movies_metadata"));
    console.log("Review movie-ID migration:", summary);
  } finally {
    await pg.end();
    await mongo.close();
  }
}
