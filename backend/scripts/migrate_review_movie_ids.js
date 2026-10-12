import { runReviewMovieMigration } from "./review_movie_migration.js";

runReviewMovieMigration().catch(error => {
  console.error("Review movie-ID migration failed:", error.message);
  process.exitCode = 1;
});
