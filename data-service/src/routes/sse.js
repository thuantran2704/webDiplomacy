// SSE endpoint for the Empirica client.
// EventSource cannot send custom headers — auth is via the `key` query param.
// Each game gets its own Redis channel: game:{gameId}.
import { Router } from "express";
import { getRedis } from "../redis.js";

export const router = Router();

// GET /api/v1/sse?gameId=N&key=TOKEN
router.get("/", async (req, res) => {
  const { gameId, key } = req.query;
  if (!gameId) return res.status(400).end("gameId is required");

  const expected = process.env.DATA_API_KEY ?? "";
  if (!expected || key !== expected) return res.status(403).end("Invalid key");

  const channel = `game:${Number(gameId)}`;
  res.writeHead(200, {
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection":    "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`: connected to ${channel}\n\n`);

  // Each client gets a dedicated Redis subscriber — must not share with the publisher.
  const base = await getRedis();
  const sub  = base.duplicate();
  await sub.connect();

  await sub.subscribe(channel, (msg) => {
    res.write(`data: ${msg}\n\n`);
  });

  req.on("close", async () => {
    try { await sub.unsubscribe(channel); await sub.quit(); } catch {}
    res.end();
  });
});
