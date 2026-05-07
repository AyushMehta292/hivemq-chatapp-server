import mongoose from 'mongoose';

/** Reuse connection across Vercel serverless invocations (warm instances). */
let cached = globalThis.__mongooseHivemqCache;

if (!cached) {
  cached = globalThis.__mongooseHivemqCache = { promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
    });
  }

  try {
    await cached.promise;
    return mongoose;
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}
