import pg from 'pg';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';

export const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
export const mongo = new MongoClient(process.env.MONGO_URL);
export async function connectDependencies() {
  await Promise.all([mongo.connect(), redis.connect()]);
}
export const orders = () => mongo.db().collection('orders');
export const logs = () => mongo.db().collection('logs');
