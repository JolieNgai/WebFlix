import { getMongoOptions } from "../config/env.js";
import { MongoClient } from "mongodb";

const { uri, database } = getMongoOptions();
const client = new MongoClient(uri);
try {
  await client.connect();
  const movies = client.db(database).collection("movies_metadata");
  if (await movies.countDocuments({}) === 0) {
    // Original fictional fixtures for local development, not real film metadata.
    const samples = [
      ["The Lantern Keeper", "2025-10-01", ["Adventure", "Fantasy"], "A young mapmaker follows a trail of lanterns to a city forgotten by the sea.", 8.2, 112],
      ["Midnight Platform", "2024-07-18", ["Mystery", "Drama"], "Two strangers miss the last train and uncover the history of an abandoned station.", 7.8, 104],
      ["Paper Planets", "2023-04-09", ["Animation", "Family"], "An inventor and a paper bird travel through a universe built from childhood drawings.", 8.6, 96],
      ["The Quiet Horizon", "2022-11-12", ["Drama", "Adventure"], "A photographer returns to her coastal hometown to finish an unfinished family journey.", 7.4, 118],
      ["Signals from Tomorrow", "2025-02-14", ["Science Fiction", "Mystery"], "A radio engineer receives messages from a future that changes with every reply.", 8.1, 121],
      ["Small City Summer", "2024-06-21", ["Comedy", "Family"], "Three neighbors turn an empty rooftop into the city's most unlikely open-air cinema.", 7.6, 99],
    ];
    await movies.insertMany(samples.map(([title, release_date, genres, overview, vote_average, runtime]) => ({
      title, release_date, genres, overview, vote_average, runtime,
      vote_count: 10, status: "Released", original_language: "en",
      spoken_languages: ["English"], poster_path: null,
      tagline: "A fictional WebFlix demo movie.",
    })));
    console.log("Inserted six fictional demo movies.");
  } else {
    console.log("Movie collection already has data; seed skipped.");
  }
} finally {
  await client.close();
}
