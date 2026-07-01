import "dotenv/config";
import express from "express";
import { requireAuth } from "./auth.js";
import { errorHandler } from "./errors.js";
import { router as participantsRouter } from "./routes/participants.js";
import { router as consentsRouter }     from "./routes/consents.js";
import { router as gamesRouter }        from "./routes/games.js";
import { router as teamsRouter }        from "./routes/teams.js";
import { router as eventsRouter }       from "./routes/events.js";
import { router as messagesRouter }     from "./routes/messages.js";

const app  = express();
const PORT = Number(process.env.DATA_API_PORT) || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Public endpoints ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Protected routes ──────────────────────────────────────────────────────────
app.use("/api/v1", requireAuth);
app.use("/api/v1/participants", participantsRouter);
app.use("/api/v1/consents",    consentsRouter);
app.use("/api/v1/games",       gamesRouter);
app.use("/api/v1/teams",       teamsRouter);
app.use("/api/v1/events",      eventsRouter);
app.use("/api/v1/messages",    messagesRouter);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[data-api] listening on :${PORT}  (provider: ${process.env.DATA_PROVIDER ?? "mysql"})`);
});
