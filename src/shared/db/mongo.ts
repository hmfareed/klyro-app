import { MongoClient, Db } from "mongodb";

// Secondary store per 01-architecture: chat/room messages, activity feed, AI logs,
// notification_log. High-write, flexible, non-relational. Phase 0 connects lazily;
// collections are created on first use in later phases (08/10/11).
let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB ?? "klyro");
  return db;
}
