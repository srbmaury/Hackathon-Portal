import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

export async function connectTestDb() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function clearDb(models = []) {
  if (models.length) {
    await Promise.all(models.map((m) => m.deleteMany({})));
  } else {
    const collections = Object.values(mongoose.connection.collections);
    for (const c of collections) await c.deleteMany({});
  }
}

export async function closeTestDb() {
  // Check if connection is already closed
  if (mongoose.connection.readyState === 0) {
    // Connection already closed, just stop the server
    if (mongoServer) {
      try {
        await mongoServer.stop();
      } catch (error) {
        // Ignore server stop errors
      }
    }
    return;
  }

  try {
    // Wait a bit for any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Use mongoose.disconnect() which handles cleanup more gracefully
    // It will wait for pending operations to complete before closing
    await mongoose.disconnect();
  } catch (error) {
    // If disconnect fails, the connection might already be closing
    // Try to force close as last resort
    try {
      if (mongoose.connection.readyState !== 0) {
        // Force close without waiting for operations
        await mongoose.connection.close(false);
      }
    } catch (closeError) {
      // Connection might already be closed, ignore
    }
  }

  // Stop the in-memory server
  if (mongoServer) {
    try {
      await mongoServer.stop();
    } catch (error) {
      // Ignore server stop errors
    }
  }
}
