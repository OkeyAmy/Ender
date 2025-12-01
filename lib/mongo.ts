import { MongoClient, Db } from 'mongodb'

declare global {
  var _mongoClient: MongoClient | undefined
}

let client: MongoClient | undefined = global._mongoClient
let db: Db | undefined

export async function getDb(): Promise<Db> {
  if (db) return db

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const dbName = process.env.MONGODB_DB || 'ender'

  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 10 })
    global._mongoClient = client
  }
  await client.connect()
  db = client.db(dbName)

  // Ensure indexes
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ id: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('projects').createIndex({ userId: 1, sandboxId: 1 }, { unique: true })
  ])

  return db
}

