// Redis publish helper for SSE events.
// Data API publishes here; SSE server subscribes and pushes to browsers.
import { createClient } from "redis";

let client;

export async function getRedis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
    client.on("error", (err) => console.error("[redis]", err));
    await client.connect();
  }
  return client;
}

/**
 * Publish a real-time event to all subscribers of game:{gameId}.
 * @param {number} gameId
 * @param {string} event  - e.g. "role-changed"
 * @param {object} data
 */
export async function publish(gameId, event, data) {
  try {
    const redis = await getRedis();
    await redis.publish(`game:${gameId}`, JSON.stringify({ event, data }));
  } catch (err) {
    console.error("[redis] publish failed", err);
  }
}
