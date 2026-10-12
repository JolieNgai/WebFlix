import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { pgQuery, closePg } from "../config/postgres.js";
import { migrateReviewMovieIds } from "../scripts/review_movie_migration.js";

test("stable movie IDs separate duplicate titles, survive renames, and migrate only unique matches", async () => {
  const api = process.env.TEST_API_BASE || "http://127.0.0.1:8080";
  const marker = "movie-id-test-" + Date.now();
  const email = marker + "@example.test";
  const mongo = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  const ids = [new ObjectId(),new ObjectId(),new ObjectId()];
  const duplicate = marker + "-duplicate";
  const unique = marker + "-unique";
  const request = async (path,method="GET",body,token) => {
    const r=await fetch(api+path,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,data:await r.json()};
  };
  try {
    await mongo.connect();
    const movies=mongo.db(process.env.DB_NAME || "inf2003_db").collection("movies_metadata");
    await movies.insertMany([{_id:ids[0],title:duplicate},{_id:ids[1],title:duplicate},{_id:ids[2],title:unique}]);
    assert.equal((await request("/api/movies/by-title/"+encodeURIComponent(duplicate))).status,409);
    for(const id of ids) assert.equal((await request("/api/movies/"+id)).data._id,id.toString());
    assert.equal((await request("/api/movies/invalid")).status,400);
    await request("/api/register","POST",{name:marker,email,password:"Test-only-123!"});
    const login=await request("/api/login","POST",{email,password:"Test-only-123!"});
    const token=login.data.token;
    const created=await request("/api/reviews","POST",{movieId:ids[0].toString(),movieTitle:"Spoofed title",rating:4,comment:"A stable reference."},token);
    assert.equal(created.status,201);
    assert.equal(created.data.movie_id,ids[0].toString());
    assert.equal(created.data.movie_title,duplicate);
    assert.equal((await request("/api/reviews?movieId="+ids[1])).data.length,0);
    assert.equal((await request("/api/reviews?movieId=invalid")).status,400);
    assert.equal((await request("/api/reviews?movieTitle="+encodeURIComponent(duplicate))).status,400);
    assert.equal((await request("/api/reviews","POST",{movieTitle:duplicate,rating:4,comment:"Old title-only request."},token)).status,400);
    assert.equal((await request("/api/reviews","POST",{movieId:new ObjectId().toString(),rating:4,comment:"Missing movie."},token)).status,404);
    // Legacy data: two titles have exact matches; one title is ambiguous and one missing.
    const legacy = await pgQuery("INSERT INTO reviews (movie_title,rating,comment) VALUES ($1,3,'Unique legacy'),($2,3,'Ambiguous legacy'),($3,3,'Missing legacy') RETURNING r_id,movie_title", [unique,duplicate,marker+"-missing"]);
    // Limit this test's migration scan to its own records; updates use real PostgreSQL.
    const migrationPg = { query: (sql,params) => sql.startsWith("SELECT DISTINCT")
      ? Promise.resolve({rows:legacy.rows.map(row=>({movie_title:row.movie_title}))})
      : pgQuery(sql,params) };
    const first=await migrateReviewMovieIds(migrationPg,movies);
    assert.equal(first.migratedReviews,1);
    assert.equal(first.ambiguousTitles,1);
    assert.equal(first.unmatchedTitles,1);
    const rows=await pgQuery("SELECT movie_title,movie_id FROM reviews WHERE r_id = ANY($1::int[])",[legacy.rows.map(row=>row.r_id)]);
    assert.equal(rows.rows.find(row=>row.movie_title===unique).movie_id,ids[2].toString());
    assert.equal(rows.rows.find(row=>row.movie_title===duplicate).movie_id,null);
    const second=await migrateReviewMovieIds(migrationPg,movies);
    assert.equal(second.migratedReviews,0);
    await movies.updateOne({_id:ids[0]},{$set:{title:marker+"-renamed"}});
    const afterRename=await request("/api/reviews?movieId="+ids[0]);
    assert.equal(afterRename.data.length,1);
    assert.equal(afterRename.data[0].r_id,created.data.r_id);
    assert.equal(afterRename.data[0].movie_title,marker+"-renamed");
    assert.equal((await request("/api/movies/"+ids[0])).data.title,marker+"-renamed");
    await request("/api/reviews/"+created.data.r_id,"PATCH",{movieId:ids[1].toString(),rating:5,comment:"Still the same film."},token);
    assert.equal((await request("/api/reviews?movieId="+ids[0])).data.length,1);
    assert.equal((await request("/api/reviews?movieId="+ids[1])).data.length,0);
  } finally {
    await pgQuery("DELETE FROM reviews WHERE movie_id = ANY($1::text[]) OR movie_title LIKE $2",[ids.map(id=>id.toString()),marker+"%"]);
    await pgQuery("DELETE FROM users WHERE u_email = $1",[email]);
    await mongo.db(process.env.DB_NAME || "inf2003_db").collection("movies_metadata").deleteMany({_id:{$in:ids}});
    await mongo.close();
    await closePg();
  }
});
