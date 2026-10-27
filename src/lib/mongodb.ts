import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};
const globalWithMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cached = globalWithMongoose.mongooseCache ??= { conn: null, promise: null };

async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    };
    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      return mongoose;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    // Log categories only: MongoDB messages and topology objects can contain
    // connection strings and credentials. Keep those out of Vercel logs.
    const failure = e as { name?: string; code?: string | number; syscall?: string; message?: string; reason?: { servers?: Map<string, { error?: { name?: string; code?: string | number; cause?: { code?: string | number } } }> } };
    const safeCode = (code: unknown) => typeof code === "number" || typeof code === "string" && /^[A-Z0-9_]{1,60}$/.test(code) ? code : undefined;
    console.error("storage.connection.failed", JSON.stringify({
      type: failure.name,
      code: safeCode(failure.code),
      dnsOperation: ["querySrv", "queryTxt", "getaddrinfo"].includes(failure.syscall || "") ? failure.syscall : undefined,
      authenticationFailure: /authentication|bad auth/i.test(failure.message || ""),
      selectionTimeout: failure.name === "MongooseServerSelectionError",
      serverErrors: failure.reason?.servers instanceof Map ? Array.from(failure.reason.servers.values(), server => ({ type: server.error?.name, code: safeCode(server.error?.code), cause: safeCode(server.error?.cause?.code) })) : undefined,
    }));
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
